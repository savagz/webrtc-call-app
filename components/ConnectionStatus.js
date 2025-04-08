// components/ConnectionStatus.js
export default function ConnectionStatus({ status }) {
    return (
      <div className="connectionStatus">
        {status === 'connecting' && <p>Conectando al servidor... ⌛</p>}
        {status === 'connected' && <p>Conectado al servidor ✅</p>}
        {status === 'disconnected' && <p>Desconectado del servidor ❌</p>}
      </div>
    );
  }