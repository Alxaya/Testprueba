// Servidor MCP remoto para TikTok — transporte Streamable HTTP (Claude Web).
//
// Rutas:
//   POST {prefijo}/mcp       → endpoint MCP (Claude Web se conecta aquí)
//   GET  /auth/start          → inicia el OAuth de TikTok (visítala tú en el navegador)
//   GET  /auth/callback       → redirect_uri del OAuth
//   GET  /                    → página de estado
//
// Si defines MCP_PATH_SECRET, el endpoint MCP pasa a ser /<secreto>/mcp para
// que nadie más pueda usar tu servidor (Claude Web no envía cabeceras custom).

import crypto from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./tools.js";
import { authStatus, buildAuthUrl, exchangeCode, config, uploadDraftBuffer } from "./tiktok.js";

const app = express();
app.use(express.json({ limit: "4mb" }));

const PORT = process.env.PORT || 3000;
const prefix = process.env.MCP_PATH_SECRET ? `/${process.env.MCP_PATH_SECRET}` : "";

// ── Endpoint MCP (stateless: un transporte por petición) ─────────────────────

app.post(`${prefix}/mcp`, async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP error:", e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// El transporte stateless no mantiene sesiones: GET/DELETE no aplican.
const notAllowed = (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
app.get(`${prefix}/mcp`, notAllowed);
app.delete(`${prefix}/mcp`, notAllowed);

// ── Subida directa de borradores ─────────────────────────────────────────────
// POST {prefijo}/subir-borrador con el mp4 como cuerpo (Content-Type: video/mp4)
// → lo envía a los borradores de TikTok sin depender de hosts externos.

app.post(
  `${prefix}/subir-borrador`,
  express.raw({ type: ["video/mp4", "application/octet-stream"], limit: "80mb" }),
  async (req, res) => {
    try {
      if (!req.body || !req.body.length) throw new Error("Cuerpo vacío: envía el mp4 como body");
      res.json(await uploadDraftBuffer(req.body));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ── OAuth de TikTok ──────────────────────────────────────────────────────────

const pendingStates = new Map(); // state → timestamp

app.get("/auth/start", (_req, res) => {
  if (!config.clientKey || !config.clientSecret || !config.baseUrl) {
    return res
      .status(500)
      .send("Faltan TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET o BASE_URL en las variables de entorno.");
  }
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, Date.now());
  // limpia estados de más de 10 minutos
  for (const [s, t] of pendingStates) if (Date.now() - t > 600000) pendingStates.delete(s);
  res.redirect(buildAuthUrl(state));
});

app.get("/auth/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(`TikTok devolvió un error: ${error} ${error_description || ""}`);
  if (!state || !pendingStates.has(state)) return res.status(400).send("State inválido o caducado. Vuelve a /auth/start");
  pendingStates.delete(state);
  try {
    await exchangeCode(code);
    res.send(
      "<h2>✅ Cuenta de TikTok conectada</h2><p>Ya puedes cerrar esta pestaña y usar las herramientas desde Claude.</p>"
    );
  } catch (e) {
    res.status(500).send(`Error intercambiando el código: ${e.message}`);
  }
});

// ── Verificación de dominio de TikTok ────────────────────────────────────────
// Define en Railway: TIKTOK_VERIFY_FILE (ej. tiktokAbCd123.txt) y
// TIKTOK_VERIFY_CONTENT (el contenido que te dé el portal). El servidor
// servirá https://tu-dominio/<TIKTOK_VERIFY_FILE> para pasar la verificación.

if (process.env.TIKTOK_VERIFY_FILE && process.env.TIKTOK_VERIFY_CONTENT) {
  app.get(`/${process.env.TIKTOK_VERIFY_FILE}`, (_req, res) => {
    res.type("text/plain").send(process.env.TIKTOK_VERIFY_CONTENT);
  });
}

// Genérico: el contenido de los archivos de verificación de TikTok es siempre
// "tiktok-developers-site-verification=<firma>", con la firma incluida en el
// propio nombre del archivo — así respondemos a todas las verificaciones
// (producción, sandbox y futuras) sin configurar nada.
app.get(/^\/tiktok([A-Za-z0-9]+)\.txt$/, (req, res) => {
  res.type("text/plain").send(`tiktok-developers-site-verification=${req.params[0]}`);
});

// ── Página de estado ─────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  const st = authStatus();
  res.json({
    name: "tiktok-mcp",
    mcp_endpoint: `${config.baseUrl || ""}${prefix}/mcp`,
    tiktok_authorized: st.authorized,
    ...(st.authorized ? { open_id: st.open_id, scopes: st.scopes } : { authorize_at: `${config.baseUrl}/auth/start` }),
  });
});

app.listen(PORT, () => {
  console.log(`tiktok-mcp escuchando en :${PORT} — endpoint MCP: ${prefix}/mcp`);
});
