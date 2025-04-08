"use client";
// pages/index.js
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import styles from "../styles/Home.module.css";
import WebSocketConnection from "../components/WebSocketConnection";
import ConnectionStatus from "../components/ConnectionStatus";
import CallInterface from "../components/CallInterface";

const CallHandler = dynamic(() => import("../components/CallHandler"), {
  ssr: false,
});

export default function Home() {
  // Estados principales
  const [callState, setCallState] = useState({
    status: "idle", // idle, calling, incoming, connected
    target: null,
    incoming: null,
    error: null,
    connectionState: "new",
    isMuted: false,
    hasRemoteStream: false,
    startTime: null,
  });

  const [username, setUsername] = useState("");
  const [wsConnection, setWsConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const [targetUser, setTargetUser] = useState("");
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [isClient, setIsClient] = useState(false);
  const [shouldConnectWS, setShouldConnectWS] = useState(false);

  // Referencias
  const peerConnectionRef = useRef();
  const localStreamRef = useRef();
  const remoteAudioRef = useRef();

  // Configuración WebRTC
  const configuration = {
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
  };

  // Función de debug
  const logDebug = useCallback(
    (location, values) => {
      console.log(`[${location}]`, {
        username,
        targetUser,
        callState,
        wsStatus,
        ...values,
      });
    },
    [username, targetUser, callState, wsStatus]
  );

  // Efecto para verificar el lado del cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Función auxiliar para enviar mensajes WebSocket de manera segura
  const sendWebSocketMessage = useCallback(
    (message) => {
      if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        console.error("WebSocket no está conectado");
        setCallState((prev) => ({
          ...prev,
          error: "Error de conexión con el servidor",
        }));
        return false;
      }

      try {
        wsConnection.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error("Error al enviar mensaje WebSocket:", error);
        setCallState((prev) => ({
          ...prev,
          error: "Error al enviar mensaje al servidor",
        }));
        return false;
      }
    },
    [wsConnection]
  );

  // Funciones de llamada
  const startCall = async () => {
    if (!isClient) return;

    logDebug("startCall - Inicio", {
      isInitiator: !callState.incoming,
      localStream: !!localStreamRef.current,
      peerConnection: !!peerConnectionRef.current,
    });

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia no está soportado en este navegador");
      }

      // Limpiar conexiones existentes
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      // Obtener nuevo stream
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Crear nueva conexión peer
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      peerConnectionRef.current.ontrack = (event) => {
        console.log("ONTRACK EVENT FIRED!", event);

        if (event.streams && event.streams[0]) {
          console.log("Got remote stream:", event.streams[0].id);

          // Create a visible audio element for testing
          const audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.controls = true; // Make it visible for debugging
          audioEl.srcObject = event.streams[0];
          document.body.appendChild(audioEl); // Add to DOM temporarily

          // Also set it to your ref
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }

          setCallState((prev) => ({
            ...prev,
            hasRemoteStream: true,
          }));
        }
      };

      // Agregar tracks
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, localStreamRef.current);
      });

      //   // Manejar tracks remotos
      //   peerConnectionRef.current.ontrack = (event) => {
      //     logDebug("ontrack", {
      //         hasRemoteStream: !!event.streams[0],
      //         tracks: event.streams[0]?.getTracks().map(t => ({
      //           kind: t.kind,
      //           enabled: t.enabled,
      //           muted: t.muted,
      //           readyState: t.readyState
      //         }))
      //       });

      //     // Crear un elemento de audio para reproducir el stream remoto
      //     const remoteAudio = new Audio();
      //     remoteAudio.srcObject = event.streams[0];
      //     remoteAudio.autoplay = true;

      //     // Guardar referencia al audio remoto
      //     if (remoteAudioRef.current) {
      //       remoteAudioRef.current.srcObject = null;
      //     }
      //     remoteAudioRef.current = remoteAudio;
      //     console.log(remoteAudioRef);
      //     // Actualizar estado
      //     setCallState((prev) => ({
      //       ...prev,
      //       hasRemoteStream: true,
      //     }));
      //   };

      //   peerConnectionRef.current.ontrack = (event) => {
      //     logDebug("ontrack", { hasRemoteStream: !!event.streams[0] });

      //     if (remoteAudioRef.current && event.streams[0]) {
      //       remoteAudioRef.current.srcObject = event.streams[0];

      //       remoteAudioRef.current.play().catch((e) => {
      //         console.warn("Auto-play failed:", e);
      //       });

      //       setCallState((prev) => ({
      //         ...prev,
      //         hasRemoteStream: true,
      //       }));
      //     }
      //   };

      // Manejar ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          const targetUserName = callState.incoming
            ? callState.incoming.from
            : targetUser;
          logDebug("onicecandidate", {
            targetUserName,
            candidate: event.candidate.candidate.substring(0, 50) + "...",
          });

          sendWebSocketMessage({
            type: "ice-candidate",
            candidate: event.candidate,
            target: targetUserName,
          });
        }
      };

      // Manejar cambios de estado de conexión
      peerConnectionRef.current.onconnectionstatechange = (event) => {
        const state = peerConnectionRef.current.connectionState;
        setCallState((prev) => ({ ...prev, connectionState: state }));

        logDebug("connectionstatechange", { state });

        switch (state) {
          case "connected":
            console.log("¡Peers conectados!");
            // Establecer tiempo de inicio de la llamada
            setCallState((prev) => ({
              ...prev,
              startTime: new Date(),
            }));
            break;
          case "disconnected":
            console.log("Peers desconectados");
            endCall();
            break;
          case "failed":
            console.log("Conexión fallida");
            endCall();
            break;
        }
      };

      peerConnectionRef.current.addTransceiver("audio", {
        direction: "sendrecv",
      });

      // Monitorear el estado de recopilación de ICE
      peerConnectionRef.current.onicegatheringstatechange = () => {
        logDebug("icegatheringstatechange", {
          state: peerConnectionRef.current.iceGatheringState,
        });
      };

      // Monitorear el estado de conexión ICE
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        logDebug("iceconnectionstatechange", {
          state: peerConnectionRef.current.iceConnectionState,
        });
      };

      // Si somos quien inicia la llamada
      if (!callState.incoming) {
        logDebug("Creando oferta", { targetUser });

        const offer = await peerConnectionRef.current.createOffer({
          offerToReceiveAudio: true,
          voiceActivityDetection: false, // Try disabling VAD
        });
        await peerConnectionRef.current.setLocalDescription(offer);

        const sent = sendWebSocketMessage({
          type: "offer",
          offer: offer,
          target: targetUser,
        });

        if (!sent) {
          throw new Error("No se pudo enviar la oferta al servidor");
        }
      }

      logDebug("startCall - Fin", {
        isInitiator: !callState.incoming,
        localStream: !!localStreamRef.current,
        peerConnection: !!peerConnectionRef.current,
      });
    } catch (error) {
      console.error("Error al iniciar la llamada:", error);
      setCallState((prev) => ({ ...prev, error: error.message }));
      endCall();
    }
  };

  // En handleOffer
  const handleOffer = async (data) => {
    logDebug("handleOffer", { from: data.from });

    try {
      // Verificar que tenemos acceso al micrófono antes de procesar la oferta
      if (!localStreamRef.current || !localStreamRef.current.active) {
        console.log("No hay stream local, iniciando llamada primero...");
        await startCall();

        // Verificar nuevamente después de startCall
        if (!localStreamRef.current || !localStreamRef.current.active) {
          throw new Error("No se pudo acceder al micrófono");
        }
      }

      // Verificar que tenemos una conexión peer
      if (!peerConnectionRef.current) {
        console.log("No hay conexión peer, creando una nueva...");
        peerConnectionRef.current = new RTCPeerConnection(configuration);

        // Configurar eventos de la conexión peer
        setupPeerConnectionEvents();

        // Agregar tracks
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(
            "Añadiendo track al peer connection:",
            track.kind,
            track.enabled
          );
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      console.log("Estableciendo descripción remota (oferta)...");
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      console.log("Creando respuesta...");
      const answer = await peerConnectionRef.current.createAnswer();

      console.log("Estableciendo descripción local (respuesta)...");
      await peerConnectionRef.current.setLocalDescription(answer);

      console.log("Enviando respuesta a:", data.from);
      sendWebSocketMessage({
        type: "answer",
        answer: answer,
        target: data.from,
      });
    } catch (error) {
      console.error("Error al manejar la oferta:", error);
      setCallState((prev) => ({ ...prev, error: error.message }));
    }
  };

  const handleAnswer = async (data) => {
    try {
      logDebug("handleAnswer", { from: data.from });

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    } catch (error) {
      console.error("Error al manejar la respuesta:", error);
      setCallState((prev) => ({ ...prev, error: error.message }));
    }
  };

  const handleIceCandidate = async (data) => {
    try {
      logDebug("handleIceCandidate", {
        from: data.from,
        candidateType: data.candidate?.candidate?.split(" ")[7] || "unknown",
      });

      if (data.candidate) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    } catch (error) {
      console.error("Error al manejar ICE candidate:", error);
      setCallState((prev) => ({ ...prev, error: error.message }));
    }
  };

  // Manejador de mensajes WebSocket
  const handleWebSocketMessage = useCallback((data) => {
    logDebug("handleWebSocketMessage", { messageType: data.type });

    switch (data.type) {
      case "incoming_call":
        setCallState((prev) => ({
          ...prev,
          status: "incoming",
          incoming: data,
          error: null,
        }));
        break;
      case "call_accepted":
        setCallState((prev) => ({
          ...prev,
          status: "connected",
          error: null,
        }));
        setTimeout(() => startCall(), 0);
        break;
      case "call_rejected":
        setCallState((prev) => ({
          ...prev,
          status: "idle",
          incoming: null,
          error: null,
        }));
        alert("Llamada rechazada");
        break;
      case "offer":
        handleOffer(data);
        break;
      case "answer":
        handleAnswer(data);
        break;
      case "ice-candidate":
        handleIceCandidate(data);
        break;
      case "error":
        setCallState((prev) => ({
          ...prev,
          error: data.message,
        }));
        break;
    }
  }, []);

  // Manejador de cambios en la conexión WebSocket
  const handleConnectionChange = useCallback((status) => {
    setWsStatus(status);
    setIsConnected(status === "connected");
  }, []);

  const initiateCall = useCallback(() => {
    if (wsStatus !== "connected") {
      setCallState((prev) => ({
        ...prev,
        error: "No hay conexión con el servidor",
      }));
      return;
    }

    logDebug("initiateCall", { targetUser });

    setCallState((prev) => ({
      ...prev,
      status: "calling",
      error: null,
    }));

    const sent = sendWebSocketMessage({
      type: "call_request",
      from: username,
      to: targetUser,
    });

    if (!sent) {
      setCallState((prev) => ({
        ...prev,
        status: "idle",
        error: "No se pudo iniciar la llamada",
      }));
    }
  }, [wsStatus, username, targetUser, logDebug, sendWebSocketMessage]);

  const acceptCall = useCallback(() => {
    if (wsStatus !== "connected" || !callState.incoming) {
      setCallState((prev) => ({
        ...prev,
        error: "No se puede aceptar la llamada",
      }));
      return;
    }

    logDebug("acceptCall", { incoming: callState.incoming });

    const sent = sendWebSocketMessage({
      type: "call_accepted",
      from: username,
      to: callState.incoming.from,
    });

    if (sent) {
      setCallState((prev) => ({
        ...prev,
        status: "connected",
        error: null,
      }));
      setTimeout(() => startCall(), 0);
    }
  }, [wsStatus, callState.incoming, username, logDebug, sendWebSocketMessage]);

  const rejectCall = useCallback(() => {
    if (callState.incoming) {
      sendWebSocketMessage({
        type: "call_rejected",
        from: username,
        to: callState.incoming.from,
      });
      setCallState((prev) => ({
        ...prev,
        status: "idle",
        incoming: null,
        error: null,
      }));
    }
  }, [callState.incoming, username, sendWebSocketMessage]);

  const endCall = useCallback(() => {
    logDebug("endCall", {});

    // Detener todas las pistas de audio
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Cerrar la conexión peer
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Detener la reproducción de audio remoto
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    // Restablecer el estado de la llamada
    setCallState((prev) => ({
      ...prev,
      status: "idle",
      incoming: null,
      error: null,
      connectionState: "new",
      hasRemoteStream: false,
      startTime: null,
    }));
  }, [logDebug]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setCallState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));

        logDebug("toggleMute", {
          isMuted: !audioTrack.enabled,
          trackEnabled: audioTrack.enabled,
        });
      }
    }
  }, [logDebug]);

  // Iniciar conexión WebSocket
  const startWebSocketConnection = useCallback(() => {
    setShouldConnectWS(true);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, [wsConnection]);

  // Loading state
  if (!isClient) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  //   const testAudioOutput = () => {
  //     const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  //     const oscillator = audioContext.createOscillator();
  //     oscillator.type = 'sine';
  //     oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
  //     oscillator.connect(audioContext.destination);
  //     oscillator.start();
  //     setTimeout(() => oscillator.stop(), 1000); // Stop after 1 second
  //   };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>WebRTC Llamada</h1>
      {/* <button onClick={testAudioOutput}>Test Audio Output</button> */}

      {/* Componente WebSocket */}
      {isUsernameSet && (
        <WebSocketConnection
          username={username}
          onConnectionChange={handleConnectionChange}
          onMessage={handleWebSocketMessage}
          wsConnection={wsConnection}
          setWsConnection={setWsConnection}
          shouldConnect={shouldConnectWS}
        />
      )}

      {/* Mostrar estado de conexión */}
      {isUsernameSet && <ConnectionStatus status={wsStatus} />}

      {/* Mostrar errores globales */}
      {callState.error && (
        <div className={styles.errorMessage}>Error: {callState.error}</div>
      )}

      {/* Paso 1: Ingreso de nombre de usuario */}
      {!isUsernameSet && (
        <div className={styles.setupSection}>
          <input
            className={styles.input}
            type="text"
            placeholder="Ingresa tu nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className={styles.button}
            onClick={() => setIsUsernameSet(true)}
            disabled={!username.trim()}
          >
            Establecer Usuario
          </button>
        </div>
      )}

      {/* Paso 2: Conexión al WebSocket */}
      {isUsernameSet && !isConnected && (
        <div className={styles.setupSection}>
          <p>Usuario: {username}</p>
          <button
            className={styles.button}
            onClick={startWebSocketConnection}
            disabled={shouldConnectWS && wsStatus === "connecting"}
          >
            {wsStatus === "connecting"
              ? "Conectando..."
              : "Conectar al Servidor"}
          </button>
        </div>
      )}

      {/* Paso 3: Interface de llamada */}
      {isConnected && callState.status === "idle" && (
        <div className={styles.callSection}>
          <p>Conectado como: {username} 👤</p>
          <div className={styles.callControls}>
            <input
              className={styles.input}
              type="text"
              placeholder="Usuario a llamar"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              disabled={callState.status !== "idle"}
            />
            <button
              className={styles.button}
              onClick={initiateCall}
              disabled={
                !targetUser.trim() ||
                callState.status !== "idle" ||
                wsStatus !== "connected"
              }
            >
              Llamar 📞
            </button>
          </div>
        </div>
      )}

      {/* Interfaz de llamada */}
      <CallInterface
        callState={callState}
        username={username}
        targetUser={targetUser}
        onInitiateCall={initiateCall}
        onAcceptCall={acceptCall}
        onRejectCall={rejectCall}
        onEndCall={endCall}
        onToggleMute={toggleMute}
        localStreamRef={localStreamRef}
        remoteAudioRef={remoteAudioRef}
      />
      {isClient && callState.status === "connected" && (
        <CallHandler
          onError={(error) => setCallState((prev) => ({ ...prev, error }))}
        />
      )}
    </div>
  );
}
