import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Las sondas no deben depender de que haya Postgres y Redis levantados para
// poder probarse: lo que verificamos aquí es el contrato de la ruta.
vi.mock("@recepta/db", () => ({
  checkDatabase: vi.fn(async () => ({ ok: true, latencyMs: 1 })),
  closeDatabase: vi.fn(async () => {}),
}));

vi.mock("@recepta/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@recepta/core")>();
  return { ...actual, checkRedis: vi.fn(async () => ({ ok: true, latencyMs: 1 })) };
});

describe("sondas de salud", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildServer } = await import("../server.js");
    app = await buildServer({ distributedRateLimit: false });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("responde a la sonda de vida sin tocar dependencias", async () => {
    const response = await app.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("responde a la sonda de disponibilidad con el detalle de cada dependencia", async () => {
    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      checks: { database: { ok: true }, redis: { ok: true } },
    });
  });

  it("devuelve 503 cuando una dependencia está caída, no 500", async () => {
    const { checkDatabase } = await import("@recepta/db");
    vi.mocked(checkDatabase).mockResolvedValueOnce({ ok: false, latencyMs: 9 });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json().status).toBe("degradado");
  });

  it("no filtra detalles internos en una ruta inexistente", async () => {
    const response = await app.inject({ method: "GET", url: "/no-existe" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "no_encontrado", message: "Ruta no encontrada." },
    });
  });
});
