// hooks/useSocket.js
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Logger from "../utils/Logger";

const useSocket = () => {
  const logger = useRef(Logger.getLogger("Socket"));
  const socket = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!socket.current) {
      // Usar variable de entorno para la URL del servidor
      const socketUrl = process.env.REACT_APP_SOCKET_SERVER || "http://localhost:3030";
      
      logger.current.info(`Iniciando conexión a ${socketUrl}`);
      
      // Conectar al servidor Socket.IO
      socket.current = io(socketUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Eventos de conexión
      socket.current.on("connect", () => {
        logger.current.info("Conectado al servidor Socket.IO");
        setIsConnected(true);
        setConnectionError(null);
      });

      socket.current.on("connect_error", (error) => {
        logger.current.error("Error de conexión", error);
        setConnectionError(error.message);
      });

      socket.current.on("disconnect", (reason) => {
        logger.current.warn(`Desconectado del servidor Socket.IO: ${reason}`);
        setIsConnected(false);
      });

      socket.current.on("reconnect_attempt", (attemptNumber) => {
        logger.current.info(`Intento de reconexión #${attemptNumber}`);
      });

      // Eventos personalizados
      socket.current.on("created", (roomName) => {
        logger.current.info(`Sala creada: ${roomName}`);
      });

      socket.current.on("joined", (roomName) => {
        logger.current.info(`Unido a la sala: ${roomName}`);
      });

      socket.current.on("full", (roomName) => {
        logger.current.warn(`Sala llena: ${roomName}`);
      });

      socket.current.on("ready", (roomName) => {
        logger.current.debug(`Peer listo para conectar en sala: ${roomName}`);
      });

      socket.current.on("ice-candidate", (candidate) => {
        logger.current.debug("Candidato ICE recibido", { candidate });
      });

      socket.current.on("offer", (offer) => {
        logger.current.debug("Oferta recibida", { sdp: offer.sdp });
      });

      socket.current.on("answer", (answer) => {
        logger.current.debug("Respuesta recibida", { sdp: answer.sdp });
      });

      socket.current.on("leave", (roomName) => {
        logger.current.info(`Peer abandonó la sala: ${roomName}`);
      });
    }

    // Limpieza al desmontar
    return () => {
      if (socket.current) {
        logger.current.info("Desconectando socket");
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, []);

  // Funciones para interactuar con el socket
  const joinRoom = (roomName) => {
    if (socket.current) {
      logger.current.info(`Solicitando unirse a sala: ${roomName}`);
      socket.current.emit("join", roomName);
    } else {
      logger.current.error("Intento de unirse a sala sin conexión establecida");
    }
  };

  const sendReady = (roomName) => {
    if (socket.current) {
      logger.current.debug(`Enviando señal ready a sala: ${roomName}`);
      socket.current.emit("ready", roomName);
    }
  };

  const sendIceCandidate = (candidate, roomName) => {
    if (socket.current) {
      logger.current.debug(`Enviando candidato ICE a sala: ${roomName}`);
      socket.current.emit("ice-candidate", candidate, roomName);
    }
  };

  const sendOffer = (offer, roomName) => {
    if (socket.current) {
      logger.current.debug(`Enviando oferta a sala: ${roomName}`);
      socket.current.emit("offer", offer, roomName);
    }
  };

  const sendAnswer = (answer, roomName) => {
    if (socket.current) {
      logger.current.debug(`Enviando respuesta a sala: ${roomName}`);
      socket.current.emit("answer", answer, roomName);
    }
  };

  const leaveRoom = (roomName) => {
    if (socket.current) {
      logger.current.info(`Abandonando sala: ${roomName}`);
      socket.current.emit("leave", roomName);
    }
  };

  return {
    socket: socket.current,
    isConnected,
    connectionError,
    joinRoom,
    sendReady,
    sendIceCandidate,
    sendOffer,
    sendAnswer,
    leaveRoom,
    logger: logger.current, // Exponer el logger para uso externo si es necesario
  };
};

export default useSocket;