// components/WebSocketConnection.js
import { useEffect, useRef } from 'react';

export default function WebSocketConnection({ 
  username, 
  onConnectionChange, 
  onMessage, 
  wsConnection,
  setWsConnection,
  shouldConnect
}) {
  const connectAttemptedRef = useRef(false);

  useEffect(() => {
    // Solo conectar cuando shouldConnect cambie a true y no hayamos intentado conectar antes
    if (shouldConnect && !connectAttemptedRef.current && !wsConnection) {
      connectAttemptedRef.current = true;
      connectToWS();
    }

    function connectToWS() {
      try {
        onConnectionChange('connecting');
        const ws = new WebSocket('ws://localhost:8080');
        
        ws.onopen = () => {
          console.log('Conectado al servidor WebSocket');
          onConnectionChange('connected');
          // Registrar usuario
          ws.send(JSON.stringify({
            type: 'register',
            username: username
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch (error) {
            console.error('Error al procesar mensaje:', error);
          }
        };

        ws.onclose = () => {
          onConnectionChange('disconnected');
          console.log('Desconectado del servidor WebSocket');
          setWsConnection(null);
          // Intentar reconectar después de un tiempo si todavía deberíamos estar conectados
          if (shouldConnect) {
            setTimeout(() => {
              connectToWS();
            }, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('Error en WebSocket:', error);
          onConnectionChange('disconnected');
        };

        setWsConnection(ws);
      } catch (error) {
        console.error('Error al conectar con WebSocket:', error);
        onConnectionChange('disconnected');
      }
    }

    return () => {
      if (wsConnection) {
        wsConnection.close();
        setWsConnection(null);
      }
    };
  }, [username, onConnectionChange, onMessage, wsConnection, setWsConnection, shouldConnect]);

  return null;
}