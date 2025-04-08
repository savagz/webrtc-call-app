"use client"
import { useEffect, useRef, useState } from 'react';
import useSocket from '../hooks/useSocket';
import styles from '../styles/Room.module.css';
import AudioAnalyzer from '../components/AudioAnalyzer';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80',
    }
  ],
};

const Room = () => {
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  const userVideoRef = useRef();
  const peerVideoRef = useRef();
  const rtcConnectionRef = useRef(null);
  const userStreamRef = useRef();
  const hostRef = useRef(false);

  const roomName = "main";
  
  // Usar el hook useSocket
  const { 
    isConnected, 
    connectionError, 
    joinRoom, 
    sendReady, 
    sendIceCandidate, 
    sendOffer, 
    sendAnswer, 
    leaveRoom: emitLeaveRoom,
    logger,
    socket
  } = useSocket();

  useEffect(() => {
    if (isConnected && roomName) {
      logger.info(`Uniendo a la sala: ${roomName}`);
      joinRoom(roomName);
    }
  }, [isConnected, roomName, joinRoom]);

  useEffect(() => {
    if (!socket || !roomName) return;

    // Configurar los event listeners
    socket.on('joined', handleRoomJoined);
    socket.on('created', handleRoomCreated);
    socket.on('ready', initiateCall);
    socket.on('leave', onPeerLeave);
    socket.on('full', () => {
      logger.warn(`Sala ${roomName} llena`);
      window.location.href = '/';
    });
    socket.on('offer', handleReceivedOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handlerNewIceCandidateMsg);

    // Limpieza
    return () => {
      socket.off('joined');
      socket.off('created');
      socket.off('ready');
      socket.off('leave');
      socket.off('full');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket, roomName]);

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
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[0],
        userStreamRef.current,
      );
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[1],
        userStreamRef.current,
      );
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
    }
  };

  const onPeerLeave = () => {
    logger.info('Peer abandonó la sala');
    // This person is now the creator because they are the only person in the room.
    hostRef.current = true;
    if (peerVideoRef.current.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving all track of Peer.
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
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[0],
        userStreamRef.current,
      );
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[1],
        userStreamRef.current,
      );
      rtcConnectionRef.current.setRemoteDescription(offer);

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
    }
  };

  const handleAnswer = (answer) => {
    logger.info('Respuesta recibida, estableciendo descripción remota');
    rtcConnectionRef.current
      .setRemoteDescription(answer)
      .catch((err) => logger.error('Error al establecer descripción remota', err));
  };

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      logger.debug('Candidato ICE generado, enviando al peer');
      sendIceCandidate(event.candidate, roomName);
    }
  };

  const handlerNewIceCandidateMsg = (incoming) => {
    logger.debug('Candidato ICE recibido, añadiendo a la conexión');
    // We cast the incoming candidate to RTCIceCandidate
    const candidate = new RTCIceCandidate(incoming);
    rtcConnectionRef.current
      .addIceCandidate(candidate)
      .catch((e) => logger.error('Error al añadir candidato ICE', e));
  };

  const handleTrackEvent = (event) => {
    logger.info('Track recibido del peer');
    // eslint-disable-next-line prefer-destructuring
    peerVideoRef.current.srcObject = event.streams[0];
  };

  const toggleMediaStream = (type, state) => {
    logger.debug(`Cambiando estado de ${type} a ${!state}`);
    userStreamRef.current.getTracks().forEach((track) => {
      if (track.kind === type) {
        // eslint-disable-next-line no-param-reassign
        track.enabled = !state;
      }
    });
  };

  const toggleMic = () => {
    toggleMediaStream('audio', micActive);
    setMicActive((prev) => !prev);
  };

  const toggleCamera = () => {
    toggleMediaStream('video', cameraActive);
    setCameraActive((prev) => !prev);
  };

  const leaveRoom = () => {
    logger.info('Abandonando sala');
    emitLeaveRoom(roomName); // Usando la función del hook

    if (userVideoRef.current.srcObject) {
      userVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    if (peerVideoRef.current.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
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
    return <div>Error de conexión: {connectionError}</div>;
  }

  if (!isConnected) {
    return <div>Conectando al servidor...</div>;
  }

  return (
    <div className={styles.roomContainer}>
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
          <div className={styles.videoLabel}>Video remoto</div>
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
      
      <div className={styles.roomInfo}>
        <div className={styles.roomStatus}>
          {isJoined ? '✅ Conectado a la sala' : '⏳ Esperando conexión...'}
        </div>
        <div className={styles.roomId}>ID: {roomName}</div>
      </div>
    </div>
  );
};

export default Room;