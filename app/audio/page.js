"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../styles/AudioRoom.module.css";
import AudioAnalyzer from "../../components/AudioAnalyzer";
import SpeechTranscription from "../../components/SpeechTranscription";
import CallDuration from "../../components/CallDuration";
import Logger from "../../utils/Logger";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:openrelay.metered.ca:80",
    },
  ],
};

const ROOM_NAME = "audio-main";

// Función para crear una conexión WebSocket directamente
const createWebSocket = () => {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER || `${wsProtocol}//${window.location.hostname}:3050`;
  return new WebSocket(wsUrl);
};

const AudioRoom = () => {
  const router = useRouter();
  
  // Estados básicos de UI
  const [micActive, setMicActive] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerName, setPeerName] = useState("Participante");
  const [userName, setUserName] = useState("Tú");
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  
  // Estado de conexión
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  
  // Referencias
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const rtcConnectionRef = useRef(null);
  const userStreamRef = useRef();
  const hostRef = useRef(false);
  const wsRef = useRef(null);
  const loggerRef = useRef(Logger.getLogger("AudioRoom"));
  const eventListenersRef = useRef(new Map());
  const clientIdRef = useRef(null);
  
  // Función para enviar mensajes al servidor
  const sendMessage = (type, roomName, payload = null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      loggerRef.current.warn(`No se puede enviar mensaje: ${type}. Socket no conectado`);
      return false;
    }
    
    try {
      const message = JSON.stringify({
        type,
        roomName,
        payload,
      });
      wsRef.current.send(message);
      loggerRef.current.debug(`Mensaje enviado: ${type}`, { roomName, payload });
      return true;
    } catch (error) {
      loggerRef.current.error(`Error al enviar mensaje ${type}:`, error);
      return false;
    }
  };
  
  // Funciones para interactuar con el servidor
  const joinRoom = (roomName) => {
    loggerRef.current.info(`Solicitando unirse a sala: ${roomName}`);
    return sendMessage("join", roomName);
  };

  const sendReady = (roomName) => {
    loggerRef.current.debug(`Enviando señal ready a sala: ${roomName}`);
    return sendMessage("ready", roomName);
  };

  const sendIceCandidate = (candidate, roomName) => {
    loggerRef.current.debug(`Enviando candidato ICE a sala: ${roomName}`);
    return sendMessage("ice-candidate", roomName, candidate);
  };

  const sendOffer = (offer, roomName) => {
    loggerRef.current.debug(`Enviando oferta a sala: ${roomName}`);
    return sendMessage("offer", roomName, offer);
  };

  const sendAnswer = (answer, roomName) => {
    loggerRef.current.debug(`Enviando respuesta a sala: ${roomName}`);
    return sendMessage("answer", roomName, answer);
  };

  const leaveRoom = (roomName) => {
    loggerRef.current.info(`Abandonando sala: ${roomName}`);
    return sendMessage("leave", roomName);
  };
  
  // Sistema de eventos personalizado
  const emitEvent = (event, ...args) => {
    const listeners = eventListenersRef.current.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          loggerRef.current.error(`Error en listener de evento ${event}`, error);
        }
      });
    }
  };

  const addEventListener = (event, callback) => {
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set());
    }
    eventListenersRef.current.get(event).add(callback);
  };

  const removeEventListener = (event, callback) => {
    const listeners = eventListenersRef.current.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        eventListenersRef.current.delete(event);
      }
    }
  };
  
  // Inicializar WebSocket
  const initializeWebSocket = () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      const ws = createWebSocket();
      wsRef.current = ws;
      
      ws.onopen = () => {
        loggerRef.current.info("Conectado al servidor WebSocket");
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        setReconnecting(false);
        
        // Emitir evento de conexión
        emitEvent("connected");
        
        // Si estábamos en una llamada, volver a unirse a la sala
        if (isJoined) {
          joinRoom(ROOM_NAME);
        } else {
          // Unirse a la sala por primera vez
          joinRoom(ROOM_NAME);
        }
      };
      
      ws.onclose = (event) => {
        loggerRef.current.warn(`Conexión cerrada: ${event.code} ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Emitir evento de desconexión
        emitEvent("disconnected", { code: event.code, reason: event.reason });
        
        // Intentar reconectar si no fue un cierre intencional
        if (event.code !== 1000 && event.code !== 1001) {
          setReconnecting(true);
          setTimeout(() => {
            loggerRef.current.info("Intentando reconectar...");
            initializeWebSocket();
          }, 3000);
        }
      };
      
      ws.onerror = (error) => {
        loggerRef.current.error("Error de WebSocket", error);
        setConnectionError("Error en la conexión WebSocket");
        setIsConnecting(false);
        
        // Emitir evento de error
        emitEvent("error", error);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, ...data } = message;
          
          loggerRef.current.debug(`Mensaje recibido: ${type}`, data);
          
          // Manejar tipos de mensajes específicos
          switch (type) {
            case "connection":
              clientIdRef.current = data.clientId;
              break;
            case "created":
              loggerRef.current.info(`Sala creada: ${data.roomName || ""}`);
              emitEvent("created", data.roomName);
              break;
            case "joined":
              loggerRef.current.info(`Unido a la sala: ${data.roomName || ""}`);
              emitEvent("joined", data.roomName);
              break;
            case "full":
              loggerRef.current.warn(`Sala llena: ${data.roomName || ""}`);
              emitEvent("full", data.roomName);
              break;
            case "ready":
              loggerRef.current.debug(
                `Peer listo para conectar en sala: ${data.roomName || ""}`
              );
              emitEvent("ready", data.roomName);
              break;
            case "ice-candidate":
              loggerRef.current.debug("Candidato ICE recibido", data.candidate);
              emitEvent("ice-candidate", data.candidate);
              break;
            case "offer":
              loggerRef.current.debug("Oferta recibida", { sdp: data.offer?.sdp });
              emitEvent("offer", data.offer);
              break;
            case "answer":
              loggerRef.current.debug("Respuesta recibida", { sdp: data.answer?.sdp });
              emitEvent("answer", data.answer);
              break;
            case "leave":
              loggerRef.current.info(`Peer abandonó la sala: ${data.roomName || ""}`);
              emitEvent("leave", data.roomName);
              break;
            default:
              // Emitir evento genérico para cualquier mensaje no reconocido
              emitEvent(type, data);
              loggerRef.current.debug(`Emitido evento genérico: ${type}`);
          }
        } catch (error) {
          loggerRef.current.error("Error al procesar mensaje", error, event.data);
        }
      };
    } catch (error) {
      loggerRef.current.error("Error al inicializar WebSocket", error);
      setConnectionError(`Error al inicializar: ${error.message}`);
      setIsConnecting(false);
      
      // Intentar reconectar después de un tiempo
      setTimeout(() => {
        loggerRef.current.info("Intentando reconectar después de error...");
        initializeWebSocket();
      }, 5000);
    }
  };
  
  // Función para obtener acceso al micrófono
  const getAudioStream = () => {
    setMediaError(null);
    
    return navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false,
      })
      .then((stream) => {
        userStreamRef.current = stream;

        if (localAudioRef.current) {
          localAudioRef.current.srcObject = stream;
          localAudioRef.current.muted = true;
        }
        
        return stream;
      })
      .catch((err) => {
        loggerRef.current.error("Error al obtener acceso al micrófono", err);
        setMediaError(
          err.name === "NotAllowedError" 
            ? "Permiso de micrófono denegado. Por favor, permite el acceso al micrófono."
            : `Error al acceder al micrófono: ${err.message}`
        );
        throw err;
      });
  };

  // Función para crear conexión peer
  const createPeerConnection = () => {
    loggerRef.current.debug("Creando conexión peer para audio");
    const connection = new RTCPeerConnection(ICE_SERVERS);
    
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        loggerRef.current.debug("Candidato ICE generado para audio, enviando al peer");
        sendIceCandidate(event.candidate, ROOM_NAME);
      }
    };
    
    connection.ontrack = (event) => {
      loggerRef.current.info("Track de audio recibido del peer");
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        // Guardar el stream remoto para el analizador de audio
        setRemoteStream(event.streams[0]);
        setPeerConnected(true);
      }
    };
    
    // Monitorear estado de conexión
    connection.oniceconnectionstatechange = () => {
      loggerRef.current.debug(`Estado de conexión ICE: ${connection.iceConnectionState}`);
      
      if (connection.iceConnectionState === 'disconnected' || 
          connection.iceConnectionState === 'failed') {
        loggerRef.current.warn("Conexión ICE perdida o fallida");
        setPeerConnected(false);
      }
    };
    
    return connection;
  };
  
  // Efecto para inicializar WebSocket y configurar event listeners
  useEffect(() => {
    loggerRef.current.info("Inicializando componente AudioRoom");
    
    // Inicializar WebSocket
    initializeWebSocket();
    
    // Configurar event listeners
    const handleRoomJoined = () => {
      loggerRef.current.info("Unido a la sala de audio, solicitando acceso al micrófono");
      setIsJoined(true);
      
      // Solo establecer el tiempo de inicio si es una nueva llamada
      if (!callStartTime) {
        setCallStartTime(new Date());
      }

      getAudioStream()
        .then(() => {
          loggerRef.current.debug("Audio obtenido, enviando señal ready");
          sendReady(ROOM_NAME);
        })
        .catch(() => {
          // Error ya manejado en getAudioStream
        });
    };

    const handleRoomCreated = () => {
      loggerRef.current.info("Sala de audio creada, este usuario es el host");
      hostRef.current = true;
      setIsJoined(true);
      
      // Solo establecer el tiempo de inicio si es una nueva llamada
      if (!callStartTime) {
        setCallStartTime(new Date());
      }

      getAudioStream()
        .catch(() => {
          // Error ya manejado en getAudioStream
        });
    };

    const initiateCall = () => {
      if (hostRef.current) {
        loggerRef.current.info("Iniciando llamada de audio como host");
        
        // Limpiar cualquier conexión existente
        if (rtcConnectionRef.current) {
          rtcConnectionRef.current.close();
          rtcConnectionRef.current = null;
        }
        
        rtcConnectionRef.current = createPeerConnection();

        if (
          userStreamRef.current &&
          userStreamRef.current.getTracks().length > 0
        ) {
          userStreamRef.current.getTracks().forEach((track) => {
            rtcConnectionRef.current.addTrack(track, userStreamRef.current);
          });

          rtcConnectionRef.current
            .createOffer()
            .then((offer) => {
              rtcConnectionRef.current.setLocalDescription(offer);
              loggerRef.current.debug("Oferta de audio creada, enviando al peer");
              sendOffer(offer, ROOM_NAME);
            })
            .catch((error) => {
              loggerRef.current.error("Error al crear oferta de audio", error);
            });
        } else {
          loggerRef.current.error(
            "No hay stream de audio disponible para iniciar la llamada"
          );
          
          // Intentar obtener el audio de nuevo
          getAudioStream()
            .then(() => {
              // Reintentar la llamada
              setTimeout(initiateCall, 1000);
            })
            .catch(() => {
              // Error ya manejado en getAudioStream
            });
        }
      }
    };

    const onPeerLeave = () => {
      loggerRef.current.info("Peer abandonó la sala de audio");
      hostRef.current = true;
      setPeerConnected(false);
      setRemoteStream(null);

      if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject
          .getTracks()
          .forEach((track) => track.stop());
        remoteAudioRef.current.srcObject = null;
      }

      if (rtcConnectionRef.current) {
        rtcConnectionRef.current.ontrack = null;
        rtcConnectionRef.current.onicecandidate = null;
        rtcConnectionRef.current.close();
        rtcConnectionRef.current = null;
      }
    };

    const handleReceivedOffer = (offer) => {
      if (!hostRef.current) {
        loggerRef.current.info("Oferta de audio recibida, creando respuesta");
        
        // Limpiar cualquier conexión existente
        if (rtcConnectionRef.current) {
          rtcConnectionRef.current.close();
          rtcConnectionRef.current = null;
        }
        
        rtcConnectionRef.current = createPeerConnection();

        if (
          userStreamRef.current &&
          userStreamRef.current.getTracks().length > 0
        ) {
          userStreamRef.current.getTracks().forEach((track) => {
            rtcConnectionRef.current.addTrack(track, userStreamRef.current);
          });

          rtcConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          rtcConnectionRef.current
            .createAnswer()
            .then((answer) => {
              rtcConnectionRef.current.setLocalDescription(answer);
              loggerRef.current.debug("Respuesta de audio creada, enviando al peer");
              sendAnswer(answer, ROOM_NAME);
            })
            .catch((error) => {
              loggerRef.current.error("Error al crear respuesta de audio", error);
            });
        } else {
          loggerRef.current.error(
            "No hay stream de audio disponible para responder a la oferta"
          );
          
          // Intentar obtener el audio de nuevo
          getAudioStream()
            .then(() => {
              // Reintentar procesar la oferta
              setTimeout(() => handleReceivedOffer(offer), 1000);
            })
            .catch(() => {
              // Error ya manejado en getAudioStream
            });
        }
      }
    };

    const handleAnswer = (answer) => {
      loggerRef.current.info(
        "Respuesta de audio recibida, estableciendo descripción remota"
      );
      if (rtcConnectionRef.current) {
        rtcConnectionRef.current
          .setRemoteDescription(new RTCSessionDescription(answer))
          .catch((err) =>
            loggerRef.current.error("Error al establecer descripción remota para audio", err)
          );
      } else {
        loggerRef.current.error("No hay conexión RTC para establecer la respuesta de audio");
      }
    };

    const handlerNewIceCandidateMsg = (incoming) => {
      loggerRef.current.debug("Candidato ICE recibido para audio, añadiendo a la conexión");
      if (rtcConnectionRef.current) {
        const candidate = new RTCIceCandidate(incoming);
        rtcConnectionRef.current
          .addIceCandidate(candidate)
          .catch((e) =>
            loggerRef.current.error("Error al añadir candidato ICE para audio", e)
          );
      } else {
        loggerRef.current.warn("Candidato ICE recibido pero no hay conexión RTC para audio");
      }
    };

    const handleRoomFull = () => {
      loggerRef.current.warn(`Sala ${ROOM_NAME} llena`);
      router.push("/");
    };
    
    // Registrar event listeners
    addEventListener("joined", handleRoomJoined);
    addEventListener("created", handleRoomCreated);
    addEventListener("ready", initiateCall);
    addEventListener("leave", onPeerLeave);
    addEventListener("full", handleRoomFull);
    addEventListener("offer", handleReceivedOffer);
    addEventListener("answer", handleAnswer);
    addEventListener("ice-candidate", handlerNewIceCandidateMsg);
    
    // Limpieza al desmontar
    return () => {
      loggerRef.current.info("Desmontando componente AudioRoom");
      
      // Limpiar event listeners
      removeEventListener("joined", handleRoomJoined);
      removeEventListener("created", handleRoomCreated);
      removeEventListener("ready", initiateCall);
      removeEventListener("leave", onPeerLeave);
      removeEventListener("full", handleRoomFull);
      removeEventListener("offer", handleReceivedOffer);
      removeEventListener("answer", handleAnswer);
      removeEventListener("ice-candidate", handlerNewIceCandidateMsg);
      
      // Limpiar streams
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach((track) => track.stop());
        userStreamRef.current = null;
      }
      
      // Limpiar conexión RTC
      if (rtcConnectionRef.current) {
        rtcConnectionRef.current.close();
        rtcConnectionRef.current = null;
      }
      
      // Cerrar WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Abandonar sala si estamos unidos
        if (isJoined) {
          leaveRoom(ROOM_NAME);
        }
        
        // Cerrar conexión
        wsRef.current.close(1000, "Componente desmontado");
        wsRef.current = null;
      }
    };
  }, [router, callStartTime]);

  // Funciones de UI
  const toggleMic = (e) => {
    if (e) e.preventDefault();
    if (!userStreamRef.current) {
      loggerRef.current.warn("No hay stream de audio para cambiar");
      return;
    }

    loggerRef.current.debug(`Cambiando estado del micrófono a ${!micActive}`);
    userStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !micActive;
    });
    setMicActive((prev) => !prev);
  };

  const handleLeaveRoom = (e) => {
    if (e) e.preventDefault();
    loggerRef.current.info("Abandonando sala de audio");
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      leaveRoom(ROOM_NAME);
    }

    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (localAudioRef.current && localAudioRef.current.srcObject) {
      localAudioRef.current.srcObject = null;
    }

    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.srcObject = null;
    }

    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }

    setRemoteStream(null);
    setIsJoined(false);
    setCallStartTime(null);
    setPeerConnected(false);
    router.push("/");
  };

  const handleRetryConnection = () => {
    loggerRef.current.info("Intentando reconectar manualmente");
    setReconnecting(true);
    
    // Cerrar WebSocket existente si está abierto
    if (wsRef.current) {
      wsRef.current.close(3000, "Reconexión manual");
    }
    
    // Inicializar nuevo WebSocket
    initializeWebSocket();
  };

  // Renderizado condicional para estados de error y carga
  if (mediaError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>🎤</div>
        <h3>Error de acceso al micrófono</h3>
        <p>{mediaError}</p>
        <button 
          onClick={() => {
            setMediaError(null);
            getAudioStream().catch(() => {});
          }} 
          className={styles.retryButton}
        >
          Reintentar acceso
        </button>
        <button 
          onClick={() => router.push("/")} 
          className={styles.backButton}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h3>Error de conexión</h3>
        <p>{connectionError}</p>
        <button 
          onClick={handleRetryConnection} 
          className={styles.retryButton}
        >
          Reintentar conexión
        </button>
        <button 
          onClick={() => router.push("/")} 
          className={styles.backButton}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  if (isConnecting || !isConnected) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>{isConnecting ? "Conectando al servidor..." : "Inicializando conexión..."}</p>
      </div>
    );
  }

  if (reconnecting) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Reconectando la llamada...</p>
        <button 
          onClick={() => router.push("/")} 
          className={styles.backButton}
          style={{ marginTop: '1rem' }}
        >
          Cancelar y volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className={styles.audioRoomContainer}>
      {/* Elementos de audio ocultos */}
      <audio
        ref={localAudioRef}
        autoPlay
        muted
        className={styles.hiddenAudio}
      />
      <audio ref={remoteAudioRef} autoPlay className={styles.hiddenAudio} />

      <div className={styles.audioRoomHeader}>
        <h2 className={styles.audioRoomTitle}>
          <span className={styles.audioIcon}>🎧</span> Llamada de Audio
        </h2>
        <button
          onClick={handleLeaveRoom}
          type="button"
          className={styles.exitButton}
          aria-label="Salir de la llamada"
        >
          ⊗
        </button>
      </div>

      {/* Contenedor principal según el boceto */}
      <div className={styles.mainContainer}>
        {/* Participantes y cronómetro */}
        <div className={styles.participantsRow}>
          {/* Usuario local */}
          <div className={styles.participantCard}>
            <div className={styles.participantAvatar}>
              <div className={styles.avatarCircle}>
                <span className={styles.avatarIcon}>👤</span>
              </div>
              <div className={styles.participantName}>{userName}</div>
            </div>
            <button
              onClick={toggleMic}
              type="button"
              className={`${styles.muteButton} ${
                !micActive ? styles.muted : ""
              }`}
              aria-label={
                micActive ? "Silenciar micrófono" : "Activar micrófono"
              }
            >
              {micActive ? "🎤" : "🔇"}
            </button>
          </div>

          {/* Cronómetro en el centro */}
          <div className={styles.timerContainer}>
            {isJoined && (
              <CallDuration startTime={callStartTime} isActive={isJoined} />
            )}
          </div>

          {/* Participante remoto */}
          <div className={styles.participantCard}>
            <div className={styles.participantAvatar}>
              <div
                className={`${styles.avatarCircle} ${
                  !peerConnected ? styles.disconnected : ""
                }`}
              >
                <span className={styles.avatarIcon}>
                  {peerConnected ? "👤" : "👻"}
                </span>
              </div>
              <div className={styles.participantName}>
                {peerConnected ? peerName : "Esperando..."}
              </div>
            </div>
          </div>
        </div>

        {/* Analizadores de audio */}
        <div className={styles.analyzersRow}>
          {/* Analizador local */}
          <div className={styles.analyzerContainer}>
            {userStreamRef.current && (
              <AudioAnalyzer audioStream={userStreamRef.current} />
            )}
          </div>

          {/* Analizador remoto */}
          <div className={styles.analyzerContainer}>
            {remoteStream && peerConnected ? (
              <AudioAnalyzer audioStream={remoteStream} />
            ) : (
              <div className={styles.emptyAnalyzer}></div>
            )}
          </div>
        </div>

        {/* Transcripción */}
        <div className={styles.transcriptionContainer}>
          <div className={styles.transcriptionHeader}>
            <span>Transcripción</span>
          </div>
          {userStreamRef.current && (
            <SpeechTranscription audioStream={userStreamRef.current} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRoom;