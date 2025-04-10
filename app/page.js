"use client"
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '../styles/Main.module.css';

export default function Home() {
  const router = useRouter();
  const [hoveredOption, setHoveredOption] = useState(null);

  const navigateTo = (path) => {
    router.push(`/${path}`);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>WebRTC</h1>
      
      <div className={styles.optionsContainer}>
        <div className={styles.optionsHeader}>
          <span>Selecciona un modo de comunicación</span>
        </div>
        
        <div className={styles.optionsGrid}>
          <div 
            className={`${styles.optionCard} ${hoveredOption === 'video' ? styles.hovered : ''}`}
            onClick={() => navigateTo('video')}
            onMouseEnter={() => setHoveredOption('video')}
            onMouseLeave={() => setHoveredOption(null)}
          >
            <div className={styles.iconContainer}>
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 10L19.5528 7.72361C19.8343 7.58281 20 7.30779 20 7V17C20 17.3078 19.8343 17.5828 19.5528 17.7236L15 15V10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="5" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.optionTitle}>VIDEO</h3>
            <p className={styles.optionDescription}>
              Comunicación con video y audio en tiempo real
            </p>
          </div>
          
          <div 
            className={`${styles.optionCard} ${hoveredOption === 'audio' ? styles.hovered : ''}`}
            onClick={() => navigateTo('audio')}
            onMouseEnter={() => setHoveredOption('audio')}
            onMouseLeave={() => setHoveredOption(null)}
          >
            <div className={styles.iconContainer}>
              <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7956 1 12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 10V12C19 13.8565 18.2625 15.637 16.9497 16.9497C15.637 18.2625 13.8565 19 12 19C10.1435 19 8.36301 18.2625 7.05025 16.9497C5.7375 15.637 5 13.8565 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.optionTitle}>AUDIO</h3>
            <p className={styles.optionDescription}>
              Comunicación solo con audio para llamadas de voz
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}