# tiktok-mcp — Servidor MCP remoto para TikTok

Servidor MCP (Model Context Protocol) en Node.js que conecta Claude Web con la
**API oficial de TikTok**: perfil, métricas de videos y publicación de contenido.
Transporte Streamable HTTP, listo para desplegar en Railway.

## Herramientas que expone

| Herramienta | Qué hace | Scope necesario |
|---|---|---|
| `tiktok_auth_status` | Estado de la sesión OAuth | — |
| `tiktok_profile` | Seguidores, likes totales, nº de videos | `user.info.basic`, `user.info.stats` |
| `tiktok_list_videos` | Últimos videos con vistas/likes/comentarios/compartidos | `video.list` |
| `tiktok_video_stats` | Métricas de hasta 20 videos por ID | `video.list` |
| `tiktok_creator_info` | Opciones de publicación del creador | `video.publish` |
| `tiktok_post_video` | Publica un video desde una URL pública (mp4) | `video.publish` |
| `tiktok_post_status` | Estado de una publicación en curso | `video.publish` |

## 1. Crear la app en TikTok for Developers

1. Entra en <https://developers.tiktok.com> → **Manage apps** → **Connect an app**.
2. Añade los productos **Login Kit** y (si quieres publicar) **Content Posting API**.
3. Añade los scopes: `user.info.basic`, `user.info.stats`, `video.list`
   (+ `video.publish` para publicar).
4. En Login Kit → **Redirect URI**, registra exactamente:
   `https://TU-DOMINIO-RAILWAY/auth/callback`
5. Copia el **Client key** y el **Client secret**.

> ⚠️ **Sobre publicar videos**: hasta que TikTok apruebe tu app en su auditoría,
> la Content Posting API solo permite posts con visibilidad `SELF_ONLY`
> (solo los ve tu propia cuenta) y la URL del video debe estar en un
> **dominio verificado** en el portal. Las herramientas de lectura
> (perfil y métricas) funcionan sin auditoría con la app en modo sandbox
> (añade tu cuenta como "target user" del sandbox).

## 2. Desplegar en Railway

1. Sube esta carpeta a un repositorio de GitHub (o usa este mismo).
2. En <https://railway.app>: **New Project → Deploy from GitHub repo** y elige el
   repo (si el servidor está en una subcarpeta, configura `Root Directory = tiktok-mcp`).
3. En **Variables**, añade (ver `.env.example`):
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - `TIKTOK_SCOPES` (opcional)
   - `BASE_URL` → la URL pública que te da Railway (Settings → Networking →
     Generate Domain), sin barra final
   - `MCP_PATH_SECRET` → una cadena aleatoria larga (recomendado)
   - `TOKEN_STORE_PATH=/data/tokens.json` si añades un volumen
4. (Recomendado) **Add Volume** montado en `/data` para que la sesión OAuth
   sobreviva a los redeploys.
5. Deploy. Comprueba `https://TU-DOMINIO/` — debe responder un JSON de estado.

## 3. Autorizar tu cuenta de TikTok

Abre en el navegador:

```
https://TU-DOMINIO/auth/start
```

Inicia sesión en TikTok y acepta. Verás "✅ Cuenta de TikTok conectada".
El token se refresca solo a partir de ahí.

## 4. Conectar a Claude Web

1. En claude.ai → **Settings → Connectors → Add custom connector**.
2. URL del servidor:
   - sin secreto: `https://TU-DOMINIO/mcp`
   - con `MCP_PATH_SECRET`: `https://TU-DOMINIO/<tu-secreto>/mcp`
3. Guarda. Las herramientas `tiktok_*` aparecerán disponibles en la conversación.

Ejemplos de lo que puedes pedirle a Claude una vez conectado:

- «¿Cuántos seguidores tengo ahora mismo?»
- «Lista mis últimos 10 videos con sus vistas y dime cuál retiene mejor»
- «Compara las métricas de estos dos videos: …»

## Desarrollo local

```bash
cp .env.example .env   # rellena tus claves
npm install
npm run dev
# MCP en http://localhost:3000/mcp  (Claude Web necesita una URL pública)
```

## Estructura

```
tiktok-mcp/
├── package.json
├── railway.json          # configuración de despliegue de Railway
├── .env.example          # variables de entorno documentadas
├── .gitignore
└── src/
    ├── index.js          # Express + transporte MCP Streamable HTTP + OAuth
    ├── tools.js          # definición de las herramientas MCP
    └── tiktok.js         # cliente de la API oficial de TikTok (OAuth + llamadas)
```

## Seguridad

- Usa siempre `MCP_PATH_SECRET`: el endpoint MCP no tiene otra autenticación
  (Claude Web no envía cabeceras personalizadas sin OAuth).
- Nunca subas `.env` ni `data/tokens.json` al repositorio (ya están en `.gitignore`).
- El `client_secret` de TikTok solo vive en las variables de Railway.
