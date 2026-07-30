# 01 — Investigación de mercado y competencia

> Puntos 1 a 5 del encargo: mercado, competidores, qué hacen bien, qué hacen mal, cómo somos mejores.

---

## 1. Investigación de mercado

### 1.1 El canal

WhatsApp no es "un canal más" en España y Latinoamérica: es *el* canal. Los datos relevantes a julio de 2026:

| Métrica | Valor | Implicación para nosotros |
|---|---|---|
| Usuarios activos mensuales | ~3.300 M (proyección 3.500 M a cierre de 2026) | El canal no va a desaparecer; el riesgo no es de demanda |
| Negocios usando WhatsApp Business | 200 M+ mensuales (vs. ~50 M en 2020) | Adopción ya resuelta: no hay que evangelizar |
| Usuarios que escriben a cuentas de empresa | 175 M al día | El comportamiento del consumidor ya existe |
| Ventas globales vía WhatsApp commerce (2026) | ~45.000 M $ | El dinero ya fluye por el canal |
| Gasto empresarial en WhatsApp Business | 3.600 M $+ | Presupuesto existente que podemos capturar |
| Tasa de apertura de mensajes | 95–98 % (vs. ~20 % email) | Nuestro producto tiene una ventaja física sobre el email |
| Pymes que consideran los chatbots de WhatsApp críticos | 64 % | Intención de compra declarada |

**Conclusión:** el mercado no hay que crearlo. Está creado, es enorme y está en crecimiento. Nuestro riesgo es competitivo y de diferenciación, no de demanda.

### 1.2 El cambio de modelo económico de Meta (crítico)

Dos cambios regulatorios de plataforma condicionan todo el diseño del producto:

**a) Precio por mensaje (desde el 1 de julio de 2025).** Meta abandonó el modelo de "conversaciones de 24 h" y pasó a **cobrar por mensaje de plantilla entregado**, según país del destinatario y categoría:

| Categoría | Coste orientativo | Nota |
|---|---|---|
| Marketing | ~0,01–0,14 $/msg (>0,11 € en mercados como Alemania) | Sin descuento por volumen, a ningún volumen |
| Utility (utilidad) | 80–90 % más barato que marketing | **Con escalones de descuento por volumen que se resetean cada mes** |
| Authentication (OTP) | ~0,0014 $ (India) a 0,05 $+ (Europa) | No aplica a nuestro caso |
| Service (dentro de la ventana de 24 h) | **Gratis** | Y las primeras 1.000 conversaciones de servicio al mes son gratuitas |

**Consecuencia arquitectónica directa y no negociable:** nuestro producto debe vivir el 90 % del tiempo en **mensajes de servicio (gratis)** y **utility (baratos, con descuento por volumen)**, no en marketing. Un recordatorio de cita es *utility*. Una confirmación es *utility*. Una respuesta dentro de la ventana de 24 h es *gratis*. Un "¡Aprovecha nuestro 20 % de descuento!" es *marketing* y es caro. Esto no es un detalle de facturación: **define qué producto construimos.** Los competidores que apuestan por campañas masivas tienen un COGS estructuralmente peor que el nuestro.

**b) Meta Business Agent (3 de junio de 2026).** El agente de IA nativo de Meta, disponible globalmente tras ~2 años de pruebas en India y México. Gratis hasta el 31 de julio de 2026; desde el **1 de agosto de 2026 cuesta 2 $ por millón de tokens**. Más de 1 M de negocios ya lo usan. Modelo híbrido IA+humano en la misma conversación. Existe además *Meta Business Agent Platform* para empresas grandes, con conexión a Shopify, Zendesk y Salesforce.

**Consecuencia estratégica:** el precio de mercado de "responder preguntas con IA en WhatsApp" acaba de caer a **céntimos por conversación, incluido en la plataforma**. Cualquier propuesta de valor cuyo núcleo sea "contestamos por ti con IA" está muerta a 18 meses vista.

### 1.3 El mercado español concreto

| Dato | Cifra | Fuente/nota |
|---|---|---|
| % de empresas españolas que son pymes | 99,8 % | Estructura empresarial fragmentada = mercado largo |
| Salones de belleza en España | 90.000+ | Vertical grande, ticket bajo |
| Clínicas dentales privadas | ~24.000 (estimación sectorial) | Vertical de ticket alto |
| No-show en clínicas privadas | 12–19 % de las citas | Dolor cuantificable |
| No-show en primeras visitas dentales | Hasta 25 %; >48 % de pacientes nuevos no acuden a la primera cita | El dolor más agudo del sector |
| Coste anual de no-shows, clínica dental media (3 sillones) | **18.000–35.000 €/año** | Nuestro argumento de venta entero |
| Coste de ausencias en clínicas privadas | Hasta 7.500 €/mes | Prensa nacional, 2025 |
| Reducción de ausencias con recordatorios activos | 40–70 % documentado; hasta 50 % con asistentes de IA | Nuestro producto tiene evidencia previa |
| IVA aplicable | 21 % sobre factura total | Relevante para el pricing |

**El cálculo que le vamos a poner delante al cliente:** si tu clínica pierde 24.000 €/año en ausencias y reducimos el 50 %, te devolvemos 12.000 €/año. Te cobramos 1.068 €/año. **ROI de 11×.** Eso se vende solo, no hace falta hablar de IA ni una sola vez.

### 1.4 TAM / SAM / SOM

| Nivel | Definición | Cálculo | Valor |
|---|---|---|---|
| **TAM** | Negocios de cita previa en España (dental, estética, fisio, podología, peluquería, veterinaria, autoescuelas, gimnasios) | ~250.000 negocios × 1.068 €/año | **~267 M€/año** |
| **SAM** | Los que ya usan WhatsApp como canal principal y tienen ≥2 empleados y capacidad de pago | ~35 % del TAM ≈ 87.000 negocios | **~93 M€/año** |
| **SOM (36 meses)** | Cuota realista alcanzable con equipo pequeño y canal de partners | 1,5 % del SAM ≈ 1.300 clientes | **~1,4 M€ ARR** |
| **SOM (12 meses)** | Objetivo del año 1 | 300 clientes | **~320 k€ ARR** |

Ampliable a LatAm (México, Colombia, Argentina, Chile) en el año 2 multiplicando el TAM por ~8, con la ventaja de que el idioma y el hábito de WhatsApp son idénticos o mejores, y la desventaja de un ticket medio un 40–50 % menor.

---

## 2. Competidores principales

Los agrupo por *tipo de amenaza*, que es más útil que por tamaño.

### Grupo A — La plataforma (amenaza existencial)

**1. Meta Business Agent.** Ya descrito. Gratis/casi gratis, dentro de la app, cero fricción de instalación, con la confianza de la marca. Es simultáneamente nuestro mayor competidor y nuestra mayor dependencia.

### Grupo B — Los horizontales internacionales (amenaza de mercado)

**2. ManyChat.** Rey del "comentario → DM" en Instagram. Precio: gratis limitado, Pro desde 29 $, Business desde 69 $. La IA solo está en Pro y Business y, aun en Pro, se limita a respuestas de un paso dentro de flujos, no a conversación real.

**3. Wati.** El más enfocado en WhatsApp puro y en pymes. Growth desde 39 $/mes (5 usuarios), plan medio ~149 $, Business hasta 229 $/mes, con asientos adicionales a 12–24 $ cada uno.

**4. respond.io.** Bandeja multicanal (WhatsApp + Instagram + TikTok) para equipos B2C de tamaño medio. Growth ~159 $/mes. Más capacidad, mayor coste de entrada.

**5. Chatfuel.** Similar a ManyChat, orientado a marketing en redes, presupuestos bajos.

**6. Landbot / Tidio (Lyro) / SleekFlow / Gupshup / Infobip / Twilio.** El resto del pelotón: desde constructores de flujos hasta CPaaS de infraestructura. Twilio, Infobip y Gupshup son *proveedores*, no producto para pymes: los menciono porque son la alternativa "hazlo tú mismo" para nuestros clientes más grandes y porque son un posible canal.

### Grupo C — Los locales hispanohablantes (competencia directa en venta)

**7. Callbell** (España/Italia/LatAm), **B2Chat** (Colombia), **Beex**, **LeadSales**, **Gurusup**, **Whato**. Precios entre 15 € y 80 €/mes por usuario. Son a quienes nos vamos a cruzar en una demo real ante una clínica de Valencia. Buen soporte en español y equipos comerciales locales; producto generalmente más flojo en IA.

### Grupo D — Los verticales de agenda (el competidor que importa)

**8. Recepcionistas de IA verticales** (BookingBee, Vocca, myAIFrontDesk, AgentZap, Trillet, CloudTalk AI Receptionist, y en España Bookniapp, Playmedic, Aimoova). Precios: desde 49 $/mes con 150 minutos incluidos, hasta el rango habitual de **150–500 $/mes**; CloudTalk suma 99 $/mes de add-on de IA sobre 19 $/usuario. La mayoría son **de voz**, no de WhatsApp.

**9. Software de gestión de citas** (Booksy, Treatwell, Fresha, Gesden/Odontonet en dental). Ya tienen la agenda y al cliente. Si añaden IA en WhatsApp, son la amenaza más seria del grupo. **Con estos hay que decidir pronto: competir o integrarse. Mi recomendación es integrarse primero y competir después.**

---

## 3. Qué hacen bien

Con honestidad, porque copiar lo que funciona es más barato que reinventarlo:

1. **Meta**: fricción cero. El negocio no instala nada, no conecta APIs, no paga suscripción aparte. Aprende del contenido del negocio solo. Es una barrera de conveniencia brutal.
2. **ManyChat**: el mejor constructor visual de flujos del mercado y una comunidad enorme de agencias que lo revenden. Su distribución es su producto.
3. **Wati**: onboarding de WhatsApp API rápido y precio de entrada bajo para pymes; sabe explicar la API a alguien no técnico.
4. **respond.io**: bandeja de equipo de verdad — asignaciones, SLAs, roles, informes. Cuando hay 5 personas atendiendo, se nota.
5. **Callbell / B2Chat / Beex**: soporte humano en español, en horario español, con vendedor al teléfono. Para una clínica de 4 personas, esto pesa **más** que las funcionalidades.
6. **Verticales de voz (BookingBee, Vocca)**: han entendido que el valor está en *la cita cerrada*, no en la conversación. Su marketing habla de citas y de ROI, no de tecnología. Es la lección más valiosa de todo este análisis.
7. **Booksy/Fresha**: son dueños de la agenda, que es el sistema de registro del negocio. Quien controla la agenda controla la relación.

---

## 4. Qué hacen mal

Aquí está nuestro hueco. Cada punto es una oportunidad de producto concreta.

### 4.1 Cobran por contacto o por usuario, y el cliente lo odia

Es la queja número uno en G2, Capterra y Trustpilot, de forma consistente:

- ManyChat: *"cobran por contacto y cuentan a toda persona que te manda un DM, aunque no interactúe con ManyChat de ninguna forma"*. Usuarios reportan facturas que se multiplican por 2–3× al crecer la lista, sin previo aviso.
- Wati: precio por asiento **encima** de las tarifas de conversación de Meta; asientos extra a 12–24 $. Para un equipo con leads de bajo volumen, resulta caro para lo que da.
- Reseñas repetidas sobre **cobros después de cancelar** y dificultad para conseguir reembolsos (ManyChat), y sobre **facturación poco clara del sistema de créditos** (Wati).

**Diagnóstico:** el modelo de precios está desalineado con el valor. Al cliente le cobran por *volumen de gente*, no por *resultados*. Un negocio que crece es castigado.

### 4.2 El soporte se cae justo cuando importa

- ManyChat: *"si surge un problema urgente en fin de semana, hay muy poco soporte efectivo"* — crítico para un sistema del que depende la atención al cliente.
- Wati: tiempos de respuesta de 24–48 h+ reportados públicamente, con dificultad para escalar incidencias de cuenta.

Una clínica que se queda sin recepción automática un sábado por la mañana, con la agenda del lunes vacía, cancela el lunes por la tarde. Sin excepción.

### 4.3 La "IA" es marketing, no capacidad

ManyChat limita la IA a respuestas de un paso dentro de flujos predefinidos. La mayoría de horizontales son, en el fondo, **árboles de decisión con una capa de LLM encima**. El resultado es la experiencia que todos conocemos: *"No he entendido tu respuesta. Marca 1 para..."*. En 2026 eso ya no cuela: el usuario final ha hablado con ChatGPT y detecta un bot tonto en dos mensajes.

### 4.4 Nadie cierra el círculo operativo

Este es el fallo estructural del sector, y nuestra oportunidad principal.

Los horizontales **conversan** pero no **operan**: te dejan la conversación en una bandeja para que un humano haga el trabajo de verdad (mirar la agenda, encontrar hueco, apuntar, avisar al profesional). Meta Business Agent tiene exactamente el mismo agujero, documentado: gestiona la *intención* de cita **sin calendario en vivo**, y su capacidad de crear, mover y gestionar citas de forma autónoma está anunciada pero **todavía no disponible**. No tiene integraciones nativas de CRM confirmadas, ni MCP, ni marketplace de integraciones.

Resultado: el dueño de la clínica sigue haciendo el 70 % del trabajo. Ha pagado por un contestador elegante.

### 4.5 Miden vanidad, no dinero

Los paneles del sector muestran: mensajes enviados, tasa de apertura, conversaciones abiertas, tiempo de primera respuesta. **Ninguno muestra euros.** Cuando llega la renovación, el dueño no tiene ni idea de si le ha servido para algo, y ante la duda, cancela. Esto explica el churn crónico del segmento pyme.

### 4.6 Están construidos para el mercado equivocado

La mayoría son de origen indio o del sudeste asiático, optimizados para volúmenes altísimos y tickets bajísimos, con un enfoque muy de campañas de marketing. En España, un negocio de cita previa no quiere mandar 50.000 mensajes: quiere llenar 12 huecos la semana que viene. Producto distinto.

### 4.7 Ignoran el RGPD hasta que un cliente pregunta

Datos de salud son **categoría especial (art. 9 RGPD)**. Muy pocos competidores ofrecen contrato de encargado de tratamiento serio, residencia de datos en la UE y control de retención. Para una clínica dental esto no es un extra: es un requisito legal que su asesor le va a preguntar.

---

## 5. Cómo podemos ser mejores

Siete decisiones estratégicas. Cada una es una respuesta directa a un fallo del apartado 4.

### 5.1 No competir con Meta: montarnos encima

**Meta Business Agent es nuestro proveedor de conversación, no nuestro rival.** La arquitectura contempla explícitamente poder delegar la charla genérica en el agente nativo (barato) y reservar nuestro motor para lo que da dinero: agenda, disponibilidad, cobro, seguimiento. Si Meta baja el precio de la conversación, **nuestro margen mejora**. Estamos posicionados para beneficiarnos del movimiento del gigante en vez de morir de él.

> Regla de diseño: **todo lo que Meta pueda hacer gratis mañana, no puede ser nuestro producto principal hoy.**

### 5.2 Vender el resultado, no la herramienta: el Marcador de ROI

Es nuestra funcionalidad estrella y nadie la tiene:

```
┌────────────────────────────────────────────────────────┐
│  JULIO 2026 · Clínica Dental Sonrisa                   │
│                                                        │
│      3.480 €  generados por Recepta este mes           │
│      ───────────────────────────────────────           │
│      · 14 ausencias evitadas ............ 1.960 €      │
│      · 9 huecos rellenados .............. 1.080 €      │
│      ·  4 citas fuera de horario .......... 440 €      │
│                                                        │
│      Coste de Recepta ...................... 89 €      │
│      Retorno .............................. 39×        │
│                                                        │
│      [Ver las 27 citas una a una]                      │
└────────────────────────────────────────────────────────┘
```

Cada euro es **auditable hasta la cita concreta**. No es una estimación de marketing: es un registro de eventos. Esto ataca directamente la causa raíz del churn del sector (4.5) y convierte la renovación en una decisión obvia.

### 5.3 Precio alineado con el valor: nunca por contacto

- **Tarifa plana por local**, no por contacto ni por usuario. Usuarios ilimitados desde el primer plan.
- El coste de Meta se repercute **de forma transparente**, a coste + un margen pequeño y visible en la factura.
- **Garantía anti no-show**: si en 60 días no reducimos tus ausencias, no pagas.

Esto neutraliza la queja n.º 1 del sector (4.1) y es un argumento comercial demoledor frente a ManyChat y Wati en una demo.

### 5.4 Cerrar el círculo: la agenda es nuestra, no un enlace

Nuestra IA no dice *"te paso con recepción para ver huecos"*. Nuestra IA **consulta disponibilidad real, entendiendo duración por servicio, profesional asignado, sillón/box, buffers de limpieza y solapes, y escribe la cita.** Después la confirma, la recuerda, la reagenda si hace falta, y si se cae, ofrece el hueco a la lista de espera automáticamente.

Esta es la diferencia entre un chatbot y un empleado. Y es, literalmente, la limitación documentada de Meta Business Agent hoy.

### 5.5 Ser el más fiable justo cuando los demás fallan

- **Soporte en español, con SLA de 4 h en horario laboral y guardia de fin de semana** desde el primer día (siendo dos personas: se puede, con turnos y automatización).
- **Modo degradado explícito**: si nuestro motor de IA falla o el LLM está caído, el sistema **no se queda mudo** — responde con plantillas seguras, avisa al negocio por WhatsApp y encola todo para revisión humana. Un fallo nunca puede traducirse en un cliente final ignorado.
- **Modo sombra las 2 primeras semanas**: la IA redacta, el humano aprueba con un toque. Genera confianza y, de paso, nos da datos de entrenamiento de oro.

### 5.6 Vertical y local, no horizontal y genérico

Hablamos el idioma del sector: "primera visita", "revisión", "higiene", "endodoncia", "presupuesto", "mutua", "financiación". Las plantillas, los tiempos por tratamiento y las objeciones vienen precargadas. Un competidor horizontal necesita que el cliente configure todo eso; nosotros llegamos con el 80 % hecho el primer día.

**Onboarding objetivo: de cero a IA respondiendo en menos de 30 minutos, sin llamada técnica.**

### 5.7 Cumplimiento como argumento de venta

Residencia de datos en la UE, contrato de encargado del tratamiento firmado en el alta, cifrado, retención configurable, registro de consentimiento y borrado a demanda. En un sector sanitario, esto **cierra ventas** frente a competidores que no lo tienen. Convertimos una obligación en ventaja competitiva.

---

## Tabla comparativa resumen

| Capacidad | Meta Agent | ManyChat | Wati | respond.io | Verticales de voz | **Recepta** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Conversación IA real | ✅ | ⚠️ 1 paso | ⚠️ | ⚠️ | ✅ | ✅ |
| Reserva en calendario en vivo | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reglas de agenda (recurso, buffer, profesional) | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Lista de espera automática | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Recordatorios anti no-show | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Cobro de señal | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Panel de ROI en euros | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Precio no ligado a contactos | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Bandeja compartida | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Soporte en español con SLA | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ |
| RGPD / datos de salud UE | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |
| Canal WhatsApp nativo | ✅ | ⚠️ | ✅ | ✅ | ❌ voz | ✅ |

---

## Posicionamiento en una frase

> **Recepta no es un chatbot de WhatsApp. Es el recepcionista de tu clínica: coge el teléfono siempre, conoce tu agenda de verdad, y al final de mes te enseña cuánto dinero te ha hecho ganar.**

---

## Fuentes

- [WhatsApp API Pricing Explained (2026) — Authgear](https://www.authgear.com/post/whatsapp-api-pricing/)
- [WhatsApp Business API Pricing 2026 — Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026)
- [WhatsApp Business API Pricing 2026: Per-Message Rates — SetSmart](https://setsmart.io/blog/whatsapp-business-api-pricing)
- [WhatsApp statistics 2026 — Infobip](https://www.infobip.com/blog/whatsapp-statistics)
- [WhatsApp Business Statistics 2026 — WizMessage](https://wizmessage.com/blog/whatsapp-business-statistics)
- [The $45B WhatsApp Business Economy (2026) — Invent](https://www.useinvent.com/blog/the-usd45b-whatsapp-business-economy-how-to-capture-your-share-2026-guide)
- [Qué es Meta Business Agent — Aunoa](https://aunoa.ai/blog/que-es-meta-business-agent-el-agente-de-ia-de-whatsapp-explicado/)
- [Meta Business Agent: Features, Limitations — Wati](https://www.wati.io/en/blog/meta-business-agent/)
- [Meta Business Agent Review (2026) — The AI Agent Index](https://theaiagentindex.com/agents/meta-business-agent)
- [Meta lanza su agente de IA para empresas — La Nación](https://www.lanacion.com.ar/economia/IA/meta-anuncia-su-agente-de-ia-para-transformar-para-siempre-el-uso-de-whatsapp-instagram-y-messenger-nid03062026/)
- [ManyChat Review 2026 — Flowgent](https://flowgent.ai/blog/manychat-review)
- [Manychat vs Wati 2026: Pricing and Hidden Fees — Hack'celeration](https://hackceleration.com/labs/compare/manychat-vs-wati)
- [Wati Review 2026 — Hack'celeration](https://hackceleration.com/labs/review/wati)
- [Wati vs Respond.io (2026) — respond.io](https://respond.io/blog/wati-vs-respondio)
- [Best WhatsApp Chatbots: Top 10 Compared (2026) — respond.io](https://respond.io/blog/best-whatsapp-chatbots)
- [Las ausencias a citas médicas cuestan hasta 7.500 € al mes a las clínicas privadas — El Independiente](https://www.elindependiente.com/sociedad/2025/09/29/las-ausencias-a-citas-medicas-cuestan-hasta-7-500-euros-al-mes-a-las-clinicas-privadas/)
- [Cómo reducir no-shows en clínicas dentales (guía 2026) — Bookniapp](https://bookniapp.com/es/blog/reducir-no-shows-clinicas-dentales-guia-2026/)
- [Sistema de reservas online para negocios de servicios en España en 2026 — SoloLinux](https://sololinux.es/sistema-de-reservas-online-para-negocios-de-servicios-en-espana-en-2026/)
- [¿Cuántos autónomos hay en España? — Quipu](https://getquipu.com/blog/cuantos-autonomos-hay-en-espana/)
- [7 Best AI Receptionists for Salons & Spas in 2026 — CloudTalk](https://www.cloudtalk.io/blog/best-ai-receptionist-for-salons-spas/)
- [Precio Real de WhatsApp Business API en España (2026) — Engrana](https://engrana.es/en/blog/whatsapp-business-api-pricing-spain)
