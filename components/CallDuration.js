"use client";
import { useState, useEffect } from "react";
import styles from "../styles/CallDuration.module.css";

const CallDuration = ({ startTime, isActive = true }) => {
  const [duration, setDuration] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!startTime || !isActive) return;

    const calculateDuration = () => {
      const now = new Date();
      const diff = now - startTime;

      // Convertir milisegundos a horas, minutos y segundos
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDuration({ hours, minutes, seconds });
    };

    // Calcular duración inicial
    calculateDuration();

    // Actualizar cada segundo
    const intervalId = setInterval(calculateDuration, 1000);

    // Limpiar intervalo al desmontar
    return () => clearInterval(intervalId);
  }, [startTime, isActive]);

  // Formatear números para mostrar siempre dos dígitos
  const formatNumber = (num) => num.toString().padStart(2, "0");

  return (
    <div>
      <div className={styles.durationDisplay}>
        <span className={styles.durationDigit}>
          {formatNumber(duration.hours)}
        </span>
        <span className={styles.durationSeparator}>:</span>
        <span className={styles.durationDigit}>
          {formatNumber(duration.minutes)}
        </span>
        <span className={styles.durationSeparator}>:</span>
        <span className={styles.durationDigit}>
          {formatNumber(duration.seconds)}
        </span>
      </div>
    </div>
  );
};

export default CallDuration;
