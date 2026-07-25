# 07 · Analítica y métricas

Dos sistemas distintos con propósitos distintos:

- **Analítica de producto** (`src/lib/analytics.ts`) — qué hace la gente.
- **Métricas de negocio** (`src/lib/metrics.ts`) — si el negocio gana dinero.

---

## Analítica de producto

Eventos guardados en nuestra propia base de datos. **Sin cookies de terceros y
sin banner de consentimiento**, porque no se usan identificadores persistentes:
el identificador anónimo vive en `sessionStorage` y muere al cerrar la pestaña.
Solo sirve para no contar diez veces a la misma persona en una visita.

### Eventos registrados

| Evento | Dónde se dispara |
| --- | --- |
| `pageview` | Navegación en la web pública |
| `signup` | Alta de cuenta |
| `generation_created` / `generation_failed` | Motor de IA |
| `quota_reached` | Al agotarse la cuota |
| `checkout_started` | Al abrir el checkout |
| `subscription_activated` / `subscription_canceled` | Webhook de Stripe |
| `brand_profile_updated` | Guardado del perfil de marca |

### Registrar un evento nuevo

```ts
import { track } from '@/lib/analytics';

await track({
  name: 'export_downloaded',
  organizationId: organization.id,
  userId: user.id,
  props: { formato: 'json' },
});
```

`track` **nunca lanza**: un fallo de analítica no puede romper la petición del
usuario.

Desde el navegador solo se aceptan los eventos de la lista blanca
`CLIENT_EVENTS` en `src/app/api/analytics/route.ts`. El identificador de usuario
y el de organización se toman siempre de la sesión del servidor, nunca del cuerpo
de la petición.

### El embudo

`funnel()` cuenta **identidades únicas**, no eventos:

| Paso | Qué cuenta |
| --- | --- |
| Visitantes | `anonymousId` distintos |
| Registros | Altas |
| Han creado contenido | Organizaciones distintas |
| Checkout iniciado | Organizaciones distintas |
| Suscripciones | Organizaciones distintas |

> Esto importa: contar eventos brutos produce embudos donde un paso posterior
> supera al anterior (una cuenta genera 20 piezas), que es justo lo que un embudo
> no debe hacer.

---

## Métricas de negocio

En `/admin`:

| Métrica | Cómo se calcula |
| --- | --- |
| MRR | Suma del precio de plan de las suscripciones activas o en prueba |
| ARR | MRR × 12 (proyección simple, no descuenta bajas) |
| Margen bruto | MRR − coste de modelo de los últimos 30 días |
| Coste medio por pieza | Coste de modelo ÷ generaciones completadas |
| Bajas | Suscripciones canceladas en 30 días |
| Pagos pendientes | Cuentas en `PAST_DUE` |

El coste se guarda **en cada generación**, así que el margen es real, no
estimado a posteriori.

---

## Qué mirar y cada cuánto

**Cada semana:**

1. `/admin` → ¿sube el MRR? ¿hay cuentas en `PAST_DUE`?
2. `/admin/generaciones` → tasa de error. Por encima del 2 % hay algo roto.
3. Margen bruto. Si baja, alguien está consumiendo por encima de su plan.

**Cada mes:**

1. `/admin/analitica` → dónde se pierde gente en el embudo.
2. Fuentes de tráfico: dónde invertir esfuerzo de contenido.
3. Eventos `quota_reached`: si son muchos, hay demanda de subir de plan.

### Cómo leer el embudo

| Síntoma | Interpretación probable |
| --- | --- |
| Muchas visitas, pocos registros | La portada no convence o el público no encaja |
| Muchos registros, poco contenido creado | El primer uso tiene fricción; revisa el alta |
| Contenido creado, pero sin checkout | La cuota gratuita es demasiado generosa, o el valor no se percibe |
| Checkout iniciado sin suscripción | Problema de precio o de confianza en el pago |

---

## Privacidad y retención

- No se guardan direcciones IP.
- El país se toma de la cabecera del proveedor, si existe.
- El identificador anónimo no permite seguir a nadie entre sesiones ni entre
  sitios.
- Los eventos se borran a los **180 días** con el trabajo `cleanup`.

Esto es lo que permite no poner banner de cookies. **Si añades una herramienta de
terceros (Google Analytics, píxel de Meta), esa exención desaparece** y hay que
implementar consentimiento previo.
