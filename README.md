# B2B Online — servidor RemoteB2B

Backend de rooms y señalización WebRTC. Máximo dos DJs por room. El audio viaja P2P; este servidor no captura ni reproduce audio y no incluye Electron.

## Render Free (Node)

- Build Command: `npm ci` (también admite `npm install`).
- Start Command: `npm start` (también admite `node build/main.cjs`).
- Health Check: `/health`.
- Root Directory: vacío.

La instalación ejecuta postinstall y compila el servidor a `build/main.cjs`, compatible con el comando ya configurado en Render. El proceso escucha en `0.0.0.0` y usa `PORT` de Render. Se conserva un Dockerfile alternativo.

Después del deploy, https://b2bonline.onrender.com/health debe devolver `{"ok":true,"version":1}`. Configurar https://b2bonline.onrender.com en la app de Windows y compartir la invitación desde allí. Los DJs sólo abren el exe.

Render Free puede suspender el servicio por inactividad; al reiniciarse se pierden las rooms en memoria. Si las redes no permiten P2P, hace falta un relay TURN externo. Para coturn con autenticación HMAC, configurar `TURN_URL` y `TURN_SECRET` en las variables secretas del servicio. No subir credenciales al repositorio.

Node >=22.12; dependencias de servidor: ws y esbuild. GPL-2.0-or-later; ver LICENSE.
