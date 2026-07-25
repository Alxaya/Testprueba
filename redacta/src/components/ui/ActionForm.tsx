'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/actions/content';

/**
 * Formulario generico conectado a una Server Action.
 *
 * Centraliza el estado de envio y la presentacion de errores y confirmaciones,
 * para que las pantallas del panel solo tengan que declarar sus campos.
 */

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'danger';
  className?: string;
};

function Submit({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Guardando…',
  variant = 'primary',
  className = 'space-y-4',
}: Props) {
  const [state, formAction] = useActionState(action, {} as ActionState);

  return (
    <form action={formAction} className={className}>
      {children}

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      {state?.success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          {state.success}
        </p>
      )}

      <Submit label={submitLabel} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}
