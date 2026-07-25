# 10 · Operativa y mantenimiento

Manual de guardia: qué mirar, cada cuánto y qué hacer cuando algo falla.

---

## Rutina

### Cada semana (10 minutos)

1. **`/admin`** — MRR, cuentas nuevas, bajas y pagos pendientes.
2. **`/admin/generaciones`** — tasa de error. Por encima del 2 % hay algo roto.
3. **Margen bruto** — si cae, alguien consume por encima de lo que paga.
4. **Cuentas en `PAST_DUE`** — el email automático ya salió; si persisten varios
   días, escribe a mano.

### Cada mes (30 minutos)

1. **`/admin/analitica`** — embudo y fuentes de tráfico.
2. **`npm audit`** — vulnerabilidades nuevas.
3. **Prueba de restauración de la copia de seguridad.** Una copia sin restaurar
   no es una copia.
4. **Calendario editorial** — ¿quedan temas en `EDITORIAL_CALENDAR`?

### Cada trimestre

1. Revisar precios frente al coste real de modelo.
2. Actualizar dependencias mayores en una rama aparte.
3. Revisar los textos legales si ha cambiado algo del servicio.

---

## Diagnóstico rápido

`/admin/sistema` responde a «¿está todo conectado?» de un vistazo. Empieza siempre
ahí.

```bash
# ¿Responde la aplicación?
curl -I https://tu-dominio.com/

# ¿Responde la base de datos?
psql "$DATABASE_URL" -c 'SELECT 1;'

# ¿Se ejecutaron los cron?
psql "$DATABASE_URL" -c 'SELECT action, "createdAt" FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 10;'
```

---

## Incidencias frecuentes

### «No puedo entrar»

1. ¿Se registró con Google y ahora intenta con contraseña? No tiene hash: debe
   volver a entrar con Google.
2. Comprueba que existe:
   ```sql
   SELECT email, "passwordHash" IS NOT NULL AS tiene_password, "lastLoginAt"
   FROM "User" WHERE email = 'cliente@ejemplo.com';
   ```
3. Si hay que restablecer la contraseña, genera un hash bcrypt y actualízalo a
   mano; avisa al cliente para que la cambie desde Ajustes.

### «He pagado y sigo en el plan anterior»

1. Panel de Stripe → Webhooks → ¿llegó el evento? ¿respondió 2xx?
2. Si falló, pulsa **Reenviar**. El endpoint es idempotente.
3. Comprueba el estado guardado:
   ```sql
   SELECT name, plan, "subscriptionStatus", "stripeSubscriptionId"
   FROM "Organization" WHERE "stripeCustomerId" = 'cus_...';
   ```
4. Nunca cambies el plan a mano en la base de datos salvo emergencia: la
   siguiente sincronización lo sobrescribirá.

### «La generación falla siempre»

1. `/admin/generaciones?estado=FAILED` — mira el mensaje de error.
2. Si es de cuota, es comportamiento correcto: el cliente debe cambiar de plan.
3. Si es del proveedor, revisa el estado de la API de Anthropic y el saldo de la
   cuenta.
4. Si es `refusal`, el contenido pedido choca con las políticas de uso: hay que
   reformularlo.

### «Recibo emails repetidos»

Revisa que el trabajo use `alreadySentRecently`. Consulta:

```sql
SELECT template, "to", COUNT(*) FROM "EmailLog"
WHERE "createdAt" > now() - interval '7 days'
GROUP BY 1,2 HAVING COUNT(*) > 2;
```

### La aplicación va lenta

1. ¿Ha crecido mucho `AnalyticsEvent`? Ejecuta `cleanup` a mano.
2. Revisa los tamaños de tabla (consulta en
   [`docs/03-base-de-datos.md`](03-base-de-datos.md)).
3. Comprueba el número de conexiones: en entornos sin servidor conviene un
   *pooler* (PgBouncer, o el que ofrezca tu proveedor).

---

## Emergencias

### Cerrar el registro

Desactiva la bandera `signup_open` en `/admin/sistema` (hoy es informativa: para
que bloquee de verdad, añade la comprobación en `registerAction`).

### Parar el gasto de IA

Quita `ANTHROPIC_API_KEY` del entorno y redespliega. La aplicación sigue en pie y
el generador avisa de que no está disponible.

### Revertir un despliegue

En Vercel, promociona el despliegue anterior. **Ojo con las migraciones**: si la
nueva versión aplicó una migración destructiva, revertir el código no revierte la
base de datos. Ese es el motivo de la regla de los dos pasos en
[`docs/03-base-de-datos.md`](03-base-de-datos.md).

### Fuga de credenciales

1. Rota la clave afectada en el proveedor.
2. Actualiza la variable y redespliega.
3. Si es `AUTH_SECRET`, todas las sesiones se invalidan: los clientes tendrán que
   volver a entrar. Es lo correcto.

---

## Contactos

| Servicio | Panel | Para qué |
| --- | --- | --- |
| Anthropic | console.anthropic.com | Saldo, límites, estado de la API |
| Stripe | dashboard.stripe.com | Cobros, webhooks, reembolsos |
| Resend | resend.com | Entregabilidad de email |
| Alojamiento | (según proveedor) | Despliegues y registros |
| Base de datos | (según proveedor) | Copias y rendimiento |
