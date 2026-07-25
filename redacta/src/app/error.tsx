'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Pantalla de error de la aplicacion.
 * No muestra el mensaje interno al usuario: solo el identificador, que es lo
 * que sirve para localizarlo en los registros del servidor.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] error no controlado', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-extrabold">Algo ha fallado</h1>
      <p className="muted mt-3 max-w-md">
        Se ha producido un error inesperado. Ya ha quedado registrado; si vuelve a pasar, escribenos
        indicando el codigo de abajo.
      </p>
      {error.digest && <code className="muted mt-3 text-xs">Codigo: {error.digest}</code>}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
        <Link href="/" className="btn btn-secondary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
