'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

/**
 * Registro de visitas sin cookies.
 *
 * El identificador anonimo vive en `sessionStorage`: desaparece al cerrar la
 * pestana, no permite seguir a nadie entre sesiones y por eso no requiere
 * banner de consentimiento. Solo sirve para no contar diez veces a la misma
 * persona en una misma visita.
 */
function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;

    let anonymousId = sessionStorage.getItem('rdct_aid');
    if (!anonymousId) {
      anonymousId = crypto.randomUUID();
      sessionStorage.setItem('rdct_aid', anonymousId);
    }

    const payload = {
      name: 'pageview',
      path: pathname,
      anonymousId,
      referrer: document.referrer || null,
      utmSource: searchParams.get('utm_source'),
      utmMedium: searchParams.get('utm_medium'),
      utmCampaign: searchParams.get('utm_campaign'),
    };

    // `keepalive` permite que la peticion sobreviva a la navegacion.
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* la analitica nunca debe molestar al usuario */
    });
  }, [pathname, searchParams]);

  return null;
}

export function PageviewTracker() {
  // useSearchParams obliga a un limite de Suspense para no bloquear el
  // renderizado estatico de las paginas publicas.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
