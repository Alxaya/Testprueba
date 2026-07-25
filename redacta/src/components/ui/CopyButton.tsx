'use client';

import { useState } from 'react';

/** Copia texto al portapapeles con confirmacion visual temporal. */
export function CopyButton({
  text,
  label = 'Copiar',
  className = 'btn btn-secondary text-sm',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Navegadores sin permiso de portapapeles (o contexto no seguro):
      // seleccionar y copiar a mano sigue siendo posible.
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? '✓ Copiado' : label}
    </button>
  );
}
