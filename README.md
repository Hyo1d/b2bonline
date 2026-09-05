# RemoteB2B — servidor

Servidor de rooms y señalización WebRTC para la app RemoteB2B de Windows. Máximo dos DJs por room; audio P2P, sin transportar audio por este backend.

## Render Free

Este repositorio contiene `render.yaml` y `deploy/Dockerfile`. Crear el servicio desde un Blueprint de Render conectado a este repositorio, o mediante su API. El servicio escucha en `0.0.0.0` y usa el puerto indicado por `PORT`.

Cuando el deploy esté activo, verificar `https://TU-SERVICIO.onrender.com/health`. Debe responder `{"ok":true,"version":1}`. Configurar la URL base HTTPS (sin `/health`) en RemoteB2B. Compartir la invitación desde la app; el invitado abre el exe y selecciona **Pegar invitación y unirme**.

Render Free puede suspender el servicio por inactividad y tardar alrededor de un minuto en despertar. Reiniciar elimina las rooms en memoria; se debe crear una nueva room.

## Conectividad

Este servicio ofrece HTTP/WebSocket y STUN. Si la conexión directa entre los DJs no es posible, hace falta TURN externo. Para coturn con autenticación HMAC, configurar `TURN_URL` y `TURN_SECRET` como secretos de entorno en Render. Nunca subir claves al repositorio. Render no aloja el relay UDP de coturn.

## Implementación

Node 24, TypeScript, ws; build Docker con esbuild. Endpoints `POST /rooms`, `POST /rooms/:code/join`, `GET /health` y WebSocket `/ws`. Tokens de reserva, máximo dos peers, límites de payload/rate, reconexión y autoridad de tempo.

Licencia GPL-2.0-or-later; ver LICENSE. Documentación de hosting: https://render.com/docs/free y https://render.com/docs/websocket .
