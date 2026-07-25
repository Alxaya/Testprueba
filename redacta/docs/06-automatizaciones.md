# 06 · Automatizaciones y emails

El objetivo del proyecto es que el negocio funcione sin intervención diaria. Esto
es lo que se ejecuta solo.

---

## Trabajos programados

Definidos en [`src/lib/jobs/index.ts`](../src/lib/jobs/index.ts) y programados en
[`vercel.json`](../vercel.json).

| Trabajo | Cuándo | Qué hace |
| --- | --- | --- |
| `weekly-report` | Lunes 08:00 | Envía a cada cliente activo un resumen de lo creado |
| `inactivity-nudge` | Miércoles 09:00 | Escribe a quien lleva 7+ días sin generar |
| `blog-autopilot` | Martes 07:00 | Publica un artículo del calendario editorial |
| `cleanup` | Domingo 04:00 | Borra eventos, webhooks y registros antiguos |

Cada uno se expone como `GET|POST /api/cron/<nombre>` y también se puede lanzar a
mano desde `/admin/sistema`. Toda ejecución queda en `AuditLog`.

### Seguridad

```bash
CRON_SECRET="$(openssl rand -hex 32)"
```

Los endpoints exigen `Authorization: Bearer <CRON_SECRET>`. Vercel Cron añade esa
cabecera automáticamente si la variable existe en el proyecto.

**Sin `CRON_SECRET`, los endpoints solo responden fuera de producción.** Así el
desarrollo local es cómodo y un despliegue mal configurado no deja una puerta
abierta.

### Con otro planificador

```bash
# crontab del servidor
0 8 * * 1 curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/weekly-report
```

O con GitHub Actions (`schedule:` + `secrets.CRON_SECRET`).

### Añadir un trabajo

1. Escribe la función en `src/lib/jobs/`. Debe devolver un `JobResult`.
2. Regístrala en el objeto `JOBS`.
3. Añade su entrada en `vercel.json`.

Aparecerá sola en `/admin/sistema` con su botón de ejecución manual.

---

## Emails transaccionales

En [`src/lib/email/`](../src/lib/email/). Sin `RESEND_API_KEY` **los emails se
escriben en consola** y se registran como `SKIPPED`: el flujo completo es
probable en local sin dar de alta ningún servicio.

| Plantilla | Cuándo se envía |
| --- | --- |
| `welcome` | Al registrarse |
| `quota-warning` | Al llegar al 80 % de la cuota (una vez por periodo) |
| `subscription-activated` | Al confirmarse el pago |
| `payment-failed` | Al fallar un cobro |
| `weekly-report` | Trabajo semanal |
| `inactivity-nudge` | Trabajo de inactividad |

### Configuración

```bash
RESEND_API_KEY="re_..."
EMAIL_FROM="Redacta <hola@tudominio.com>"
```

Verifica el dominio en Resend y añade los registros SPF, DKIM y DMARC. Sin ellos
los correos acaban en spam.

### Protección contra el spam propio

- `EmailLog` registra todos los envíos.
- `alreadySentRecently(to, plantilla, horas)` impide repetir el mismo tipo de
  aviso dentro de una ventana.
- `UsagePeriod.warnedAt` garantiza un solo aviso de cuota por periodo.

Si añades una plantilla nueva a un trabajo, **usa siempre `alreadySentRecently`**.

---

## Blog automático

[`src/lib/jobs/blog-autopilot.ts`](../src/lib/jobs/blog-autopilot.ts) es marketing
de contenidos que se ejecuta solo.

Funcionamiento: toma el siguiente tema del calendario editorial que aún no se ha
publicado, lo escribe con nuestro propio motor y lo publica con metadatos, datos
estructurados y entrada en el sitemap.

**El calendario está escrito a mano a propósito** (`EDITORIAL_CALENDAR`). Los
temas se eligen por intención de búsqueda real; no los inventa el modelo. Cuando
se agota, el trabajo lo dice y no hace nada.

Para ampliarlo, añade entradas con `keyword`, `title`, `angle` y `tags`.

> Recomendación: revisa los artículos publicados. Se marcan con «Asistido por IA»
> en la ficha, y el objetivo es que el borrador esté listo, no que nadie lo lea
> nunca.

---

## Qué **no** está automatizado (y es correcto)

| Tarea | Por qué se deja a una persona |
| --- | --- |
| Responder a soporte | Un cliente enfadado necesita a alguien, no una plantilla |
| Cambiar precios | Decisión de negocio |
| Aprobar reembolsos | Riesgo de abuso |
| Revisar los artículos del blog | La marca la firmas tú |
