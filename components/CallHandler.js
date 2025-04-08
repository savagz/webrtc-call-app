import { useEffect, useState } from 'react';

export default function CallHandler({ onError }) {
  const [mediaStream, setMediaStream] = useState(null);

  const initializeMedia = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia no está soportado en este navegador');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      
      setMediaStream(stream);
      return stream;
    } catch (error) {
      onError(error.message);
      return null;
    }
  };

  useEffect(() => {
    initializeMedia();
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return null;
}