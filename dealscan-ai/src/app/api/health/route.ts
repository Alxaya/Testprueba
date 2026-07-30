import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasAI, hasStripe } from "@/lib/env";
import { ENGINE_VERSION } from "@/lib/valuation/engine";

/**
 * Comprobación de salud para el orquestador (Docker, Kubernetes, balanceador).
 *
 * Devuelve 200 solo si la base de datos responde. Informa además de qué
 * integraciones opcionales están configuradas, sin exponer ninguna credencial.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  try {
    // Consulta mínima: confirma que la conexión está viva sin cargar la base.
    await prisma.$queryRaw`SELECT 1`;
    const references = await prisma.productReference.count();

    return NextResponse.json(
      {
        status: "ok",
        database: "up",
        databaseLatencyMs: Date.now() - started,
        catalogReferences: references,
        engineVersion: ENGINE_VERSION,
        integrations: {
          ai: hasAI() ? "configured" : "not_configured",
          stripe: hasStripe() ? "configured" : "not_configured",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[dealscan] health check fallido:", error);
    return NextResponse.json(
      { status: "error", database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
