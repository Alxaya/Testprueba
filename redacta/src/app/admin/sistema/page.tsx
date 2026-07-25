import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { features, env } from '@/lib/env';
import { JOBS } from '@/lib/jobs';
import { ActionForm } from '@/components/ui/ActionForm';
import { runJobAction, toggleFeatureFlagAction } from '@/app/actions/admin';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sistema' };
export const dynamic = 'force-dynamic';

/** Banderas conocidas por el producto. Se crean al activarlas por primera vez. */
const KNOWN_FLAGS = [
  { key: 'blog_autopilot', description: 'Publicacion automatica de articulos del calendario.' },
  { key: 'signup_open', description: 'Registro abierto al publico.' },
  { key: 'batch_generation', description: 'Generacion por lotes de catalogo (en desarrollo).' },
];

/** Estado de integraciones, ejecucion manual de trabajos y auditoria. */
export default async function AdminSystemPage() {
  await requireAdmin();

  const [flags, auditLog, emailStats] = await Promise.all([
    prisma.featureFlag.findMany(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.emailLog.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const flagByKey = new Map(flags.map((f) => [f.key, f]));

  const integrations = [
    { name: 'Base de datos (PostgreSQL)', ok: true, note: 'Si ves esta pagina, responde.' },
    { name: 'Motor de IA (Anthropic)', ok: features.ai, note: `Modelo: ${env.ANTHROPIC_MODEL}` },
    { name: 'Pagos (Stripe)', ok: features.stripe, note: 'Checkout, portal y webhook.' },
    { name: 'Email (Resend)', ok: features.email, note: 'Sin clave, los envios se simulan.' },
    { name: 'Acceso con Google', ok: features.googleAuth, note: 'Proveedor OAuth opcional.' },
    { name: 'Trabajos programados', ok: features.cron, note: 'Protegidos con CRON_SECRET.' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Sistema</h1>
        <p className="muted mt-1">Integraciones, automatizaciones y registro de actividad.</p>
      </header>

      {/* Integraciones */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Integraciones</h2>
        <ul className="surface divide-y">
          {integrations.map((integration) => (
            <li key={integration.name} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{integration.name}</p>
                <p className="muted text-xs">{integration.note}</p>
              </div>
              <span
                className={`badge ${
                  integration.ok
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                }`}
              >
                {integration.ok ? '✓ Configurada' : '○ Sin configurar'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Trabajos */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Trabajos programados</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(JOBS).map(([key, job]) => (
            <div key={key} className="surface p-5">
              <h3 className="font-medium">{job.label}</h3>
              <p className="muted mt-1 text-sm">{job.description}</p>
              <code className="muted mt-2 block text-xs">/api/cron/{key}</code>
              <div className="mt-4">
                <ActionForm
                  action={runJobAction}
                  submitLabel="Ejecutar ahora"
                  pendingLabel="Ejecutando…"
                  className="space-y-3"
                >
                  <input type="hidden" name="job" value={key} />
                </ActionForm>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Banderas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Banderas de funcionalidad</h2>
        <ul className="surface divide-y">
          {KNOWN_FLAGS.map((flag) => {
            const stored = flagByKey.get(flag.key);
            const enabled = stored?.enabled ?? false;
            return (
              <li key={flag.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    <code>{flag.key}</code>
                  </p>
                  <p className="muted text-xs">{flag.description}</p>
                </div>
                <form action={toggleFeatureFlagAction}>
                  <input type="hidden" name="key" value={flag.key} />
                  <button type="submit" className={`btn text-xs ${enabled ? 'btn-secondary' : 'btn-primary'}`}>
                    {enabled ? 'Desactivar' : 'Activar'}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Email */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Emails</h2>
        <div className="surface flex flex-wrap gap-6 p-5 text-sm">
          {emailStats.length === 0 ? (
            <p className="muted">Todavia no se ha enviado ningun email.</p>
          ) : (
            emailStats.map((stat) => (
              <div key={stat.status}>
                <p className="muted text-xs">{stat.status}</p>
                <p className="text-lg font-bold">{stat._count._all}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Auditoria */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Actividad reciente</h2>
        {auditLog.length === 0 ? (
          <div className="surface p-6">
            <p className="muted text-sm">Sin registros todavia.</p>
          </div>
        ) : (
          <ul className="surface divide-y text-sm">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span>
                  <code className="text-xs">{entry.action}</code>
                  {entry.target && <span className="muted text-xs"> · {entry.target}</span>}
                </span>
                <span className="muted text-xs">
                  {entry.actorMail ?? 'sistema'} · {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
