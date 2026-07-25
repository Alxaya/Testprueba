# 05 · Pagos con Stripe

Sin Stripe configurado la aplicación funciona y todas las cuentas quedan en plan
gratuito. Esta guía cubre la puesta en marcha real.

---

## 1. Crear los productos

En el panel de Stripe (empieza en **modo prueba**), crea un producto por plan con
**precio recurrente mensual en EUR**:

| Producto | Precio | Variable de entorno |
| --- | --- | --- |
| Redacta Starter | 19,00 € / mes | `STRIPE_PRICE_STARTER_MONTHLY` |
| Redacta Pro | 49,00 € / mes | `STRIPE_PRICE_PRO_MONTHLY` |
| Redacta Business | 99,00 € / mes | `STRIPE_PRICE_BUSINESS_MONTHLY` |

Copia el **ID del precio** (`price_...`, no el del producto `prod_...`) a `.env`.

> Los precios deben coincidir con los de `src/lib/plans.ts`. Si no coinciden, el
> cliente ve un importe en la web y otro en el checkout.

## 2. Claves de API

*Desarrolladores → Claves de API*:

```bash
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

## 3. Webhook

Es la parte crítica: **es lo único que cambia el plan de un cliente**.

### En local

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copia el whsec_... que imprime
```

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### En producción

*Desarrolladores → Webhooks → Añadir endpoint*:

- URL: `https://tu-dominio.com/api/stripe/webhook`
- Eventos a escuchar:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copia el secreto de firma a `STRIPE_WEBHOOK_SECRET` en el entorno de producción.

## 4. Portal de cliente

*Configuración → Facturación → Portal de cliente*. Activa: actualizar método de
pago, cancelar suscripción, cambiar de plan y descargar facturas.

Sin esto, el botón «Gestionar suscripción» devuelve error.

## 5. Impuestos

El checkout ya pide dirección de facturación y NIF/CIF
(`tax_id_collection`). Para calcular el IVA automáticamente hay que activar
**Stripe Tax** y declarar el registro fiscal en España. Consúltalo con tu asesor:
las obligaciones cambian según vendas a particulares o a empresas de la UE.

---

## Probar el flujo completo

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook   # terminal 1
npm run dev                                                     # terminal 2
```

1. Entra en `/app/facturacion` y pulsa «Cambiar a Pro».
2. Paga con la tarjeta de prueba `4242 4242 4242 4242`, fecha futura, CVC
   cualquiera.
3. Vuelves a la aplicación y, al confirmarse el webhook, el plan cambia a Pro.

Tarjetas de prueba útiles:

| Número | Resultado |
| --- | --- |
| `4242 4242 4242 4242` | Pago correcto |
| `4000 0000 0000 9995` | Fondos insuficientes |
| `4000 0025 0000 3155` | Requiere autenticación 3D Secure |

---

## Cómo está implementado

- `src/lib/stripe.ts` — cliente, checkout, portal y sincronización.
- `src/app/api/stripe/webhook/route.ts` — recepción de eventos.
- `src/app/actions/billing.ts` — acciones del panel.

Tres garantías del webhook:

1. **Se verifica la firma** antes de leer el cuerpo.
2. **Se registra el ID del evento** en `ProcessedWebhook`: Stripe reintenta hasta
   recibir un 2xx, y sin esto un reintento duplicaría efectos.
3. **Los errores devuelven 500 a propósito**, para que Stripe reintente. Preferimos
   un reintento a perder un cambio de suscripción.

**Ninguna acción del navegador cambia el plan.** El navegador solo abre sesiones
alojadas por Stripe. Esto elimina toda una clase de fraude.

---

## Incidencias

| Síntoma | Causa habitual | Solución |
| --- | --- | --- |
| El plan no cambia tras pagar | El webhook no llega | Revisa los intentos en el panel de Stripe; comprueba que la URL es pública |
| «Firma inválida» en el registro | Secreto incorrecto o cuerpo modificado | Usa el `whsec_` del endpoint correcto; no añadas middleware que altere el cuerpo |
| «El plan no tiene precio configurado» | Falta la variable `STRIPE_PRICE_*` | Añádela y reinicia |
| El botón del portal falla | Portal sin configurar | Actívalo en el panel de Stripe |

Para reprocesar un evento perdido: panel de Stripe → Webhooks → el evento →
*Reenviar*.

---

## Antes de pasar a producción

- [ ] Cambiar todas las claves de prueba por las de producción (`sk_live_`, `pk_live_`)
- [ ] Recrear los productos y precios en modo producción (los IDs son distintos)
- [ ] Crear el webhook de producción y actualizar su secreto
- [ ] Configurar el portal de cliente en modo producción
- [ ] Probar un cobro real de 1 € y reembolsarlo
