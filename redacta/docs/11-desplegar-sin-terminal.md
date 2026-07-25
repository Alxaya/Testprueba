# 11 · Desplegar sin terminal (desde el móvil)

Guía para poner Redacta en internet **usando solo el navegador**. No hace falta
instalar nada ni escribir un solo comando. Unos 15 minutos.

Al terminar tendrás una dirección web real, funcionando siempre, que puedes
enseñar a cualquiera.

Necesitas tres cuentas, todas gratuitas y todas con «Continuar con GitHub»:
GitHub (ya la tienes), **Neon** (base de datos) y **Vercel** (alojamiento).

---

## Paso 1 · Base de datos en Neon

1. Entra en **neon.com** → *Sign up* → **Continue with GitHub**.
2. Te pide crear un proyecto:
   - **Project name:** `redacta`
   - **Region:** elige Europa (Frankfurt) si estás en España
3. Al crearlo aparece un recuadro **Connection string**. Copia esa línea entera.
   Empieza por `postgresql://` y es larga.
4. Guárdala donde puedas pegarla luego.

> Si la pierdes: dentro del proyecto, *Dashboard* → *Connection string*.

---

## Paso 2 · Alojamiento en Vercel

1. Entra en **vercel.com** → *Sign up* → **Continue with GitHub**.
2. *Add New…* → **Project**.
3. Busca el repositorio `Testprueba` y pulsa **Import**.
   - Si no aparece, pulsa *Adjust GitHub App Permissions* y dale acceso.

### Configuración del proyecto

Antes de desplegar, ajusta dos cosas:

**Root Directory** — pulsa *Edit* y selecciona la carpeta **`redacta`**.
Es importante: el repositorio tiene varios proyectos y hay que decirle cuál es.

**Branch** — si no ofrece la rama correcta, selecciona
`claude/online-business-system-25iqhn`.

---

## Paso 3 · Variables de entorno

En la misma pantalla, despliega **Environment Variables** y añade estas cuatro.
Son obligatorias:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | La cadena que copiaste de Neon |
| `AUTH_SECRET` | Una cadena aleatoria larga (ver abajo) |
| `NEXT_PUBLIC_APP_URL` | Déjala vacía de momento; se rellena en el paso 5 |
| `ADMIN_EMAILS` | Tu email — te dará acceso al panel de administración |

**Para `AUTH_SECRET`** sirve cualquier texto aleatorio largo. Puedes usar un
generador de contraseñas del navegador o de tu gestor de contraseñas: pide una de
40 o más caracteres. Es la clave que firma las sesiones; si cambia, todo el mundo
tiene que volver a iniciar sesión.

### Opcionales (se pueden añadir después)

| Name | Para qué | Sin ella |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Generar contenido con IA | El generador avisa de que no está disponible |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` | Cobrar | Todas las cuentas en plan gratuito |
| `RESEND_API_KEY` + `EMAIL_FROM` | Enviar emails | Los emails se registran pero no salen |
| `CRON_SECRET` | Trabajos automáticos | Los endpoints se bloquean (comportamiento correcto) |

> **`ANTHROPIC_API_KEY` es de pago por uso.** Se saca en
> `console.anthropic.com`. Cada pieza generada cuesta entre 2 y 6 céntimos. Sin
> ella el resto de la aplicación funciona igual.

---

## Paso 4 · Desplegar

Pulsa **Deploy** y espera unos 3 minutos.

El despliegue **crea las tablas de la base de datos solo**: el proyecto usa el
script `vercel-build`, que ejecuta `prisma migrate deploy` antes de compilar. No
hay que hacer nada más.

---

## Paso 5 · Ajustar la dirección definitiva

Cuando termine, Vercel te da una dirección tipo `redacta-xxxx.vercel.app`.

1. Cópiala.
2. Ve a *Settings* → *Environment Variables* → edita `NEXT_PUBLIC_APP_URL` y pon
   la dirección completa **con `https://` y sin barra final**:
   `https://redacta-xxxx.vercel.app`
3. Ve a *Deployments* → en el último, menú `···` → **Redeploy**.

Este paso importa: esa variable es la que usan las URL canónicas, el sitemap y
los enlaces de los emails.

---

## Paso 6 · Entrar

Abre tu dirección. Verás la web pública.

1. Pulsa **Empezar gratis** y regístrate **con el mismo email que pusiste en
   `ADMIN_EMAILS`**.
2. Entras en el panel de cliente: `/app`
3. Como ese email es administrador, también tienes `/admin`.

**El orden importa:** `ADMIN_EMAILS` se lee al registrarse. Si te registras antes
de configurar la variable, esa cuenta será de cliente normal.

---

## Después

**Dominio propio:** *Settings* → *Domains* → añade tu dominio y sigue las
instrucciones de DNS. Recuerda actualizar `NEXT_PUBLIC_APP_URL` y volver a
desplegar.

**Trabajos automáticos:** los cron de `vercel.json` se activan solos en los planes
que los soportan. Añade `CRON_SECRET` para que estén protegidos.

**Cobrar de verdad:** ver [`05-stripe.md`](05-stripe.md) y, antes de nada,
[`09-legal.md`](09-legal.md) — hay datos fiscales obligatorios que completar.

---

## Si algo falla

| Síntoma | Causa | Solución |
| --- | --- | --- |
| El build falla nada más empezar | Root Directory mal puesto | *Settings* → *General* → Root Directory = `redacta` |
| Error de conexión a base de datos | `DATABASE_URL` mal copiada | Vuelve a copiarla de Neon, entera |
| «Configuración de entorno inválida» | Falta `AUTH_SECRET` o `DATABASE_URL` | Añádelas y vuelve a desplegar |
| Registro correcto pero sin acceso a `/admin` | Te registraste antes de poner `ADMIN_EMAILS` | Añade la variable, redespliega y registra otra cuenta |
| El generador dice que no está disponible | Falta `ANTHROPIC_API_KEY` | Es lo esperado; añádela cuando quieras |

Los errores del despliegue se leen en Vercel → *Deployments* → el que falló →
*Build Logs*.
