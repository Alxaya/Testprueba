import { describe, it, expect } from "vitest";
import { AppError, isAppError, notFound, invalid, conflict } from "./errors.js";

describe("AppError", () => {
  it("separa el mensaje interno del que ve el usuario", () => {
    const error = new AppError("no_encontrado", "No hemos encontrado esa cita.", {
      internalMessage: "appointment 7f3a no existe en organization 91b (consulta X)",
    });

    expect(error.publicMessage).toBe("No hemos encontrado esa cita.");
    expect(error.message).toContain("7f3a");
    // Lo que se envía al cliente es publicMessage, nunca message.
    expect(error.publicMessage).not.toContain("7f3a");
    expect(error.publicMessage).not.toContain("organization");
  });

  it("usa el mensaje público como interno cuando no se da uno", () => {
    const error = new AppError("conflicto", "Ese hueco ya está ocupado.");

    expect(error.message).toBe("Ese hueco ya está ocupado.");
  });

  it("asigna a cada código el estado HTTP correcto", () => {
    const casos = [
      ["no_autenticado", 401],
      ["sin_permiso", 403],
      ["no_encontrado", 404],
      ["datos_invalidos", 422],
      ["conflicto", 409],
      ["limite_excedido", 429],
      ["dependencia_caida", 503],
      ["presupuesto_agotado", 402],
    ] as const;

    for (const [code, status] of casos) {
      expect(new AppError(code, "x").httpStatus).toBe(status);
    }
  });

  it("conserva la causa original para poder depurar", () => {
    const causa = new Error("connection reset by peer");
    const error = new AppError("dependencia_caida", "Servicio no disponible.", { cause: causa });

    expect(error.cause).toBe(causa);
  });

  it("se reconoce a sí mismo y no confunde otros errores", () => {
    expect(isAppError(new AppError("conflicto", "x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ code: "conflicto", publicMessage: "x" })).toBe(false);
  });

  it("es capturable como Error normal", () => {
    expect(() => {
      throw new AppError("conflicto", "x");
    }).toThrow(Error);
  });
});

describe("atajos", () => {
  it("notFound compone un mensaje legible", () => {
    expect(notFound("esa cita").publicMessage).toBe("No se ha encontrado esa cita.");
  });

  it("invalid y conflict adjuntan detalles para el cliente", () => {
    expect(invalid("Falta el servicio.", { campo: "serviceId" }).details).toEqual({
      campo: "serviceId",
    });
    expect(conflict("Hueco ocupado.", { inicio: "2026-08-06T17:00:00Z" }).code).toBe("conflicto");
  });
});
