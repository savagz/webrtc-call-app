// components/CallInterface.js
import React from 'react';
import styles from '../styles/CallInterface.module.css';
import AudioDebug from './AudioDebug';


export default function CallInterface({
  callState,
  username,
  targetUser,
  onInitiateCall,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleMute,
  localStreamRef,
  remoteAudioRef
}) {
  // Si no hay estado de llamada activo, no renderizar nada
  if (callState.status === 'idle') {
    return null;
  }

  // Estado: Llamando
  if (callState.status === 'calling') {
    return (
      <div className={styles.callStatus}>
        <div className={styles.callStatusHeader}>
          <h3>Llamando...</h3>
        </div>
        <div className={styles.callStatusContent}>
          <div className={styles.callingAnimation}>
            <div className={styles.callingRing}></div>
            <div className={styles.callingIcon}>📞</div>
          </div>
          <p>Llamando a <strong>{targetUser}</strong></p>
          <p className={styles.callStatusMessage}>Esperando respuesta...</p>
        </div>
        <div className={styles.callActions}>
          <button 
            className={`${styles.button} ${styles.endCall}`}
            onClick={onEndCall}
          >
            Cancelar llamada
          </button>
        </div>
      </div>
    );
  }

  // Estado: Llamada entrante
  if (callState.status === 'incoming' && callState.incoming) {
    return (
      <div className={styles.callStatus}>
        <div className={styles.callStatusHeader}>
          <h3>Llamada entrante</h3>
        </div>
        <div className={styles.callStatusContent}>
          <div className={styles.incomingAnimation}>
            <div className={styles.incomingIcon}>📱</div>
          </div>
          <p>Llamada entrante de <strong>{callState.incoming.from}</strong></p>
        </div>
        <div className={styles.callActions}>
          <button 
            className={`${styles.button} ${styles.accept}`}
            onClick={onAcceptCall}
          >
            Aceptar
          </button>
          <button 
            className={`${styles.button} ${styles.reject}`}
            onClick={onRejectCall}
          >
            Rechazar
          </button>
        </div>
      </div>
    );
  }

  // Estado: En llamada
  if (callState.status === 'connected') {
    const callPartner = targetUser || callState.incoming?.from;
    
    return (
      <div className={styles.activeCall}>
        <div className={styles.callStatusHeader}>
          <h3>Llamada en curso</h3>
          <div className={styles.connectionState}>
            <span className={styles[callState.connectionState]}>
              {callState.connectionState === 'connected' ? '🟢' : 
               callState.connectionState === 'connecting' ? '🟡' : 
               callState.connectionState === 'disconnected' ? '🔴' : '⚪'}
            </span>
            {callState.connectionState}
          </div>
        </div>
        
        <div className={styles.participants}>
          <div className={styles.participant}>
            <div className={styles.participantAvatar}>
              <div className={styles.avatarIcon}>👤</div>
              {callState.isMuted && <div className={styles.mutedIndicator}>🔇</div>}
            </div>
            <div className={styles.participantInfo}>
              <p className={styles.participantName}>{username}</p>
              <p className={styles.participantStatus}>
                {callState.isMuted ? 'Silenciado' : 'Hablando'}
              </p>
            </div>
          </div>
          
          <div className={styles.callDivider}>
            <div className={styles.callLine}></div>
          </div>
          
          <div className={styles.participant}>
            <div className={styles.participantAvatar}>
              <div className={styles.avatarIcon}>👤</div>
            </div>
            <div className={styles.participantInfo}>
              <p className={styles.participantName}>{callPartner}</p>
              <p className={styles.participantStatus}>
                {callState.hasRemoteStream ? 'Conectado' : 'Conectando...'}
              </p>
            </div>
          </div>
        </div>
        
        <div className={styles.callControls}>
          <button 
            className={`${styles.button} ${styles.mute} ${callState.isMuted ? styles.active : ''}`}
            onClick={onToggleMute}
          >
            {callState.isMuted ? '🔇 Activar' : '🔊 Silenciar'}
          </button>
          <button 
            className={`${styles.button} ${styles.endCall}`}
            onClick={onEndCall}
          >
            ❌ Colgar
          </button>
        </div>
        
        <div className={styles.callTimer}>
          <CallTimer startTime={callState.startTime || new Date()} />
        </div>

        {/* Componente de depuración de audio */}
        <AudioDebug 
          localStream={localStreamRef?.current}
          remoteAudio={remoteAudioRef?.current}
        />

        {/* Indicador de estado de la conexión */}
        <div className={styles.connectionInfo}>
          {!callState.hasRemoteStream && (
            <p className={styles.warning}>
              ⚠️ Esperando conexión de audio remoto...
            </p>
          )}
        </div>

        {/* Información de depuración */}
        {process.env.NODE_ENV === 'development' && (
          <div className={styles.debugInfo}>
            <details>
              <summary>Información de depuración</summary>
              <pre>
                {JSON.stringify({
                  localStream: {
                    active: localStreamRef?.current?.active,
                    tracks: localStreamRef?.current?.getTracks().map(track => ({
                      kind: track.kind,
                      enabled: track.enabled,
                      muted: track.muted,
                      readyState: track.readyState
                    }))
                  },
                  remoteStream: {
                    active: remoteAudioRef?.current?.srcObject?.active,
                    tracks: remoteAudioRef?.current?.srcObject?.getTracks().map(track => ({
                      kind: track.kind,
                      enabled: track.enabled,
                      muted: track.muted,
                      readyState: track.readyState
                    }))
                  },
                  connectionState: callState.connectionState,
                  hasRemoteStream: callState.hasRemoteStream,
                  isMuted: callState.isMuted
                }, null, 2)}
              </pre>
            </details>
          </div>
        )}
        
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }}></audio>
      </div>
    );
  }

  return null;
}

// Componente para mostrar el tiempo de llamada
function CallTimer({ startTime }) {
  const [elapsed, setElapsed] = React.useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now - startTime) / 1000);
      setElapsed(diff);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={styles.timer}>
      Duración: {formatTime(elapsed)}
    </div>
  );
}