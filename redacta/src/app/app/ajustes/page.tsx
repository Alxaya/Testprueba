import type { Metadata } from 'next';
import { requireUserWithOrg } from '@/lib/session';
import { ActionForm } from '@/components/ui/ActionForm';
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
} from '@/app/actions/account';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Ajustes' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user, organization } = await requireUserWithOrg();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="muted mt-1">Tus datos, tu contrasena y tu cuenta.</p>
      </header>

      {/* Datos basicos */}
      <section className="surface p-6">
        <h2 className="mb-4 font-semibold">Datos de la cuenta</h2>
        <ActionForm action={updateProfileAction} submitLabel="Guardar cambios">
          <div>
            <label className="label" htmlFor="name">
              Tu nombre
            </label>
            <input id="name" name="name" className="field" defaultValue={user.name ?? ''} required maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="organizationName">
              Nombre del negocio
            </label>
            <input
              id="organizationName"
              name="organizationName"
              className="field"
              defaultValue={organization.name}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" className="field" defaultValue={user.email} disabled />
            <p className="muted mt-1.5 text-xs">
              El email identifica la cuenta y no puede cambiarse desde aqui. Escribenos si lo
              necesitas.
            </p>
          </div>
        </ActionForm>
      </section>

      {/* Contrasena */}
      <section className="surface p-6">
        <h2 className="mb-4 font-semibold">Cambiar contrasena</h2>
        <ActionForm action={changePasswordAction} submitLabel="Actualizar contrasena">
          <div>
            <label className="label" htmlFor="current">
              Contrasena actual
            </label>
            <input
              id="current"
              name="current"
              type="password"
              className="field"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="next">
              Nueva contrasena
            </label>
            <input
              id="next"
              name="next"
              type="password"
              className="field"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="muted mt-1.5 text-xs">Minimo 8 caracteres.</p>
          </div>
        </ActionForm>
      </section>

      {/* Portabilidad */}
      <section className="surface p-6">
        <h2 className="font-semibold">Exportar tus datos</h2>
        <p className="muted mt-2 text-sm">
          Descarga en JSON todo tu contenido, tus proyectos y tu perfil de marca. Ejerce tu derecho
          de portabilidad sin pedirnos nada.
        </p>
        <a href="/api/export" className="btn btn-secondary mt-4 text-sm" download>
          Descargar mis datos
        </a>
      </section>

      {/* Baja */}
      <section className="surface border-red-300 p-6">
        <h2 className="font-semibold text-red-600">Eliminar la cuenta</h2>
        <p className="muted mt-2 text-sm">
          Se borraran de forma permanente tu cuenta, tu contenido, tus proyectos y tus estadisticas.
          Esta accion no se puede deshacer. Cuenta creada el {formatDate(organization.createdAt)}.
        </p>

        <div className="mt-4">
          <ActionForm
            action={deleteAccountAction}
            submitLabel="Eliminar mi cuenta definitivamente"
            pendingLabel="Eliminando…"
            variant="danger"
          >
            <div>
              <label className="label" htmlFor="confirm">
                Escribe ELIMINAR para confirmar
              </label>
              <input
                id="confirm"
                name="confirm"
                className="field max-w-xs"
                placeholder="ELIMINAR"
                autoComplete="off"
              />
            </div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
