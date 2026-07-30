"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Formulario de acceso y registro. Comparte la misma implementación para que el
 * comportamiento (errores, foco, estados de carga) sea idéntico en ambos casos.
 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const wantsPremium = params.get("plan") === "premium";
  const nextPath = params.get("next");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { email, password, ...(name.trim() ? { name: name.trim() } : {}) }
            : { email, password },
        ),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se ha podido completar la operación.");
        return;
      }

      // Tras registrarse queriendo Premium, se va directo a la suscripción.
      const destination =
        nextPath && nextPath.startsWith("/")
          ? nextPath
          : wantsPremium
            ? "/panel/suscripcion"
            : "/panel";

      router.push(destination);
      router.refresh();
    } catch {
      setError("No se ha podido conectar con el servidor. Comprueba tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-7">
      <h1 className="text-xl font-bold tracking-tight">
        {isRegister ? "Crear tu cuenta" : "Iniciar sesión"}
      </h1>
      <p className="mt-1.5 text-sm text-text-muted">
        {isRegister
          ? "Gratis, con 5 análisis al día y sin tarjeta."
          : "Accede a tu historial, favoritos y comparaciones."}
      </p>

      {isRegister && wantsPremium && (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-text">
          Crea la cuenta y te llevamos directo a la contratación de Premium.
        </p>
      )}

      <div className="mt-5 space-y-4">
        {isRegister && (
          <label className="block">
            <span className="text-sm font-medium">
              Nombre <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-base mt-1.5"
              autoComplete="name"
              maxLength={80}
            />
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium">Correo electrónico</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base mt-1.5"
            autoComplete="email"
            inputMode="email"
            autoFocus={!isRegister}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base mt-1.5"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 10 : 1}
          />
          {isRegister && (
            <span className="mt-1.5 block text-xs text-text-muted">
              Mínimo 10 caracteres, con al menos una letra y un número.
            </span>
          )}
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary mt-5 w-full">
        {loading
          ? isRegister
            ? "Creando cuenta…"
            : "Entrando…"
          : isRegister
            ? "Crear cuenta"
            : "Entrar"}
      </button>

      <p className="mt-4 text-center text-sm text-text-muted">
        {isRegister ? (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link href="/entrar" className="font-semibold text-accent hover:underline">
              Inicia sesión
            </Link>
          </>
        ) : (
          <>
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-accent hover:underline">
              Créala gratis
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
