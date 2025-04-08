// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const users = new Map();

wss.on("connection", (ws) => {
  console.log("Cliente conectado");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Mensaje recibido:", data.type);

      switch (data.type) {
        case "register":
          // Registrar usuario
          users.set(data.username, ws);
          console.log(`Usuario registrado: ${data.username}`);
          break;

        case "call_request":
          // Enviar solicitud de llamada
          const targetWs = users.get(data.to);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(
              JSON.stringify({
                type: "incoming_call",
                from: data.from,
              })
            );
            console.log(
              `Solicitud de llamada enviada de ${data.from} a ${data.to}`
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Usuario no disponible",
              })
            );
          }
          break;

        case "call_accepted":
          // Notificar que la llamada fue aceptada
          const callerWs = users.get(data.to);
          if (callerWs && callerWs.readyState === WebSocket.OPEN) {
            callerWs.send(
              JSON.stringify({
                type: "call_accepted",
                from: data.from,
              })
            );
            console.log(`Llamada aceptada de ${data.from} a ${data.to}`);
          }
          break;

        case "call_rejected":
          // Notificar que la llamada fue rechazada
          const rejectedCallerWs = users.get(data.to);
          if (
            rejectedCallerWs &&
            rejectedCallerWs.readyState === WebSocket.OPEN
          ) {
            rejectedCallerWs.send(
              JSON.stringify({
                type: "call_rejected",
                from: data.from,
              })
            );
          }
          break;

        case "offer":
        case "answer":
        case "ice-candidate":
          // Reenviar mensajes de señalización WebRTC
          const targetUserWs = users.get(data.target);
          if (targetUserWs && targetUserWs.readyState === WebSocket.OPEN) {
            // Obtener el nombre de usuario del remitente
            const fromUsername = getUsername(ws);
            console.log(
              `Reenviando ${data.type} de ${fromUsername} a ${data.target}`
            );

            // Añadir el remitente a los mensajes de señalización
            const forwardData = { ...data, from: fromUsername };
            targetUserWs.send(JSON.stringify(forwardData));
          } else {
            console.log(
              `Usuario ${data.target} no disponible para mensaje ${data.type}`
            );
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Usuario no disponible para señalización",
              })
            );
          }
          break;
      }
    } catch (error) {
      console.error("Error al procesar mensaje:", error);
    }
  });

  ws.on("close", () => {
    // Eliminar usuario cuando se desconecta
    const username = getUsername(ws);
    if (username) {
      users.delete(username);
      console.log(`Usuario desconectado: ${username}`);
    }
  });

  // Función auxiliar para obtener el nombre de usuario por WebSocket
  function getUsername(websocket) {
    for (const [username, ws] of users.entries()) {
      if (ws === websocket) {
        return username;
      }
    }
    return null;
  }
});

console.log("Servidor WebSocket iniciado en el puerto 8080");
