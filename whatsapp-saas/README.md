# Recepta — SaaS de IA para WhatsApp Business

**Documento técnico y de producto v1.0 — 30 de julio de 2026**
Autor: CTO / arquitecto de software / jefe de producto
Estado: diseño previo a implementación. **No hay una sola línea de código escrita todavía, y es deliberado.**

---

## Resumen ejecutivo (léelo aunque no leas nada más)

### La noticia mala, primero

El 3 de junio de 2026 Meta lanzó globalmente **Meta Business Agent**: un agente de IA nativo dentro de WhatsApp, Instagram y Messenger, que responde preguntas, recomienda productos y mantiene conversaciones completas de venta y soporte. Se aprende el negocio solo, a partir del contenido de la empresa. Fue **gratis hasta el 31 de julio de 2026** y desde **mañana, 1 de agosto de 2026**, Meta lo cobra a **2 $ por millón de tokens** — es decir, céntimos por conversación. Más de un millón de negocios ya lo usan.

Traducción para nosotros: **"un chatbot de IA que contesta WhatsApp" ya no es un producto. Es una función gratuita del sistema operativo.** Cualquier startup que hoy salga a vender 79 €/mes por "IA que responde tus WhatsApps" está vendiendo un producto con fecha de caducidad escrita por Meta. Ese es el cementerio al que van a ir muchos competidores en los próximos 18 meses.

Si no interiorizamos esto, construimos algo muerto. Prefiero decírtelo en la página 1 que en el mes 9.

### La noticia buena

Meta ha comoditizado **la conversación**. No ha comoditizado —ni le interesa comoditizar a corto plazo— **la operación del negocio**. Las limitaciones documentadas de Meta Business Agent son exactamente el hueco:

- No gestiona calendario en vivo (detecta la intención de cita, pero *no reserva de verdad*: no conoce duración por servicio, ni profesional, ni box, ni buffers, ni solapes).
- No tiene integraciones nativas con CRM ni software de gestión, ni marketplace de integraciones.
- No hay bandeja compartida multi-agente ni campañas en el nivel autoservicio.
- No cobra señales, no gestiona listas de espera, no persigue al que no confirmó, no reactiva pacientes dormidos.
- No rinde cuentas: no te dice cuánto dinero te ha hecho ganar.

**Meta juega en el canal. Nosotros jugamos en el sistema operativo del negocio de citas, y usamos WhatsApp como interfaz.** Esa frase es la estrategia entera.

### Qué construimos exactamente

**Recepta: el recepcionista con IA que no duerme, para negocios de cita previa en España.**

No vendemos "IA". Vendemos tres números que un dueño de clínica entiende sin que se los expliques:

1. **Huecos que se rellenan solos.** Cancela alguien a las 17:00 → la lista de espera recibe la oferta en 30 segundos → el hueco se ocupa antes de que la recepcionista se entere.
2. **Ausencias que dejan de pasar.** Recordatorio a 48h y a 3h con confirmación de un toque y reagendado sin fricción. Las clínicas dentales españolas pierden entre **18.000 € y 35.000 € al año** por no-shows en una clínica media de 3 sillones; el 12–18 % de las citas privadas no se atienden, y sube al 25 % en primeras visitas.
3. **Nadie se queda sin respuesta a las 22:47 de un sábado.** Y quien pregunta a esa hora, sale con la cita puesta en el calendario, no con un "te contestamos el lunes".

Y encima de todo, la pieza que ningún competidor pone en primer plano: **el Marcador de ROI.** El panel no abre con "mensajes enviados". Abre con **"Este mes Recepta te ha generado 3.480 € que ibas a perder"**, desglosado y auditable cita a cita. Eso es lo que hace que un negocio de 6 empleados no cancele la suscripción en el mes 3.

### Cliente ideal (uno, no cinco)

**Clínicas dentales privadas de 1 a 4 sillones en España.** Después: estética, fisioterapia y podología. Después: peluquerías y barberías de 3+ sillones.

Por qué esta y no "pymes en general": el dolor es aritmética, no fe (el no-show se cuenta en euros), ya pagan software, ya tienen a alguien contestando WhatsApp desde un móvil personal, y hay un canal de distribución identificable (distribuidores de material dental, software de gestión clínica, gestorías, agencias del sector).

### Números de la tesis

| Concepto | Base | Conservador |
|---|---|---|
| ARPU objetivo | 89 €/mes | 69 €/mes |
| Margen bruto | 80 % | 72 % |
| Churn mensual | 3,0 % | 5,0 % |
| LTV | ~2.370 € | ~995 € |
| CAC objetivo | < 250 € | < 250 € |
| Payback | 3,5 meses | 5,0 meses |
| Objetivo mes 12 | 300 clientes · ~26 k€ MRR | 150 clientes · ~10 k€ MRR |

Mercado: 200 M+ de negocios usan WhatsApp Business mensualmente; se esperan **45.000 M$ de ventas globales vía WhatsApp commerce en 2026** y 3.600 M$+ de gasto empresarial en la plataforma. En España el 99,8 % de las empresas son pymes y hay **90.000+ salones de belleza** más miles de clínicas dentales, fisio, gimnasios y autoescuelas. No nos falta mercado; nos sobra.

### Qué NO vamos a hacer (igual de importante)

- ❌ No construimos un constructor visual de flujos. Ya lo hacen 40 empresas y es una trampa de complejidad.
- ❌ No somos multicanal en el año 1 (nada de Instagram, TikTok, email). WhatsApp y punto.
- ❌ No competimos en "marketing masivo por WhatsApp". Es una carrera a cero con riesgo de baneo.
- ❌ No hacemos voz en el MVP (sí en el roadmap, mes 9+).
- ❌ No perseguimos e-commerce ni enterprise en el año 1.

---

## Índice del documento

| # | Documento | Contenido |
|---|---|---|
| 1 | [`01-mercado-y-competencia.md`](01-mercado-y-competencia.md) | Investigación de mercado, TAM/SAM/SOM, los 9 competidores relevantes, qué hacen bien, qué hacen mal, y nuestro plan para ser mejores. **(Puntos 1–5)** |
| 2 | [`02-problema-cliente-y-mvp.md`](02-problema-cliente-y-mvp.md) | El problema exacto que resolvemos, el cliente ideal, el MVP vendible y el roadmap de 12 meses. **(Puntos 6–9)** |
| 3 | [`03-arquitectura-tecnica.md`](03-arquitectura-tecnica.md) | Arquitectura completa, stack tecnológico, modelo de datos, integración con WhatsApp Business API, escalabilidad y seguridad. **(Puntos 10–12, 16, 18, 19)** |
| 4 | [`04-producto-panel-y-flujos.md`](04-producto-panel-y-flujos.md) | Diseño del panel, flujo del usuario (dueño y cliente final) y flujo completo de la IA. **(Puntos 13–15)** |
| 5 | [`05-monetizacion-y-go-to-market.md`](05-monetizacion-y-go-to-market.md) | Sistema de pagos, precios, unit economics y el plan concreto para los primeros 100 clientes. **(Puntos 17, 20)** |
| 6 | [`06-riesgos-y-decisiones.md`](06-riesgos-y-decisiones.md) | Registro de decisiones de arquitectura, matriz de riesgos y qué haría falta para levantar inversión. |

---

## Nombre y marca (a confirmar por ti)

Nombre de trabajo: **Recepta** (recepción + receta). Alternativas: *Turnia*, *Hueco*, *Silla*.
⚠️ **Acción pendiente tuya:** ninguno de estos nombres se ha comprobado en registro de marcas ni en disponibilidad de dominio. Antes de gastar un euro en identidad visual hay que verificar `.es`/`.com` y la OEPM. Lo dejo marcado porque comprar dominio es un gasto real y no lo ejecuto sin tu confirmación.

---

## Qué necesito de ti antes de escribir código

1. **Confirmar el vertical de arranque** (dental vs. estética/peluquería). Cambia el 30 % del MVP.
2. **Confirmar el nombre** o elegir otro, tras comprobar dominio y marca.
3. **Acceso o decisión sobre Meta**: hay que crear una cuenta de Meta Business, pasar la verificación de negocio (2–5 días hábiles, hasta 14 en algunos casos) y solicitar el alta como **Tech Provider**. Es el camino crítico más largo de todo el proyecto y hay que empezarlo el día 1, en paralelo al desarrollo.
4. **Presupuesto mensual de arranque** para infraestructura y modelos (estimación: 60–150 €/mes hasta los primeros 20 clientes).
5. **Tres clínicas amigas** dispuestas a ser piloto gratuito. Sin esto, construimos a ciegas.

Cuando me confirmes esos cinco puntos, empezamos a programar por la fase 0 descrita en [`02-problema-cliente-y-mvp.md`](02-problema-cliente-y-mvp.md).
