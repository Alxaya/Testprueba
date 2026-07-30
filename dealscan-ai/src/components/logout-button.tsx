"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // `refresh` recarga los componentes de servidor: la cabecera vuelve al
      // estado de visitante sin necesidad de recargar la página completa.
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="btn btn-ghost !py-2 !text-sm"
    >
      {loading ? "Saliendo…" : "Salir"}
    </button>
  );
}
