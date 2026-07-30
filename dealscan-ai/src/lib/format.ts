import { CONDITION_LABELS, VERDICT_LABELS, type AnalysisReport, type ConditionKey, type Verdict } from "./valuation/types";
import { formatEuros } from "./money";

/** Formateo compartido entre servidor y cliente (sin dependencias de Node). */

export function eur(cents: number, options: { decimals?: boolean } = {}): string {
  return formatEuros(cents, { decimals: options.decimals ? 2 : 0 });
}

export function storage(gb: number | null): string | null {
  if (gb == null) return null;
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

export function conditionLabel(condition: ConditionKey | null): string {
  return condition ? CONDITION_LABELS[condition] : "Estado sin determinar";
}

export function verdictLabel(verdict: Verdict): string {
  return VERDICT_LABELS[verdict];
}

/** Paleta semántica del veredicto, en clases de utilidad. */
export function verdictTone(verdict: Verdict): {
  text: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (verdict) {
    case "CHOLLO":
      return {
        text: "text-good",
        bg: "bg-good-soft",
        border: "border-good/30",
        label: "Chollo",
      };
    case "CORRECTO":
      return {
        text: "text-accent",
        bg: "bg-accent-soft",
        border: "border-accent/30",
        label: "Precio correcto",
      };
    case "CARO":
      return {
        text: "text-warn",
        bg: "bg-warn-soft",
        border: "border-warn/30",
        label: "Caro",
      };
    case "ESTAFA_PROBABLE":
      return {
        text: "text-bad",
        bg: "bg-bad-soft",
        border: "border-bad/30",
        label: "Posible estafa",
      };
    case "SIN_VALORAR":
      return {
        text: "text-text-muted",
        bg: "bg-surface-2",
        border: "border-border",
        label: "Sin valorar",
      };
  }
}

export function scoreTone(score: number): string {
  if (score >= 75) return "text-good";
  if (score >= 55) return "text-accent";
  if (score >= 35) return "text-warn";
  return "text-bad";
}

export function riskTone(risk: number): string {
  if (risk >= 60) return "text-bad";
  if (risk >= 30) return "text-warn";
  return "text-good";
}

export function severityTone(severity: string): { bg: string; text: string; label: string } {
  switch (severity) {
    case "critical":
      return { bg: "bg-bad-soft", text: "text-bad", label: "Crítico" };
    case "high":
      return { bg: "bg-bad-soft", text: "text-bad", label: "Alto" };
    case "medium":
      return { bg: "bg-warn-soft", text: "text-warn", label: "Medio" };
    case "low":
      return { bg: "bg-surface-2", text: "text-text-muted", label: "Bajo" };
    default:
      return { bg: "bg-accent-soft", text: "text-accent", label: "Info" };
  }
}

export function productTitle(report: AnalysisReport): string {
  const parts = [report.product.brand, report.product.model].filter(Boolean);
  const name = parts.join(" ");
  const cap = storage(report.product.storageGb);
  return [name || "Producto sin identificar", cap].filter(Boolean).join(" · ");
}

export function relativeDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - value.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return value.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function fullDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
}
