# Instrucciones de Ejecución

## Iniciar los servidores de comunicación

Para iniciar los servidores de comunicación, sigue estos pasos:

1. Abre una terminal y navega a la carpeta `server`:

```bash
cd server
```

2. Inicia el servidor Socket.IO:

```bash
node socket.js
```

Este servidor se ejecutará en el puerto 3030 por defecto.

3. Abre otra terminal, navega a la carpeta `server` y ejecuta el servidor WebSocket:

```bash
node websocket.js
```

Este servidor se ejecutará en el puerto 3050 por defecto.

## Iniciar la aplicación web

1. Abre una nueva terminal en la carpeta raíz del proyecto y ejecuta:

```bash
npm run dev
```

2. Abre tu navegador y visita:

```
http://localhost:3000
```

La aplicación debería estar funcionando correctamente con ambos servidores de comunicación activos.