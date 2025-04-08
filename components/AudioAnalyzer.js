import { useEffect, useRef, useState } from 'react'

// Componente para el analizador de audio
const AudioAnalyzer = ({ audioStream }) => {
  const canvasRef = useRef(null);
  const analyzerRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationRef = useRef(null);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!audioStream) return;

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const analyzer = audioContext.createAnalyser();
    analyzerRef.current = analyzer;

    analyzer.fftSize = 256;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    dataArrayRef.current = dataArray;

    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyzer);

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");

    const draw = () => {
      if (!analyzerRef.current) return;

      animationRef.current = requestAnimationFrame(draw);

      analyzerRef.current.getByteFrequencyData(dataArrayRef.current);

      // Calcular volumen promedio
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
      }
      const avg = sum / dataArrayRef.current.length;
      setVolume(Math.round(avg));

      // Dibujar visualización
      canvasCtx.fillStyle = "#2a2a4a";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArrayRef.current[i] / 255) * canvas.height;

        // Color basado en la altura (volumen)
        let barColor;
        if (barHeight < canvas.height * 0.3) {
          barColor = "#4ade80"; // Verde para volumen bajo
        } else if (barHeight < canvas.height * 0.6) {
          barColor = "#facc15"; // Amarillo para volumen medio
        } else {
          barColor = "#ef4444"; // Rojo para volumen alto
        }

        canvasCtx.fillStyle = barColor;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      source.disconnect();
      audioContext.close();
      analyzerRef.current = null;
    };
  }, [audioStream]);

  return (
    <div className={styles.audioAnalyzer}>
      <div className={styles.volumeIcon}>🔊</div>
      <canvas ref={canvasRef} className={styles.analyzerCanvas} />
      <div className={styles.volumeLevel}>{volume} dB</div>
    </div>
  );
};

export default AudioAnalyzer;