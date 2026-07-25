'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { AuthFormState } from '@/app/actions/auth';

/**
 * Formulario de acceso y de registro.
 *
 * Usa Server Actions con `useActionState`, asi que funciona incluso con
 * JavaScript deshabilitado: el estado de error llega del servidor.
 */

type Props = {
  mode: 'login' | 'register';
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  googleEnabled: boolean;
  googleAction?: () => Promise<void>;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? 'Un momento…' : label}
    </button>
  );
}

export function AuthForm({ mode, action, googleEnabled, googleAction }: Props) {
  const [state, formAction] = useActionState(action, {} as AuthFormState);
  const isRegister = mode === 'register';

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold">
        {isRegister ? 'Crea tu cuenta gratis' : 'Entra en tu cuenta'}
      </h1>
      <p className="muted mt-2 text-sm">
        {isRegister
          ? '5 generaciones al mes, sin tarjeta y sin permanencia.'
          : 'Accede a tu panel y sigue creando contenido.'}
      </p>

      {googleEnabled && googleAction && (
        <>
          <form action={googleAction} className="mt-6">
            <button type="submit" className="btn btn-secondary w-full">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
                />
              </svg>
              Continuar con Google
            </button>
          </form>

          <div className="muted my-6 flex items-center gap-3 text-xs">
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />o con tu email
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>
        </>
      )}

      <form action={formAction} className={googleEnabled ? 'space-y-4' : 'mt-6 space-y-4'}>
        {isRegister && (
          <>
            <div>
              <label className="label" htmlFor="name">
                Tu nombre
              </label>
              <input id="name" name="name" className="field" required autoComplete="name" maxLength={80} />
            </div>
            <div>
              <label className="label" htmlFor="business">
                Nombre de tu negocio <span className="muted font-normal">(opcional)</span>
              </label>
              <input
                id="business"
                name="business"
                className="field"
                autoComplete="organization"
                maxLength={80}
                placeholder="Mi tienda online"
              />
            </div>
          </>
        )}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            required
            autoComplete="email"
            placeholder="tu@empresa.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Contrasena
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field"
            required
            minLength={isRegister ? 8 : 1}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          {isRegister && <p className="muted mt-1.5 text-xs">Minimo 8 caracteres.</p>}
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {state.error}
          </p>
        )}

        <SubmitButton label={isRegister ? 'Crear cuenta' : 'Entrar'} />
      </form>

      <p className="muted mt-6 text-center text-sm">
        {isRegister ? (
          <>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-brand-600 underline">
              Inicia sesion
            </Link>
          </>
        ) : (
          <>
            ¿Aun no tienes cuenta?{' '}
            <Link href="/registro" className="text-brand-600 underline">
              Crea una gratis
            </Link>
          </>
        )}
      </p>

      {isRegister && (
        <p className="muted mt-4 text-center text-xs leading-relaxed">
          Al crear la cuenta aceptas los{' '}
          <Link href="/legal/terminos" className="underline">
            terminos del servicio
          </Link>{' '}
          y la{' '}
          <Link href="/legal/privacidad" className="underline">
            politica de privacidad
          </Link>
          .
        </p>
      )}
    </div>
  );
}
