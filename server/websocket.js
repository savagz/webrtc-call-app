const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const { v4: uuidv4 } = require("uuid"); // Para generar IDs únicos

const app = express();
const server = http.createServer(app);

// Crear servidor WebSocket
const wss = new WebSocket.Server({ server });

// Almacenar información de las salas y clientes
const rooms = new Map();
const clients = new Map();

// Función para enviar mensajes con formato JSON
function sendMessage(ws, type, data = {}) {
  ws.send(
    JSON.stringify({
      type,
      ...data,
    })
  );
}

// Función para transmitir a todos en una sala excepto al remitente
function broadcastToRoom(roomName, senderId, type, data = {}) {
  const room = rooms.get(roomName);
  if (!room) return;

  room.forEach((clientId) => {
    if (clientId !== senderId) {
      const clientWs = clients.get(clientId);
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        sendMessage(clientWs, type, data);
      }
    }
  });
}

// Manejo de conexiones WebSocket
wss.on("connection", (ws) => {
  // Generar ID único para este cliente
  const clientId = uuidv4();
  clients.set(clientId, ws);

  console.log(`Usuario Conectado: ${clientId}`);

  // Enviar ID al cliente
  sendMessage(ws, "connection", { clientId });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { type, roomName, payload } = data;

      switch (type) {
        case "join":
          handleJoin(ws, clientId, roomName);
          break;
        case "ready":
          broadcastToRoom(roomName, clientId, "ready");
          break;
        case "ice-candidate":
          console.log("Candidato ICE recibido:", payload);
          broadcastToRoom(roomName, clientId, "ice-candidate", {
            candidate: payload,
          });
          break;
        case "offer":
          broadcastToRoom(roomName, clientId, "offer", { offer: payload });
          break;
        case "answer":
          broadcastToRoom(roomName, clientId, "answer", { answer: payload });
          break;
        case "leave":
          handleLeave(clientId, roomName);
          break;
      }
    } catch (error) {
      console.error("Error al procesar mensaje:", error);
    }
  });

  // Manejo de desconexión
  ws.on("close", () => {
    console.log(`Usuario Desconectado: ${clientId}`);

    // Encontrar y abandonar todas las salas donde está este cliente
    for (const [roomName, clients] of rooms.entries()) {
      if (clients.has(clientId)) {
        handleLeave(clientId, roomName);
      }
    }

    // Eliminar cliente de la lista
    clients.delete(clientId);
  });

  // Función para manejar la unión a una sala
  function handleJoin(ws, clientId, roomName) {
    if (!rooms.has(roomName)) {
      // Crear nueva sala
      rooms.set(roomName, new Set([clientId]));
      sendMessage(ws, "created");
    } else {
      const room = rooms.get(roomName);
      if (room.size === 1) {
        // Unirse a sala existente
        room.add(clientId);
        sendMessage(ws, "joined");
      } else {
        // Sala llena
        sendMessage(ws, "full");
      }
    }
    console.log(
      "Salas actuales:",
      Array.from(rooms.keys()).map(
        (room) => `${room}: ${Array.from(rooms.get(room)).length} clientes`
      )
    );
  }

  // Función para manejar cuando un cliente abandona una sala
  function handleLeave(clientId, roomName) {
    if (!rooms.has(roomName)) return;

    const room = rooms.get(roomName);
    room.delete(clientId);

    // Notificar a los demás en la sala
    broadcastToRoom(roomName, clientId, "leave");

    // Eliminar la sala si está vacía
    if (room.size === 0) {
      rooms.delete(roomName);
    }
  }
});

// Puerto en el que escuchará el servidor
const PORT = process.env.PORT || 3050;

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor WebSocket ejecutándose en el puerto ${PORT}`);
});
