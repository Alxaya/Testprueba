import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { getPlan } from '@/lib/plans';
import { ActionForm } from '@/components/ui/ActionForm';
import { createProjectAction, toggleProjectArchiveAction } from '@/app/actions/content';
import { formatDate, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Proyectos' };
export const dynamic = 'force-dynamic';

/** Los proyectos agrupan contenido por marca, cliente o campana. */
export default async function ProjectsPage() {
  const { organization } = await requireUserWithOrg();

  const projects = await prisma.project.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ archived: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { generations: true } } },
  });

  const plan = getPlan(organization.plan);
  const active = projects.filter((p) => !p.archived).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Proyectos</h1>
        <p className="muted mt-1">
          Agrupa el contenido por marca, cliente o campana. {active} de{' '}
          {pluralize(plan.limits.projects, 'proyecto activo', 'proyectos activos')} en tu plan{' '}
          {plan.name}.
        </p>
      </header>

      <div className="surface p-6">
        <h2 className="mb-4 font-semibold">Nuevo proyecto</h2>
        <ActionForm action={createProjectAction} submitLabel="Crear proyecto" pendingLabel="Creando…">
          <div>
            <label className="label" htmlFor="project-name">
              Nombre
            </label>
            <input
              id="project-name"
              name="name"
              className="field"
              required
              maxLength={60}
              placeholder="Campana de Navidad"
            />
          </div>
          <div>
            <label className="label" htmlFor="project-description">
              Descripcion <span className="muted font-normal">(opcional)</span>
            </label>
            <input
              id="project-description"
              name="description"
              className="field"
              maxLength={200}
              placeholder="Contenido para la campana de diciembre"
            />
          </div>
        </ActionForm>
      </div>

      {projects.length > 0 && (
        <ul className="surface divide-y">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {project.name}
                  {project.archived && <span className="badge muted">Archivado</span>}
                </p>
                <p className="muted mt-0.5 text-xs">
                  {pluralize(project._count.generations, 'pieza')} · creado el{' '}
                  {formatDate(project.createdAt)}
                  {project.description && ` · ${project.description}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/app/biblioteca?q=${encodeURIComponent(project.name)}`}
                  className="btn btn-ghost text-xs"
                >
                  Ver contenido
                </Link>
                <form action={toggleProjectArchiveAction}>
                  <input type="hidden" name="id" value={project.id} />
                  <button type="submit" className="btn btn-secondary text-xs">
                    {project.archived ? 'Reactivar' : 'Archivar'}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
