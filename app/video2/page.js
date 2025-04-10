"use client"
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useWebSocket from '../../hooks/useWebSocket';
import styles from '../../styles/Room.module.css';
import AudioAnalyzer from '../../components/AudioAnalyzer';
import SpeechTranscription from '../../components/SpeechTranscription';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80',
    }
  ],
};

const Room = () => {
  const router = useRouter();
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  const userVideoRef = useRef();
  const peerVideoRef = useRef();
  const rtcConnectionRef = useRef(null);
  const userStreamRef = useRef();
  const hostRef = useRef(false);

  const roomName = "main";
 
  // Usar el hook useSocket con la nueva API
  const { 
    isConnected, 
    connectionError, 
    joinRoom, 
    sendReady, 
    sendIceCandidate, 
    sendOffer, 
    sendAnswer, 
    leaveRoom: emitLeaveRoom,
    on, // Nuevo método para suscribirse a eventos
    logger
  } = useWebSocket();

  // Efecto para unirse a la sala cuando se establece la conexión
  useEffect(() => {
    if (isConnected && roomName) {
      logger.info(`Uniendo a la sala: ${roomName}`);
      joinRoom(roomName);
    }
  }, [isConnected, roomName]);

  // Efecto para configurar los event listeners usando el nuevo sistema de eventos
  useEffect(() => {
    if (!isConnected) return;

    // Configurar los event listeners usando el nuevo método 'on'
    const unsubJoined = on('joined', handleRoomJoined);
    const unsubCreated = on('created', handleRoomCreated);
    const unsubReady = on('ready', initiateCall);
    const unsubLeave = on('leave', onPeerLeave);
    const unsubFull = on('full', () => {
      logger.warn(`Sala ${roomName} llena`);
      router.push('/');
    });
    const unsubOffer = on('offer', handleReceivedOffer);
    const unsubAnswer = on('answer', handleAnswer);
    const unsubIceCandidate = on('ice-candidate', handlerNewIceCandidateMsg);

    // Limpieza: cancelar todas las suscripciones
    return () => {
      unsubJoined();
      unsubCreated();
      unsubReady();
      unsubLeave();
      unsubFull();
      unsubOffer();
      unsubAnswer();
      unsubIceCandidate();
    };
  }, [isConnected, roomName]);

  const handleRoomJoined = () => {
    logger.info('Unido a la sala, solicitando acceso a medios');
    setIsJoined(true);
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        userStreamRef.current = stream;
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.onloadedmetadata = () => {
          userVideoRef.current.play();
        };
        logger.debug('Medios obtenidos, enviando señal ready');
        sendReady(roomName);
      })
      .catch((err) => {
        logger.error('Error al obtener medios', err);
      });
  };

  const handleRoomCreated = () => {
    logger.info('Sala creada, este usuario es el host');
    hostRef.current = true;
    setIsJoined(true); // Añadido para actualizar el estado
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        userStreamRef.current = stream;
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.onloadedmetadata = () => {
          userVideoRef.current.play();
        };
        logger.debug('Medios obtenidos para el host');
      })
      .catch((err) => {
        logger.error('Error al obtener medios para el host', err);
      });
  };

  const initiateCall = () => {
    if (hostRef.current) {
      logger.info('Iniciando llamada como host');
      rtcConnectionRef.current = createPeerConnection();
      
      // Verificar que userStreamRef.current existe y tiene tracks
      if (userStreamRef.current && userStreamRef.current.getTracks().length > 0) {
        userStreamRef.current.getTracks().forEach(track => {
          rtcConnectionRef.current.addTrack(track, userStreamRef.current);
        });
        
        rtcConnectionRef.current
          .createOffer()
          .then((offer) => {
            rtcConnectionRef.current.setLocalDescription(offer);
            logger.debug('Oferta creada, enviando al peer');
            sendOffer(offer, roomName);
          })
          .catch((error) => {
            logger.error('Error al crear oferta', error);
          });
      } else {
        logger.error('No hay stream de usuario disponible para iniciar la llamada');
      }
    }
  };

  const onPeerLeave = () => {
    logger.info('Peer abandonó la sala');
    // This person is now the creator because they are the only person in the room.
    hostRef.current = true;
    if (peerVideoRef.current && peerVideoRef.current.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving all track of Peer.
      peerVideoRef.current.srcObject = null;
    }

    // Safely closes the existing connection established with the peer who left.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
  }

  const createPeerConnection = () => {
    logger.debug('Creando conexión peer');
    // We create a RTC Peer Connection
    const connection = new RTCPeerConnection(ICE_SERVERS);

    // We implement our onicecandidate method for when we received a ICE candidate from the STUN server
    connection.onicecandidate = handleICECandidateEvent;

    // We implement our onTrack method for when we receive tracks
    connection.ontrack = handleTrackEvent;
    return connection;
  };

  const handleReceivedOffer = (offer) => {
    if (!hostRef.current) {
      logger.info('Oferta recibida, creando respuesta');
      rtcConnectionRef.current = createPeerConnection();
      
      // Verificar que userStreamRef.current existe y tiene tracks
      if (userStreamRef.current && userStreamRef.current.getTracks().length > 0) {
        userStreamRef.current.getTracks().forEach(track => {
          rtcConnectionRef.current.addTrack(track, userStreamRef.current);
        });
        
        rtcConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

        rtcConnectionRef.current
          .createAnswer()
          .then((answer) => {
            rtcConnectionRef.current.setLocalDescription(answer);
            logger.debug('Respuesta creada, enviando al peer');
            sendAnswer(answer, roomName);
          })
          .catch((error) => {
            logger.error('Error al crear respuesta', error);
          });
      } else {
        logger.error('No hay stream de usuario disponible para responder a la oferta');
      }
    }
  };

  const handleAnswer = (answer) => {
    logger.info('Respuesta recibida, estableciendo descripción remota');
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current
        .setRemoteDescription(new RTCSessionDescription(answer))
        .catch((err) => logger.error('Error al establecer descripción remota', err));
    } else {
      logger.error('No hay conexión RTC para establecer la respuesta');
    }
  };

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      logger.debug('Candidato ICE generado, enviando al peer');
      sendIceCandidate(event.candidate, roomName);
    }
  };

  const handlerNewIceCandidateMsg = (incoming) => {
    logger.debug('Candidato ICE recibido, añadiendo a la conexión');
    if (rtcConnectionRef.current) {
      // We cast the incoming candidate to RTCIceCandidate
      const candidate = new RTCIceCandidate(incoming);
      rtcConnectionRef.current
        .addIceCandidate(candidate)
        .catch((e) => logger.error('Error al añadir candidato ICE', e));
    } else {
      logger.warn('Candidato ICE recibido pero no hay conexión RTC');
    }
  };

  const handleTrackEvent = (event) => {
    logger.info('Track recibido del peer');
    if (peerVideoRef.current) {
      // eslint-disable-next-line prefer-destructuring
      peerVideoRef.current.srcObject = event.streams[0];
    }
  };

  const toggleMediaStream = (type, state) => {
    if (!userStreamRef.current) {
      logger.warn(`No hay stream para cambiar ${type}`);
      return;
    }
    
    logger.debug(`Cambiando estado de ${type} a ${!state}`);
    userStreamRef.current.getTracks().forEach((track) => {
      if (track.kind === type) {
        // eslint-disable-next-line no-param-reassign
        track.enabled = !state;
      }
    });
  };

  const toggleMic = (e) => {
    if (e) e.preventDefault();
    toggleMediaStream('audio', micActive);
    setMicActive((prev) => !prev);
  };

  const toggleCamera = (e) => {
    if (e) e.preventDefault();
    toggleMediaStream('video', cameraActive);
    setCameraActive((prev) => !prev);
  };

  const leaveRoom = (e) => {
    if (e) e.preventDefault();
    logger.info('Abandonando sala');
    emitLeaveRoom(roomName); // Usando la función del hook

    if (userVideoRef.current && userVideoRef.current.srcObject) {
      userVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      userVideoRef.current.srcObject = null;
    }
    
    if (peerVideoRef.current && peerVideoRef.current.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      peerVideoRef.current.srcObject = null;
    }

    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
    
    router.push('/');
  };

  if (connectionError) {
    return <div className={styles.errorMessage}>Error de conexión: {connectionError}</div>;
  }

  if (!isConnected) {
    return <div className={styles.loadingMessage}>Conectando al servidor...</div>;
  }

  return (
    <div className={styles.roomContainer}>
      <div className={styles.roomInfo}>
        <div className={styles.roomStatus}>
          {isJoined ? '✅ Conectado a la sala' : '⏳ Esperando conexión...'}
        </div>
        <div className={styles.roomId}>ID: {roomName}</div>
      </div>

      <div className={styles.videoGrid}>
        <div className={styles.videoWrapper}>
          <video autoPlay ref={userVideoRef} className={styles.video} muted />
          <div className={styles.videoLabel}>Tu video</div>
          {userStreamRef.current && (
            <AudioAnalyzer audioStream={userStreamRef.current} />
          )}
        </div>
        <div className={styles.videoWrapper}>
          <video autoPlay ref={peerVideoRef} className={styles.video} />
          <div className={styles.videoLabel}>Video Remoto</div>
        </div>
      </div>
      
      <div className={styles.controlsContainer}>
        <button 
          onClick={toggleMic} 
          type="button"
          className={`${styles.controlButton} ${!micActive ? styles.inactive : ''}`}
        >
          {micActive ? '🎤' : '🔇'}
          <span className={styles.buttonLabel}>{micActive ? 'Silenciar' : 'Activar'}</span>
        </button>
        
        <button 
          onClick={toggleCamera} 
          type="button"
          className={`${styles.controlButton} ${!cameraActive ? styles.inactive : ''}`}
        >
          {cameraActive ? '📹' : '🚫'}
          <span className={styles.buttonLabel}>{cameraActive ? 'Apagar' : 'Encender'}</span>
        </button>
        
        <button 
          onClick={leaveRoom} 
          type="button"
          className={`${styles.controlButton} ${styles.leaveButton}`}
        >
          🚪
          <span className={styles.buttonLabel}>Salir</span>
        </button>
      </div>

      {userStreamRef.current && (
        <SpeechTranscription audioStream={userStreamRef.current} />
      )}
    </div>
  );
};

export default Room;