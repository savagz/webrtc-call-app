const { Server } = require("socket.io");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Permite todas las conexiones - ajusta según tus necesidades
    methods: ["GET", "POST"]
  }
});

// Manejo de conexiones WebSocket
io.on("connection", (socket) => {
  console.log(`Usuario Conectado: ${socket.id}`);

  // Cuando un peer se une a una sala
  socket.on("join", (roomName) => {
    const { rooms } = io.sockets.adapter;
    const room = rooms.get(roomName);

    if (room === undefined) {
      socket.join(roomName);
      socket.emit("created");
    } else if (room.size === 1) {
      socket.join(roomName);  
      socket.emit("joined");
    } else {
      //socket.emit("full");
    }
    console.log('Salas actuales:', rooms);
  });

  // Cuando un peer está listo para comunicarse
  socket.on("ready", (roomName) => {
    socket.broadcast.to(roomName).emit("ready");
  });

  // Manejo de candidatos ICE
  socket.on("ice-candidate", (candidate, roomName) => {
    console.log('Candidato ICE recibido:', candidate);
    socket.broadcast.to(roomName).emit("ice-candidate", candidate);
  });

  // Manejo de ofertas
  socket.on("offer", (offer, roomName) => {
    socket.broadcast.to(roomName).emit("offer", offer);
  });

  // Manejo de respuestas
  socket.on("answer", (answer, roomName) => {
    socket.broadcast.to(roomName).emit("answer", answer);
  });

  // Cuando un peer abandona la sala
  socket.on("leave", (roomName) => {
    socket.leave(roomName);
    socket.broadcast.to(roomName).emit("leave");
  });

  // Manejo de desconexión
  socket.on("disconnect", () => {
    console.log(`Usuario Desconectado: ${socket.id}`);
  });
});

// Puerto en el que escuchará el servidor
const PORT = process.env.PORT || 3030;

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor WebSocket ejecutándose en el puerto ${PORT}`);
});