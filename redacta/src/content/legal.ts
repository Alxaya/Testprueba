import { site } from '@/lib/site';

/**
 * Textos legales.
 *
 * IMPORTANTE: son plantillas de partida conformes con la LSSI-CE y el RGPD,
 * pero deben completarse con los datos reales de la empresa (marcados como
 * [PENDIENTE]) y revisarse por un asesor antes de operar comercialmente.
 * Ver docs/09-legal.md.
 */

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  bodyMd: string;
};

const HOLDER = `**Titular:** [PENDIENTE: nombre o razon social]
**NIF/CIF:** [PENDIENTE]
**Domicilio:** [PENDIENTE]
**Email de contacto:** ${site.email}`;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'aviso-legal',
    title: 'Aviso legal',
    description: `Informacion legal del titular de ${site.name} y condiciones de uso del sitio web.`,
    updatedAt: '2026-01-01',
    bodyMd: `## 1. Datos identificativos

En cumplimiento del articulo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Informacion y de Comercio Electronico (LSSI-CE), se informa de los siguientes datos:

${HOLDER}

## 2. Objeto

Este aviso legal regula el acceso y uso del sitio web ${site.url} y del servicio ${site.name}, una herramienta en linea de generacion de contenido asistida por inteligencia artificial.

## 3. Condiciones de uso

El acceso al sitio es gratuito. El uso del servicio requiere registro y la aceptacion de los terminos del servicio.

La persona usuaria se compromete a utilizar el sitio conforme a la ley y a no emplearlo para:

- Generar contenido ilicito, difamatorio, discriminatorio o que vulnere derechos de terceros.
- Suplantar la identidad de personas o marcas.
- Realizar acciones que dificulten el funcionamiento normal del servicio.

## 4. Propiedad intelectual

El codigo, el diseno, las marcas y los contenidos propios del sitio pertenecen al titular. El contenido que genera cada persona usuaria mediante el servicio le pertenece a ella, sin perjuicio de lo indicado en los terminos del servicio.

## 5. Exclusion de responsabilidad

El contenido generado mediante inteligencia artificial requiere revision humana antes de su publicacion. El titular no responde de las consecuencias derivadas de publicar contenido sin revisar.

## 6. Legislacion aplicable

Esta relacion se rige por la legislacion espanola. Para cualquier controversia, las partes se someten a los juzgados y tribunales del domicilio de la persona consumidora.`,
  },

  {
    slug: 'privacidad',
    title: 'Politica de privacidad',
    description: `Como trata ${site.name} los datos personales conforme al RGPD y a la LOPDGDD.`,
    updatedAt: '2026-01-01',
    bodyMd: `## 1. Responsable del tratamiento

${HOLDER}

## 2. Datos que tratamos

| Dato | Origen | Finalidad |
| --- | --- | --- |
| Nombre y email | Registro | Crear y gestionar la cuenta |
| Contrasena (cifrada) | Registro | Autenticacion |
| Datos de facturacion | Stripe | Cobro de la suscripcion y facturacion |
| Contenido generado y perfil de marca | Uso del servicio | Prestacion del servicio |
| Eventos de uso (paginas, acciones) | Navegacion | Estadisticas agregadas y mejora del producto |

No tratamos categorias especiales de datos. No elaboramos perfiles con efectos juridicos.

## 3. Base legal

- **Ejecucion de un contrato** (art. 6.1.b RGPD): gestion de la cuenta y prestacion del servicio.
- **Obligacion legal** (art. 6.1.c): conservacion de facturas.
- **Interes legitimo** (art. 6.1.f): estadisticas agregadas de uso y seguridad del servicio.
- **Consentimiento** (art. 6.1.a): comunicaciones comerciales, revocables en cualquier momento.

## 4. Conservacion

Los datos se conservan mientras la cuenta este activa. Tras su eliminacion se borran en un plazo maximo de 30 dias, salvo los datos de facturacion, que se conservan durante los plazos fiscales legalmente exigidos.

## 5. Encargados del tratamiento

Prestadores que acceden a datos para prestar el servicio:

- **Anthropic** (procesamiento de las peticiones de generacion de contenido).
- **Stripe** (pagos y facturacion).
- **Resend** (envio de emails transaccionales).
- **Proveedor de alojamiento y base de datos**: [PENDIENTE].

El contenido enviado al modelo **no se utiliza para entrenar modelos**.

## 6. Derechos

Puedes ejercer los derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad escribiendo a ${site.email}. Tambien puedes reclamar ante la Agencia Espanola de Proteccion de Datos (www.aepd.es).

Desde los ajustes de la cuenta puedes exportar tu contenido y eliminar la cuenta con todos sus datos.

## 7. Seguridad

Las contrasenas se almacenan con hash bcrypt. Las comunicaciones viajan cifradas mediante TLS. El acceso a los datos esta restringido al personal necesario.`,
  },

  {
    slug: 'cookies',
    title: 'Politica de cookies',
    description: `Uso de cookies y almacenamiento local en ${site.name}.`,
    updatedAt: '2026-01-01',
    bodyMd: `## Resumen

${site.name} **no utiliza cookies publicitarias ni de analitica de terceros**. Por eso no veras un banner de consentimiento.

## Que usamos exactamente

| Elemento | Tipo | Finalidad | Duracion |
| --- | --- | --- | --- |
| Cookie de sesion | Tecnica, necesaria | Mantener la sesion iniciada | 30 dias |
| Cookie CSRF | Tecnica, necesaria | Proteger los formularios frente a peticiones falsificadas | Sesion |
| \`sessionStorage\` con identificador anonimo | Tecnica | Evitar contar varias veces la misma visita | Hasta cerrar la pestana |

Las cookies tecnicas necesarias estan exentas del deber de consentimiento previo segun el articulo 22.2 de la LSSI-CE.

## Analitica

Las estadisticas de uso se registran en nuestros propios servidores, de forma agregada y sin identificadores persistentes. No se comparten con terceros ni permiten seguir a una persona entre sesiones o entre sitios web.

## Como desactivarlas

Puedes bloquear las cookies desde la configuracion de tu navegador. Ten en cuenta que, al ser cookies necesarias, bloquearlas impedira iniciar sesion.`,
  },

  {
    slug: 'terminos',
    title: 'Terminos del servicio',
    description: `Condiciones de contratacion y uso del servicio ${site.name}.`,
    updatedAt: '2026-01-01',
    bodyMd: `## 1. Objeto

Estos terminos regulan la contratacion y el uso de ${site.name}, un servicio de software por suscripcion que genera contenido comercial mediante inteligencia artificial.

${HOLDER}

## 2. Cuenta

El registro requiere un email valido. Cada persona es responsable de la confidencialidad de sus credenciales y de la actividad realizada desde su cuenta.

## 3. Planes y pagos

- Los precios se muestran en euros y **sin IVA**, que se anade segun la normativa aplicable.
- La suscripcion se renueva automaticamente cada mes hasta que se cancele.
- Los pagos se procesan a traves de Stripe. No almacenamos datos de tarjeta.
- El cambio de plan se prorratea automaticamente.

## 4. Cancelacion y reembolsos

Puedes cancelar en cualquier momento desde el portal de facturacion. Mantendras el acceso hasta el final del periodo ya abonado. No se reembolsan periodos ya iniciados, salvo obligacion legal.

**Derecho de desistimiento:** al tratarse de un servicio digital de ejecucion inmediata, al contratar aceptas expresamente que la prestacion comience de inmediato y reconoces que pierdes el derecho de desistimiento de 14 dias una vez ejecutado por completo (art. 103.m del RDL 1/2007).

## 5. Limites de uso

Cada plan incluye un numero de generaciones por periodo. Al agotarlo, el servicio queda limitado hasta la renovacion o hasta un cambio de plan. Queda prohibida la reventa del servicio y el uso automatizado que exceda los limites contratados.

## 6. Contenido generado

La titularidad del contenido generado corresponde a la persona usuaria, que es la unica responsable de revisarlo antes de publicarlo. El servicio se presta "tal cual": no garantizamos que el contenido este libre de errores, ni resultados concretos de posicionamiento o de ventas.

Nos reservamos el derecho de suspender cuentas que generen contenido ilicito o que incumplan las politicas de uso del proveedor del modelo.

## 7. Disponibilidad

Trabajamos para mantener el servicio disponible de forma continuada, pero no garantizamos un porcentaje de disponibilidad salvo en los planes que lo indiquen expresamente.

## 8. Modificaciones

Podemos modificar estos terminos avisando con 30 dias de antelacion por email. Si no estas de acuerdo, puedes cancelar antes de que entren en vigor.

## 9. Legislacion y jurisdiccion

Se aplica la legislacion espanola. Para las personas consumidoras, el fuero es el de su domicilio.`,
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
