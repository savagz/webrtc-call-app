// components/AudioDebug.js
import React, { useEffect, useState, useRef } from 'react';
import styles from '../styles/AudioDebug.module.css';

export default function AudioDebug({ localStream, remoteAudio }) {
  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);
  const [localMuted, setLocalMuted] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [localAudioStats, setLocalAudioStats] = useState(null);
  const [remoteAudioStats, setRemoteAudioStats] = useState(null);
  
  // Referencias para los contextos de audio
  const localAnalyserRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Función para crear un analizador de audio
  const createAudioAnalyser = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      source.connect(analyser);
      analyser.fftSize = 256;
      
      return { audioContext, analyser, source };
    } catch (error) {
      console.error('Error al crear analizador de audio:', error);
      return null;
    }
  };

  // Función para obtener el volumen desde un analizador
  const getVolumeFromAnalyser = (analyser) => {
    if (!analyser) return 0;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    return sum / bufferLength;
  };

  // Monitorear el stream de audio local
  useEffect(() => {
    if (!localStream) {
      setLocalAudioStats(null);
      setLocalMuted(false);
      return;
    }

    // Obtener información sobre las pistas de audio
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      setLocalMuted(!track.enabled);
      
      setLocalAudioStats({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        constraints: track.getConstraints()
      });
      
      // Monitorear cambios en la pista
      const trackListener = () => {
        setLocalMuted(!track.enabled);
        setLocalAudioStats(prev => ({
          ...prev,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        }));
      };
      
      track.addEventListener('mute', trackListener);
      track.addEventListener('unmute', trackListener);
      track.addEventListener('ended', trackListener);
      
      return () => {
        track.removeEventListener('mute', trackListener);
        track.removeEventListener('unmute', trackListener);
        track.removeEventListener('ended', trackListener);
      };
    }
  }, [localStream]);

  // Configurar analizadores de audio
  useEffect(() => {
    // Limpiar analizadores anteriores
    if (localAnalyserRef.current) {
      localAnalyserRef.current.source.disconnect();
      localAnalyserRef.current.audioContext.close();
      localAnalyserRef.current = null;
    }
    
    if (remoteAnalyserRef.current) {
      remoteAnalyserRef.current.source.disconnect();
      remoteAnalyserRef.current.audioContext.close();
      remoteAnalyserRef.current = null;
    }
    
    // Cancelar cualquier frame de animación pendiente
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Crear analizador para el stream local
    if (localStream && localStream.active) {
      localAnalyserRef.current = createAudioAnalyser(localStream);
    }
    
    // Crear analizador para el stream remoto
    if (remoteAudio && remoteAudio.srcObject && remoteAudio.srcObject.active) {
      remoteAnalyserRef.current = createAudioAnalyser(remoteAudio.srcObject);
      setRemoteConnected(true);
      
      // Obtener información sobre las pistas de audio remotas
      const audioTracks = remoteAudio.srcObject.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        setRemoteAudioStats({
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      }
    } else {
      setRemoteConnected(false);
      setRemoteAudioStats(null);
    }
    
    // Función para actualizar los niveles de volumen
    const updateVolumeLevels = () => {
      if (localAnalyserRef.current) {
        const volume = getVolumeFromAnalyser(localAnalyserRef.current.analyser);
        setLocalVolume(volume);
      }
      
      if (remoteAnalyserRef.current) {
        const volume = getVolumeFromAnalyser(remoteAnalyserRef.current.analyser);
        setRemoteVolume(volume);
      }
      
      animationFrameRef.current = requestAnimationFrame(updateVolumeLevels);
    };
    
    // Iniciar la actualización de volumen
    updateVolumeLevels();
    
    // Limpiar al desmontar
    return () => {
      if (localAnalyserRef.current) {
        localAnalyserRef.current.source.disconnect();
        localAnalyserRef.current.audioContext.close();
      }
      
      if (remoteAnalyserRef.current) {
        remoteAnalyserRef.current.source.disconnect();
        remoteAnalyserRef.current.audioContext.close();
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [localStream, remoteAudio]);

  return (
    <div className={styles.audioDebug}>
      <h4 className={styles.debugTitle}>Diagnóstico de Audio</h4>
      
      <div className={styles.meters}>
        <div className={styles.meter}>
          <div className={styles.label}>
            Micrófono Local: {localMuted ? '🔇' : '🎙️'}
          </div>
          <div className={styles.volumeBar}>
            <div 
              className={`${styles.volumeLevel} ${localMuted ? styles.muted : ''}`} 
              style={{ width: `${Math.min(localVolume * 2, 100)}%` }}
            ></div>
          </div>
          {localAudioStats && (
            <div className={styles.audioStats}>
              <span className={styles.statItem}>
                Estado: {localAudioStats.readyState}
              </span>
              <span className={styles.statItem}>
                {localAudioStats.enabled ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </div>
          )}
        </div>
        
        <div className={styles.meter}>
          <div className={styles.label}>
            Audio Remoto: {remoteConnected ? '🔊' : '❌'}
          </div>
          <div className={styles.volumeBar}>
            <div 
              className={styles.volumeLevel} 
              style={{ width: `${Math.min(remoteVolume * 2, 100)}%` }}
            ></div>
          </div>
          {remoteAudioStats && (
            <div className={styles.audioStats}>
              <span className={styles.statItem}>
                Estado: {remoteAudioStats.readyState}
              </span>
              <span className={styles.statItem}>
                {remoteAudioStats.enabled ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className={styles.status}>
        {!remoteConnected && (
          <p className={styles.warning}>
            ⚠️ No hay conexión de audio remoto. Verifica la conexión WebRTC.
          </p>
        )}
        {localMuted && (
          <p className={styles.warning}>
            ⚠️ Tu micrófono está silenciado.
          </p>
        )}
        {remoteConnected && remoteVolume < 1 && (
          <p className={styles.info}>
            ℹ️ No se detecta audio del otro participante. Puede que esté en silencio.
          </p>
        )}
      </div>
    
    </div>
  );
}