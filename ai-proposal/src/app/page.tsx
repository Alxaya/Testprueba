/**
 * Página provisional de F0.
 *
 * Existe para que el proyecto compile, se despliegue y quede verificado el
 * circuito completo (tokens → Tailwind → build → CI). La landing real, con su
 * SEO y su sistema de animaciones, es F8.
 */
export default function HomePage() {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
        Fase 0 · Fundaciones
      </span>

      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        Presupuestos profesionales con IA en menos de 30 segundos
      </h1>

      <p className="text-pretty text-base leading-relaxed text-muted">
        Escribe una frase. La herramienta pregunta lo justo y genera el presupuesto completo, con
        materiales, mano de obra, garantía, impuestos y PDF listo para enviar.
      </p>

      <p className="text-sm text-subtle">
        Arquitectura y modelo de datos definidos. Interfaz en construcción.
      </p>
    </main>
  );
}
