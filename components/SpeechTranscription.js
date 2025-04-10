import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from '../styles/Room.module.css';

// Componente de transcripción de voz
const SpeechTranscription = ({ audioStream }) => {
    const [finalstring, setFinalString] = useState("");
    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isView, setIsView] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
      // Verificar si el navegador soporta la API
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Tu navegador no soporta la API de reconocimiento de voz');
        return;
      }
  
      // Inicializar el reconocimiento de voz
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // Configurar opciones
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES'; 
      
      // Manejar resultados
      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcription = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcription;
          } else {
            interimTranscript += transcription;
          }
        }
        const currentText = finalTranscript || interimTranscript;
        setTranscript(currentText);

        if (finalTranscript) {
          setFinalString(prevString => {
            const separator = prevString ? '... ' : '';
            return prevString + separator + finalTranscript;
          });
        }      
      };
      
      // Manejar errores
      recognitionRef.current.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
      };
      
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    }, []);
  
    const toggleListening = () => {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
      setIsListening(!isListening);
    };
  
    const toggleView = () => {
      console.log(finalstring);
      setIsView(!isView);
    };

    return (
      <div className={styles.transcriptionContainer}>
        <div className={styles.transcriptionText}>
          {transcript || ''}
        </div>
        <br/>
        <div className={styles.transcriptionText}>
         {isView ? finalstring : ''} 
        </div>

        <button onClick={toggleListening} className={`${styles.playButton} ${isListening ? styles.active : ''}`} type="button" aria-label="Iniciar">
          {isListening ? '⏹️' : '🎙️'}
        </button>
        <button onClick={toggleView} className={`${styles.playButton}`} type="button" aria-label="Ver">
          {isView ? '📕' : '📖'}
        </button>
      </div>
    );
  };

  export default SpeechTranscription;