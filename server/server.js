const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = 3001;

let socketList = {};

// Soket Bağlantısı kurulduğunda..
io.on('connection', (socket) => {
  //Konsola mesaj düş
  console.log(`Yeni kullanıcı bağlandı: ${socket.id}`);

  // Bağlantı kesildiğinde soketi kes ve logla
  socket.on('disconnect', () => {
    socket.disconnect();
    console.log('Kullanıcı çıkış yaptı!');
  });

  // Oda da aynı isimde kullanıcı var mı, kontrol et
  socket.on('BE-check-user', ({ roomId, userName }) => {
    let error = false;

    io.sockets.in(roomId).clients((err, clients) => {
      clients.forEach((client) => {
        if (socketList[client] == userName) {
          // Aynı isimde kullanıcı varsa error set et
          error = true;
        }
      });
      // Front-end tarafında tetikle, error içeriğine göre muamele görecek
      socket.emit('FE-error-user-exist', { error });
    });
  });

  // Odaya katılma isteği
  socket.on('BE-join-room', ({ roomId, userName }) => {
    // Odaya katıl
    socket.join(roomId);
    // Listeye ekle
    socketList[socket.id] = { userName, video: true, audio: true };

    // Odadaki Kullanıcı listesini yenile
    io.sockets.in(roomId).clients((err, clients) => {
      try {
        const users = [];
        clients.forEach((client) => {
          // Kullanıcıları listeye ekle
          users.push({ userId: client, info: socketList[client] });
        });

        // Odaya Yeni kullanıcı katılımını front-end de tetikle
        socket.broadcast.to(roomId).emit('FE-user-join', users);
      } catch (e) {
        // Eğer hata oluşursa front-end hatasını tetikle
        io.sockets.in(roomId).emit('FE-error-user-exist', { err: true });
      }
    });
  });

  // Çağrı isteği geldiğinde, çağrı yapılması gereken üyeye sinyal ve dataları  front-end de tetikleyerek gönder
  socket.on('BE-call-user', ({ userToCall, from, signal }) => {
    io.to(userToCall).emit('FE-receive-call', {
      signal,
      from,
      info: socketList[socket.id],
    });
  });

  // Bağlantı isteği kabulü tetiklendiğinde, sinyal ve datayla front end de çağrı kabulünü tetikle
  socket.on('BE-accept-call', ({ signal, to }) => {
    io.to(to).emit('FE-call-accepted', {
      signal,
      answerId: socket.id,
    });
  });

  // Chat mesajı gönder tetiklendiğinde
  socket.on('BE-send-message', ({ roomId, msg, sender }) => {
    // odadaki herkese Front-endde mesaj kabulünü datayla beraber tetikle
    io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
  });

  // Odadan çıkış tetiklendiğinde
  socket.on('BE-leave-room', ({ roomId, leaver }) => {
    //Soket listesinden sil
    delete socketList[socket.id];
    // Front-end tarafında kullanıcı çıkışını tetikle
    socket.broadcast
      .to(roomId)
      .emit('FE-user-leave', { userId: socket.id, userName: [socket.id] });
    // Soket odasından çıkar
    io.sockets.sockets[socket.id].leave(roomId);
  });

  // Kamera/Mikrofon değişimi tetiklendiğinde 
  socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }) => {
    if (switchTarget === 'video') {
      // Kamera değişimiyse video objesini tersine çevir(false)
      socketList[socket.id].video = !socketList[socket.id].video;
    } else {
      // Mikrofon değişimiyse audio objesini tersine çevir(false)
      socketList[socket.id].audio = !socketList[socket.id].audio;
    }
    //  Tüm odaya yeni medyayı sun
    socket.broadcast
      .to(roomId)
      .emit('FE-toggle-camera', { userId: socket.id, switchTarget });
  });
});

// Porttan dinlemeye başla
http.listen(PORT, () => {
  console.log(`Backend yayın portu: ${PORT}`);
});
