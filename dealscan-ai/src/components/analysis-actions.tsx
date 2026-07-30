"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Acciones sobre un informe: favorito, enlace público, exportación a PDF y
 * borrado. Todas informan del resultado, incluidos los límites del plan.
 */
export function AnalysisActions({
  analysisId,
  isFavorite: initialFavorite,
  favoriteNote,
  shareToken: initialToken,
  isPremium,
}: {
  analysisId: string;
  isFavorite: boolean;
  favoriteNote: string | null;
  shareToken: string | null;
  isPremium: boolean;
}) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [note, setNote] = useState(favoriteNote ?? "");
  const [showNote, setShowNote] = useState(false);
  const [shareToken, setShareToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/informe/${shareToken}`
    : null;

  async function toggleFavorite() {
    setBusy("favorite");
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/favorite`, {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(isFavorite ? {} : { body: JSON.stringify({ note: note.trim() || undefined }) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.error ?? "No se ha podido guardar.", tone: "error" });
        return;
      }
      setIsFavorite(!isFavorite);
      setShowNote(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function createShareLink() {
    setBusy("share");
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/share`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.error ?? "No se ha podido crear el enlace.", tone: "error" });
        return;
      }
      setShareToken(data.token);
      await copy(data.url);
    } finally {
      setBusy(null);
    }
  }

  async function revokeShareLink() {
    setBusy("share");
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/share`, { method: "DELETE" });
      if (!response.ok) {
        setMessage({ text: "No se ha podido revocar el enlace.", tone: "error" });
        return;
      }
      setShareToken(null);
      setMessage({ text: "Enlace revocado: ya no es accesible.", tone: "ok" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setMessage({ text: `Copia el enlace manualmente: ${url}`, tone: "ok" });
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/pdf`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage({
          text: data.error ?? "No se ha podido generar el PDF.",
          tone: "error",
        });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dealscan-informe-${analysisId.slice(0, 6)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("¿Seguro que quieres borrar este análisis? No se puede recuperar.")) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/analyses/${analysisId}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage({ text: "No se ha podido borrar el análisis.", tone: "error" });
        return;
      }
      router.push("/panel/historial");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => (isFavorite ? toggleFavorite() : setShowNote(!showNote))}
          disabled={busy !== null}
          className={`btn !py-2 !text-sm ${isFavorite ? "btn-primary" : "btn-ghost"}`}
        >
          {isFavorite ? "★ En favoritos" : "☆ Guardar en favoritos"}
        </button>

        {shareToken ? (
          <>
            <button
              type="button"
              onClick={() => shareUrl && copy(shareUrl)}
              className="btn btn-ghost !py-2 !text-sm"
            >
              {copied ? "✓ Enlace copiado" : "Copiar enlace público"}
            </button>
            <button
              type="button"
              onClick={revokeShareLink}
              disabled={busy !== null}
              className="btn btn-ghost !py-2 !text-sm"
            >
              Revocar enlace
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={createShareLink}
            disabled={busy !== null}
            className="btn btn-ghost !py-2 !text-sm"
          >
            {busy === "share" ? "Creando…" : "Compartir con un enlace"}
          </button>
        )}

        <button
          type="button"
          onClick={downloadPdf}
          disabled={busy !== null}
          className="btn btn-ghost !py-2 !text-sm"
          title={isPremium ? undefined : "La exportación en PDF está incluida en Premium"}
        >
          {busy === "pdf" ? "Generando…" : isPremium ? "Descargar PDF" : "Descargar PDF (Premium)"}
        </button>

        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="btn btn-ghost !ml-auto !py-2 !text-sm !text-bad"
        >
          Borrar
        </button>
      </div>

      {showNote && !isFavorite && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota opcional: «esperar a que baje», «llamar al vendedor»…"
            maxLength={500}
            className="input-base flex-1 !text-sm"
          />
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={busy !== null}
            className="btn btn-primary !py-2 !text-sm"
          >
            Guardar
          </button>
        </div>
      )}

      {shareUrl && (
        <p className="mt-3 break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-text-muted">
          {shareUrl}
        </p>
      )}

      {message && (
        <p
          role="alert"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.tone === "error" ? "bg-bad-soft text-bad" : "bg-accent-soft text-accent"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
