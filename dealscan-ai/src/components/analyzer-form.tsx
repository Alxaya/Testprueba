"use client";

import { useRef, useState } from "react";
import { ReportView } from "./report-view";
import type { AnalysisReport, ConditionKey } from "@/lib/valuation/types";
import { CONDITION_LABELS, CONDITION_ORDER } from "@/lib/valuation/types";

/**
 * Formulario de análisis. Acepta las tres entradas del producto —enlace, texto y
 * capturas— y muestra el informe en la misma página, sin recargar.
 *
 * Las imágenes se convierten a base64 en el navegador y se envían en el cuerpo
 * JSON: no se sube nada a almacenamiento intermedio.
 */

type Tab = "text" | "url" | "image";

interface AnalyzeResponse {
  id: string | null;
  report: AnalysisReport;
  warnings: string[];
  durationMs: number;
  saved: boolean;
  quota: {
    plan: string;
    limit: number | null;
    used: number;
    remaining: number | null;
    resetsAt: string;
  };
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function AnalyzerForm({
  isLoggedIn,
  quotaRemaining,
}: {
  isLoggedIn: boolean;
  quotaRemaining: number | null;
}) {
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [priceEur, setPriceEur] = useState("");
  const [condition, setCondition] = useState<ConditionKey | "">("");
  const [images, setImages] = useState<{ name: string; base64: string; mediaType: string; preview: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const hasInput = text.trim().length > 0 || url.trim().length > 0 || images.length > 0;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const accepted = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const next = [...images];

    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) {
        setError(`Puedes subir como máximo ${MAX_IMAGES} capturas.`);
        break;
      }
      if (!accepted.includes(file.type)) {
        setError(`«${file.name}» no es una imagen válida. Usa JPG, PNG, WEBP o GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`«${file.name}» pesa más de 5 MB. Reduce la imagen antes de subirla.`);
        continue;
      }
      const base64 = await fileToBase64(file);
      next.push({
        name: file.name,
        base64,
        mediaType: file.type,
        preview: `data:${file.type};base64,${base64}`,
      });
    }
    setImages(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasInput || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || null,
          url: url.trim() || null,
          images: images.map(({ base64, mediaType }) => ({ base64, mediaType })),
          priceEur: priceEur.trim() ? Number(priceEur.replace(",", ".")) : null,
          condition: condition || null,
          save: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se ha podido completar el análisis.");
        return;
      }

      setResult(data as AnalyzeResponse);
      // Desplazamiento al informe una vez pintado.
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("No se ha podido conectar con el servidor. Comprueba tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-4 sm:p-6">
        {/* Pestañas de entrada */}
        <div
          role="tablist"
          aria-label="Cómo quieres aportar el anuncio"
          className="flex gap-1 rounded-xl bg-surface-2 p-1"
        >
          {(
            [
              { id: "text", label: "Pegar texto" },
              { id: "url", label: "Enlace" },
              { id: "image", label: "Captura" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === item.id
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "text" && (
            <label className="block">
              <span className="text-sm font-medium text-text">Texto del anuncio</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                className="input-base mt-1.5 resize-y font-[inherit]"
                placeholder={
                  "Pega aquí el anuncio completo. Por ejemplo:\n\nVendo iPhone 14 Pro 256GB morado. Batería 89%. Buen estado, algún arañazo mínimo en el marco. Incluye caja y cargador. 620€. Entrega en mano en Madrid."
                }
              />
              <span className="mt-1.5 block text-xs text-text-muted">
                Cuanto más completo sea el texto, más preciso será el informe. Incluye el precio, la
                capacidad y el estado si aparecen.
              </span>
            </label>
          )}

          {tab === "url" && (
            <label className="block">
              <span className="text-sm font-medium text-text">Enlace del anuncio</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="input-base mt-1.5"
                placeholder="https://..."
                inputMode="url"
                autoComplete="off"
              />
              <span className="mt-1.5 block text-xs text-text-muted">
                Se descarga el contenido público del anuncio. Muchas plataformas cargan los datos
                con JavaScript y bloquean la lectura automática: si ocurre, pega el texto o sube una
                captura.
              </span>
            </label>
          )}

          {tab === "image" && (
            <div>
              <span className="text-sm font-medium text-text">Capturas del anuncio</span>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent-soft">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-8 w-8 text-text-muted"
                >
                  <path
                    d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="mt-2 text-sm font-semibold text-text">
                  Arrastra las capturas o pulsa para elegir
                </span>
                <span className="mt-0.5 text-xs text-text-muted">
                  JPG, PNG, WEBP o GIF · máximo {MAX_IMAGES} imágenes de 5 MB
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>

              {images.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {images.map((image, index) => (
                    <li key={index} className="group relative overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.preview}
                        alt={`Captura ${index + 1}: ${image.name}`}
                        className="aspect-4/3 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setImages(images.filter((_, i) => i !== index))}
                        className="absolute right-1 top-1 rounded-md bg-surface/90 px-1.5 py-0.5 text-xs font-bold text-bad shadow-sm"
                        aria-label={`Quitar ${image.name}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-2 text-xs text-text-muted">
                La lectura de imágenes requiere la integración de IA activa. Si no lo está, el
                informe lo indicará y podrás analizar el anuncio pegando su texto.
              </p>
            </div>
          )}
        </div>

        {/* Ajustes opcionales */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-text">
              Precio pedido <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <div className="relative mt-1.5">
              <input
                type="text"
                value={priceEur}
                onChange={(e) => setPriceEur(e.target.value.replace(/[^\d.,]/g, ""))}
                className="input-base pr-9"
                placeholder="620"
                inputMode="decimal"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                €
              </span>
            </div>
            <span className="mt-1 block text-xs text-text-muted">
              Solo si el anuncio no lo indica o quieres corregirlo.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-text">
              Estado real <span className="font-normal text-text-muted">(opcional)</span>
            </span>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as ConditionKey | "")}
              className="input-base mt-1.5"
            >
              <option value="">Detectar automáticamente</option>
              {CONDITION_ORDER.map((key) => (
                <option key={key} value={key}>
                  {CONDITION_LABELS[key]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-text-muted">
              Si has visto el producto, tu criterio manda sobre el del vendedor.
            </span>
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            {isLoggedIn
              ? quotaRemaining === null
                ? "Plan Premium · análisis ilimitados"
                : `Te quedan ${quotaRemaining} análisis hoy`
              : "Puedes probar sin cuenta. Regístrate gratis para guardar el historial."}
          </p>

          <button type="submit" disabled={!hasInput || loading} className="btn btn-primary">
            {loading ? (
              <>
                <span aria-hidden className="spin h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
                Analizando…
              </>
            ) : (
              "Analizar anuncio"
            )}
          </button>
        </div>
      </form>

      {/* Resultado */}
      <div ref={resultRef}>
        {loading && <AnalyzingSkeleton />}

        {result && !loading && (
          <div className="rise space-y-4">
            {result.warnings.length > 0 && (
              <div className="card border-warn/30 bg-warn-soft p-4">
                <p className="text-sm font-semibold text-text">Avisos sobre este análisis</p>
                <ul className="mt-2 space-y-1.5">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="text-xs leading-relaxed text-text-muted">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ReportView report={result.report} />

            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-xs text-text-muted">
                Analizado en {(result.durationMs / 1000).toFixed(1)} s ·{" "}
                {result.saved
                  ? "guardado en tu historial"
                  : isLoggedIn
                    ? "no guardado"
                    : "inicia sesión para guardarlo en tu historial"}
              </p>
              <div className="flex gap-2">
                {result.id && (
                  <a href={`/analisis/${result.id}`} className="btn btn-ghost !py-2 !text-sm">
                    Abrir informe completo
                  </a>
                )}
                {!isLoggedIn && (
                  <a href="/registro" className="btn btn-primary !py-2 !text-sm">
                    Crear cuenta gratis
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyzingSkeleton() {
  const steps = [
    "Leyendo el anuncio",
    "Identificando marca, modelo y capacidad",
    "Calculando el precio de mercado",
    "Buscando señales de estafa",
  ];
  return (
    <div className="card p-6" aria-live="polite">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="spin h-5 w-5 rounded-full border-2 border-accent border-t-transparent"
        />
        <p className="text-sm font-semibold text-text">Analizando el anuncio…</p>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step} className="flex items-center gap-2.5 text-sm text-text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent/50" />
            {step}
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-2">
        {[100, 85, 70].map((width) => (
          <div
            key={width}
            className="h-3 animate-pulse rounded bg-surface-2"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se ha podido leer la imagen."));
        return;
      }
      // Se elimina el prefijo "data:image/...;base64,".
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("No se ha podido leer la imagen."));
    reader.readAsDataURL(file);
  });
}
