import { env } from '@/lib/env';

/**
 * Plantillas de email en HTML inline.
 *
 * Sin motor de plantillas a proposito: son pocas, cambian poco y el HTML de
 * email exige estilos en linea de todas formas. Cada plantilla devuelve
 * asunto + cuerpo para que el emisor solo tenga que enviarlo.
 */

const APP = env.NEXT_PUBLIC_APP_URL;

const BRAND = {
  name: 'Redacta',
  color: '#4338ca',
  muted: '#64748b',
  bg: '#f8fafc',
};

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:18px;font-weight:700;color:${BRAND.color};letter-spacing:-0.02em;">${BRAND.name}</div>
        </td></tr>
        <tr><td style="padding:8px 32px 4px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">${title}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 8px;font-size:15px;line-height:1.6;color:#334155;">
          ${bodyHtml}
        </td></tr>
        ${
          cta
            ? `<tr><td style="padding:20px 32px 32px;">
                 <a href="${cta.url}" style="display:inline-block;background:${BRAND.color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${cta.label}</a>
               </td></tr>`
            : '<tr><td style="padding:0 32px 24px;"></td></tr>'
        }
        <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:${BRAND.muted};">
          ${BRAND.name} · Contenido que vende, generado con IA.<br>
          <a href="${APP}/app/ajustes" style="color:${BRAND.muted};">Preferencias de notificaciones</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export type RenderedEmail = { subject: string; html: string };

export const templates = {
  welcome(name: string | null): RenderedEmail {
    const who = name ? `Hola ${name}` : 'Hola';
    return {
      subject: 'Bienvenido a Redacta — tus primeros pasos',
      html: layout(
        'Ya puedes empezar a generar contenido',
        `<p>${who}, gracias por registrarte.</p>
         <p>Para que el contenido suene a tu marca y no a IA generica, el orden que mejor funciona es:</p>
         <ol style="padding-left:18px;">
           <li style="margin-bottom:6px;"><strong>Completa tu perfil de marca</strong>: sector, publico y tono de voz. Son 2 minutos y cambian el resultado por completo.</li>
           <li style="margin-bottom:6px;"><strong>Genera una ficha de producto</strong> con un producto real que ya vendas.</li>
           <li><strong>Compara</strong> con lo que tenias publicado y ajusta el tono.</li>
         </ol>
         <p>Tienes 5 generaciones gratis para probarlo sin tarjeta.</p>`,
        { label: 'Ir a mi panel', url: `${APP}/app` },
      ),
    };
  },

  quotaWarning(used: number, limit: number, planName: string): RenderedEmail {
    return {
      subject: `Has usado ${used} de ${limit} generaciones`,
      html: layout(
        'Te queda poco margen este mes',
        `<p>Llevas <strong>${used} de ${limit}</strong> generaciones de tu plan ${planName} en el periodo actual.</p>
         <p>Si necesitas mas volumen puedes subir de plan en cualquier momento: el cambio es inmediato y se prorratea.</p>`,
        { label: 'Ver planes', url: `${APP}/app/facturacion` },
      ),
    };
  },

  quotaReached(planName: string): RenderedEmail {
    return {
      subject: 'Has agotado las generaciones de este periodo',
      html: layout(
        'Se ha agotado tu cuota',
        `<p>Tu plan ${planName} ha consumido todas las generaciones del periodo.</p>
         <p>La cuota se renueva automaticamente al inicio del siguiente periodo. Si no quieres esperar, puedes cambiar de plan y seguir ahora mismo.</p>`,
        { label: 'Cambiar de plan', url: `${APP}/app/facturacion` },
      ),
    };
  },

  subscriptionActivated(planName: string): RenderedEmail {
    return {
      subject: `Tu plan ${planName} ya esta activo`,
      html: layout(
        `Plan ${planName} activado`,
        `<p>El pago se ha completado y tu cuenta ya tiene los limites del plan ${planName}.</p>
         <p>Puedes descargar tus facturas desde el portal de cliente, en la seccion de facturacion.</p>`,
        { label: 'Volver al panel', url: `${APP}/app` },
      ),
    };
  },

  paymentFailed(): RenderedEmail {
    return {
      subject: 'No hemos podido cobrar tu suscripcion',
      html: layout(
        'Problema con el pago',
        `<p>El ultimo intento de cobro de tu suscripcion ha fallado. Suele ser una tarjeta caducada o sin fondos.</p>
         <p>Actualiza el metodo de pago para no perder el acceso: lo reintentaremos automaticamente.</p>`,
        { label: 'Actualizar metodo de pago', url: `${APP}/app/facturacion` },
      ),
    };
  },

  weeklyReport(data: {
    generations: number;
    words: number;
    topType: string;
    remaining: number;
  }): RenderedEmail {
    return {
      subject: `Tu resumen semanal: ${data.generations} piezas creadas`,
      html: layout(
        'Resumen de la semana',
        `<ul style="padding-left:18px;">
           <li style="margin-bottom:6px;"><strong>${data.generations}</strong> piezas de contenido generadas</li>
           <li style="margin-bottom:6px;"><strong>${data.words.toLocaleString('es-ES')}</strong> palabras escritas</li>
           <li style="margin-bottom:6px;">Formato mas usado: <strong>${data.topType}</strong></li>
           <li>Te quedan <strong>${data.remaining}</strong> generaciones en este periodo</li>
         </ul>
         <p>Si esta semana no has publicado nada, empieza por lo que menos cuesta: dos guiones cortos para redes.</p>`,
        { label: 'Crear contenido', url: `${APP}/app/generar` },
      ),
    };
  },

  inactivityNudge(name: string | null): RenderedEmail {
    return {
      subject: 'Tu cuenta de Redacta te esta esperando',
      html: layout(
        'Retoma donde lo dejaste',
        `<p>${name ? `${name}, h` : 'H'}ace unos dias que no generas contenido.</p>
         <p>Una idea concreta para hoy: coge tu producto mas vendido y genera tres guiones de video de 30 segundos. Es lo que mas trafico gratuito suele traer.</p>`,
        { label: 'Generar en 1 minuto', url: `${APP}/app/generar` },
      ),
    };
  },
};

export type TemplateName = keyof typeof templates;
