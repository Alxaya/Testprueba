// Cliente de la API oficial de TikTok (open.tiktokapis.com, v2)
// Gestiona OAuth 2.0, refresco automático de tokens y las llamadas a la API.

import fs from "node:fs";
import path from "node:path";

const API_BASE = "https://open.tiktokapis.com";
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";

const TOKEN_PATH = process.env.TOKEN_STORE_PATH || "./data/tokens.json";

export const config = {
  clientKey: process.env.TIKTOK_CLIENT_KEY || "",
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
  scopes: process.env.TIKTOK_SCOPES || "user.info.basic,user.info.stats,video.list",
  baseUrl: (process.env.BASE_URL || "").replace(/\/$/, ""),
};

// ── Almacén de tokens ────────────────────────────────────────────────────────

let tokens = null;

function loadTokens() {
  if (tokens) return tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  } catch {
    tokens = null;
  }
  return tokens;
}

function saveTokens(t) {
  tokens = t;
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2));
}

export function authStatus() {
  const t = loadTokens();
  if (!t) return { authorized: false };
  return {
    authorized: true,
    open_id: t.open_id,
    scopes: t.scope,
    access_token_expires_at: new Date(t.access_expires_at).toISOString(),
    refresh_token_expires_at: new Date(t.refresh_expires_at).toISOString(),
  };
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export function buildAuthUrl(state) {
  const p = new URLSearchParams({
    client_key: config.clientKey,
    scope: config.scopes,
    response_type: "code",
    redirect_uri: `${config.baseUrl}/auth/callback`,
    state,
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(params) {
  const res = await fetch(`${API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`OAuth error: ${data.error || res.status} ${data.error_description || ""}`);
  }
  const now = Date.now();
  saveTokens({
    ...data,
    access_expires_at: now + data.expires_in * 1000,
    refresh_expires_at: now + data.refresh_expires_in * 1000,
  });
  return data;
}

export async function exchangeCode(code) {
  return tokenRequest({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: `${config.baseUrl}/auth/callback`,
  });
}

async function accessToken() {
  const t = loadTokens();
  if (!t) {
    throw new Error(
      `No hay sesión de TikTok. Visita ${config.baseUrl}/auth/start para autorizar la cuenta.`
    );
  }
  // refresca con 5 minutos de margen
  if (Date.now() > t.access_expires_at - 5 * 60 * 1000) {
    await tokenRequest({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
    });
  }
  return loadTokens().access_token;
}

// ── Llamadas a la API ────────────────────────────────────────────────────────

async function api(pathname, { method = "GET", query, body } = {}) {
  const token = await accessToken();
  const url = new URL(API_BASE + pathname);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  const err = data?.error;
  if (err && err.code && err.code !== "ok") {
    throw new Error(`TikTok API ${pathname}: ${err.code} — ${err.message || ""}`);
  }
  return data.data ?? data;
}

// solo campos cubiertos por user.info.basic + user.info.stats
// (bio_description, profile_deep_link e is_verified exigirían user.info.profile)
const USER_FIELDS =
  "open_id,union_id,avatar_url,display_name," +
  "follower_count,following_count,likes_count,video_count";

const VIDEO_FIELDS =
  "id,create_time,title,video_description,duration,cover_image_url,share_url," +
  "view_count,like_count,comment_count,share_count";

export function getProfile() {
  return api("/v2/user/info/", { query: { fields: USER_FIELDS } });
}

export function listVideos(maxCount = 10, cursor) {
  return api("/v2/video/list/", {
    method: "POST",
    query: { fields: VIDEO_FIELDS },
    body: { max_count: Math.min(maxCount, 20), ...(cursor ? { cursor } : {}) },
  });
}

export function queryVideos(videoIds) {
  return api("/v2/video/query/", {
    method: "POST",
    query: { fields: VIDEO_FIELDS },
    body: { filters: { video_ids: videoIds.slice(0, 20) } },
  });
}

export function getCreatorInfo() {
  return api("/v2/post/publish/creator_info/query/", { method: "POST", body: {} });
}

// Publica un video desde una URL pública (PULL_FROM_URL).
// Requiere el scope video.publish y que la app haya pasado la auditoría de
// TikTok; sin auditar, los posts quedan solo visibles para el propio usuario.
export function postVideo({ videoUrl, title, privacyLevel = "SELF_ONLY" }) {
  return api("/v2/post/publish/video/init/", {
    method: "POST",
    body: {
      post_info: {
        title,
        privacy_level: privacyLevel,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    },
  });
}

// Sube un video a los BORRADORES del usuario (inbox upload). Funciona en
// sandbox con el scope video.upload: el usuario recibe una notificación en
// TikTok y completa la publicación (caption + botón publicar) desde la app.
export async function uploadDraft({ videoUrl }) {
  const vres = await fetch(videoUrl);
  if (!vres.ok) throw new Error(`No pude descargar el video (${vres.status}): ${videoUrl}`);
  const buf = Buffer.from(await vres.arrayBuffer());
  const tipo = vres.headers.get("content-type") || "";
  if (tipo.includes("text/html")) {
    throw new Error("La URL devuelve una página web, no un mp4 — usa un enlace directo al archivo");
  }
  return uploadDraftBuffer(buf);
}

// Igual que uploadDraft pero recibiendo los bytes del video directamente.
export async function uploadDraftBuffer(buf) {
  const size = buf.length;
  if (size > 64 * 1024 * 1024) throw new Error("Video de más de 64 MB: trocéalo o comprímelo");

  const init = await api("/v2/post/publish/inbox/video/init/", {
    method: "POST",
    body: {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    },
  });

  const up = await fetch(init.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${size - 1}/${size}`,
      "Content-Length": String(size),
    },
    body: buf,
  });
  if (!up.ok) throw new Error(`Fallo subiendo a TikTok (${up.status}): ${await up.text()}`);

  return {
    publish_id: init.publish_id,
    estado: "enviado a tus borradores de TikTok",
    siguiente_paso:
      "Abre la app de TikTok: te llegará una notificación para completar la publicación (añade el caption y publica).",
  };
}

export function postStatus(publishId) {
  return api("/v2/post/publish/status/fetch/", {
    method: "POST",
    body: { publish_id: publishId },
  });
}
