// Definición de las herramientas MCP que expone el servidor.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as tiktok from "./tiktok.js";

const json = (data) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const fail = (e) => ({
  content: [{ type: "text", text: `Error: ${e.message}` }],
  isError: true,
});

export function buildServer() {
  const server = new McpServer({ name: "tiktok-mcp", version: "1.0.0" });

  server.registerTool(
    "tiktok_auth_status",
    {
      title: "Estado de autorización",
      description:
        "Comprueba si hay una cuenta de TikTok autorizada y cuándo caducan sus tokens.",
      inputSchema: {},
    },
    async () => {
      try {
        return json(tiktok.authStatus());
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_profile",
    {
      title: "Perfil de la cuenta",
      description:
        "Devuelve el perfil de la cuenta autorizada: nombre, seguidores, likes totales y número de videos.",
      inputSchema: {},
    },
    async () => {
      try {
        return json(await tiktok.getProfile());
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_list_videos",
    {
      title: "Listar videos",
      description:
        "Lista los últimos videos de la cuenta con sus métricas (vistas, likes, comentarios, compartidos).",
      inputSchema: {
        max_count: z.number().int().min(1).max(20).default(10)
          .describe("Cuántos videos devolver (máx. 20)"),
        cursor: z.number().optional()
          .describe("Cursor de paginación devuelto por la llamada anterior"),
      },
    },
    async ({ max_count, cursor }) => {
      try {
        return json(await tiktok.listVideos(max_count, cursor));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_video_stats",
    {
      title: "Métricas de videos concretos",
      description: "Devuelve las métricas de hasta 20 videos por su ID.",
      inputSchema: {
        video_ids: z.array(z.string()).min(1).max(20)
          .describe("IDs de los videos a consultar"),
      },
    },
    async ({ video_ids }) => {
      try {
        return json(await tiktok.queryVideos(video_ids));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_creator_info",
    {
      title: "Información de publicación",
      description:
        "Consulta las opciones de publicación del creador (niveles de privacidad disponibles, duración máxima, si puede publicar ahora).",
      inputSchema: {},
    },
    async () => {
      try {
        return json(await tiktok.getCreatorInfo());
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_post_video",
    {
      title: "Publicar video",
      description:
        "Publica un video en la cuenta desde una URL pública de video (mp4). Requiere el scope video.publish. " +
        "OJO: hasta que TikTok audite la app, los posts se crean con visibilidad SELF_ONLY (solo tú los ves).",
      inputSchema: {
        video_url: z.string().url()
          .describe("URL pública y directa del .mp4 (dominio verificado en TikTok Developers)"),
        title: z.string().max(2200)
          .describe("Descripción/caption del video, puede incluir hashtags"),
        privacy_level: z
          .enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"])
          .default("SELF_ONLY")
          .describe("Visibilidad del post (apps sin auditar: solo SELF_ONLY)"),
      },
    },
    async ({ video_url, title, privacy_level }) => {
      try {
        return json(await tiktok.postVideo({ videoUrl: video_url, title, privacyLevel: privacy_level }));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_upload_draft",
    {
      title: "Subir video a borradores",
      description:
        "Sube un video (desde una URL pública de mp4) a los BORRADORES de la cuenta de TikTok. " +
        "El usuario completa la publicación desde la app (caption + publicar). " +
        "Funciona en sandbox con el scope video.upload, sin auditoría.",
      inputSchema: {
        video_url: z.string().url().describe("URL pública y directa del archivo .mp4 (máx. 64 MB)"),
      },
    },
    async ({ video_url }) => {
      try {
        return json(await tiktok.uploadDraft({ videoUrl: video_url }));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "tiktok_post_status",
    {
      title: "Estado de una publicación",
      description: "Consulta el estado de un post iniciado con tiktok_post_video (publish_id).",
      inputSchema: {
        publish_id: z.string().describe("El publish_id devuelto por tiktok_post_video"),
      },
    },
    async ({ publish_id }) => {
      try {
        return json(await tiktok.postStatus(publish_id));
      } catch (e) {
        return fail(e);
      }
    }
  );

  return server;
}
