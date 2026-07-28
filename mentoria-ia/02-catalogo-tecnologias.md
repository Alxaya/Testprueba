# 02 — Catálogo de tecnologías: qué entra, qué sale y por qué

Cada ficha responde a tus 7 preguntas obligatorias. Las cifras económicas son **estimaciones orientativas para España/Europa en 2026**, basadas en rangos de mercado habituales — verifícalas tú mismo en ofertas reales antes de usarlas para fijar precios. No son garantías.

## Clasificación

| Nivel | Significado | Cuántas |
|---|---|---|
| **S — Núcleo** | Lo aprendes a fondo. Es el 20% que da el 80% | 8 |
| **A — Importante** | Lo aprendes bien, con menos profundidad | 7 |
| **B — Dos horas** | Variante trivial de algo del núcleo. No merece más | 8 |
| **C — Eliminado** | No lo tocamos en estas 12 semanas, con motivo | 11 |

---

# NIVEL S — Núcleo

## S1 · Prompt engineering profesional

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Es la palanca con mejor ratio esfuerzo/resultado de todo el catálogo. Un prompt bien construido puede duplicar la precisión de un sistema sin tocar una línea de código ni gastar un euro más |
| **¿Qué problema resuelve?** | Que el modelo haga exactamente lo que necesitas, de forma consistente y en un formato que tu código pueda consumir |
| **¿Uso en empresas reales?** | Universal. Toda empresa que usa IA lo hace, aunque no le ponga nombre |
| **¿Tiempo para dominarlo?** | 8 h para el 80%. 6 meses de práctica con datos reales para el resto. Es una habilidad que nunca se termina de pulir |
| **¿Qué construyes?** | Todo. No hay proyecto de este plan que no dependa de ello |
| **¿Quién paga?** | Nadie paga "por prompts". Pagan por sistemas que funcionan, y esto es lo que hace que funcionen |
| **¿Ingresos?** | **"Prompt engineer" ya no es un puesto de trabajo** — fue una moda de 2023 que se disolvió. Hoy es una habilidad transversal exigida en puestos de AI engineer (45–90 k€) y automatización |

> ⚠️ **Corrección directa a tu lista:** pediste "prompt engineering profesional" como si fuera una carrera. No lo es, y quien te venda un curso de 2.000 € para ser "prompt engineer" te está vendiendo un puesto que casi no existe. Es una habilidad imprescindible, no una profesión.

## S2 · API de Anthropic (Claude)

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Es tu herramienta principal de trabajo. Dominar **una** API a fondo vale más que conocer tres por encima |
| **¿Qué problema resuelve?** | Meter inteligencia dentro de tu propio software, con control de formato, coste, herramientas y latencia |
| **¿Uso en empresas reales?** | Muy alto, y creciendo especialmente en tareas de código y agentes |
| **¿Tiempo para dominarlo?** | 12 h para ser productivo. 40 h para dominar caching, tool use, streaming y control de costes |
| **¿Qué construyes?** | Clasificadores, extractores, asistentes, agentes, pipelines de documentos — todo el plan |
| **¿Quién paga?** | Cualquier empresa con procesos basados en texto: gestorías, despachos, ecommerce, atención al cliente, RRHH, logística |
| **¿Ingresos?** | AI engineer en España: junior 30–45 k€, medio 45–70 k€, senior 70–110 k€. En remoto para UK/US: 90–180 k€. Freelance: 50–120 €/h |

**Lo mínimo que hay que saber (semana 2–3):** modelos y su precio por millón de tokens (Opus 5: 5 $/25 $ · Sonnet 5: 3 $/15 $ · Haiku 4.5: 1 $/5 $), elegir el modelo adecuado por tarea, structured outputs, tool use, prompt caching (~90% de ahorro sobre la parte cacheada), procesamiento por lotes (50% de descuento) y manejo de errores 429/529.

## S3 · Python suficiente

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Es la diferencia entre "puedo hacer lo que la herramienta permite" y "puedo hacer lo que el cliente necesita" |
| **¿Qué problema resuelve?** | Todo lo que no cabe en un nodo prefabricado: transformaciones raras, integraciones sin conector, lógica de negocio específica |
| **¿Uso en empresas reales?** | Es el lenguaje por defecto de la IA aplicada |
| **¿Tiempo para dominarlo?** | 10 h para lo que necesitas aquí. No necesitas ser programador profesional; necesitas leer, escribir y depurar |
| **¿Qué construyes?** | Scripts, APIs, agentes, integraciones, procesadores de datos |
| **¿Quién paga?** | No se vende Python. Se vende lo que haces con él, y sin él tu techo de precio es bajo |
| **¿Ingresos?** | Indirecto: sube el precio de todo lo demás entre un 50% y un 200% |

## S4 · n8n

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Es la vía más rápida de tu mano al bolsillo de un cliente. Un flujo se monta en horas y se cobra en cientos de euros |
| **¿Qué problema resuelve?** | Conectar sistemas que no se hablan y eliminar trabajo manual repetitivo |
| **¿Uso en empresas reales?** | Alto y en fuerte crecimiento en PYMEs y agencias, sobre todo por ser self-hostable (importante para clientes con datos sensibles: sanidad, legal, RRHH) |
| **¿Tiempo para dominarlo?** | 12 h para ser útil. 40 h para diseñar flujos robustos con reintentos, colas y control de errores |
| **¿Qué construyes?** | Pipelines de leads, respuestas automáticas, informes, sincronización entre CRM/ERP/email, ingesta de documentos |
| **¿Quién paga?** | Gestorías, inmobiliarias, clínicas, ecommerce, agencias de marketing, despachos, distribuidores. **Es el mercado más accesible para empezar** |
| **¿Ingresos?** | Proyecto simple 300–1.500 € · complejo 2.000–8.000 € · mantenimiento 200–1.000 €/mes. Freelance 40–90 €/h al empezar |

> ⚠️ **n8n en lugar de Make.** Ver la ficha C1 más abajo.

## S5 · PostgreSQL + Supabase

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Toda automatización seria necesita recordar algo. Y con `pgvector` también es tu base vectorial: una tecnología menos que aprender |
| **¿Qué problema resuelve?** | Estado, histórico, autenticación, permisos y búsqueda semántica en un solo sitio |
| **¿Uso en empresas reales?** | Postgres es el estándar de bases de datos relacionales. Supabase le añade auth, API y almacenamiento sin montar backend |
| **¿Tiempo para dominarlo?** | 10 h para lo esencial (tablas, joins, índices, RLS). SQL avanzado es un pozo sin fondo que no necesitas todavía |
| **¿Qué construyes?** | El backend de cualquier cosa: automatizaciones con estado, RAG, SaaS, paneles |
| **¿Quién paga?** | Indirecto, pero sin base de datos tu techo son los "juguetes" |
| **¿Ingresos?** | Backend/full-stack con Postgres: 40–75 k€ en España. Como complemento, sube el ticket de tus proyectos |

## S6 · Embeddings + RAG

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Es lo que multiplica por 5 el ticket medio: trabajas sobre datos que solo tiene ese cliente |
| **¿Qué problema resuelve?** | Que el modelo responda con la información interna de una empresa sin inventársela y citando de dónde la saca |
| **¿Uso en empresas reales?** | Muy alto. Es el caso de uso corporativo número uno junto con la clasificación de documentos |
| **¿Tiempo para dominarlo?** | 20 h para uno que funcione. 60 h para uno que funcione **y puedas demostrar que funciona** — la segunda parte es la valiosa |
| **¿Qué construyes?** | Asistentes sobre normativa, manuales, contratos, catálogos, histórico de soporte, base de conocimiento interna |
| **¿Quién paga?** | Despachos legales, consultoras, industria, seguros, sanidad, administración, empresas con mucha documentación |
| **¿Ingresos?** | Proyecto RAG interno: 3.000–15.000 € · mantenimiento 300–1.500 €/mes. Como empleado, es la habilidad que marca el salto de junior a medio |

**Antes de montar un RAG, pregúntate:** ¿cabe el corpus entero en contexto? Si cabe y se consulta a menudo, mételo en el prompt con caching y ahórrate el RAG entero. Saber cuándo *no* hace falta también es dominarlo.

## S7 · Agentes IA (tool use)

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | Es la frontera actual del valor. Un agente no responde: **ejecuta** |
| **¿Qué problema resuelve?** | Tareas multi-paso que no se pueden guionizar de antemano |
| **¿Uso en empresas reales?** | En fuerte crecimiento, aún en fase temprana en PYMEs. Aquí es donde puedes ir por delante del mercado |
| **¿Tiempo para dominarlo?** | 25 h para uno funcional. 100 h+ para uno fiable en producción con costes controlados |
| **¿Qué construyes?** | Agentes de soporte, de operaciones, de investigación, de gestión documental, asistentes de desarrollo |
| **¿Quién paga?** | Empresas medianas con procesos complejos. Ticket alto, ciclo de venta más largo |
| **¿Ingresos?** | Agente en producción: 8.000–30.000 € · retainer 1.000–4.000 €/mes. AI engineer especializado: 70–120 k€ en España, más en remoto internacional |

## S8 · Evaluación de sistemas con IA

| Pregunta | Respuesta |
|---|---|
| **¿Por qué merece la pena?** | **Es tu mayor ventaja competitiva y no estaba en tu lista.** Todo el mundo sabe hacer demos; casi nadie sabe demostrar |
| **¿Qué problema resuelve?** | Responder a "¿y cómo sé que esto no se equivoca?" — la pregunta que decide si te firman el contrato |
| **¿Uso en empresas reales?** | Bajo entre freelances (por eso es tu oportunidad), obligatorio en cualquier empresa seria |
| **¿Tiempo para dominarlo?** | 15 h para lo básico. Es más disciplina que técnica |
| **¿Qué construyes?** | Sets de test, informes de precisión, comparativas de prompts y modelos, monitorización de calidad |
| **¿Quién paga?** | Es lo que convierte un "déjame pensarlo" en una firma. También lo que justifica un mantenimiento mensual |
| **¿Ingresos?** | Indirecto y grande: sube tu tasa de cierre y tu precio. Como puesto (AI/ML evaluation): 55–95 k€ |

---

# NIVEL A — Importante

## A1 · Git y GitHub
Tu memoria, tu portfolio y tu red de seguridad. **5 h.** Sin esto no hay evidencia de nada de lo que dices saber. Un GitHub con 5 proyectos serios vale más que cualquier certificado en una conversación con un cliente técnico.

## A2 · Webhooks e integraciones
El pegamento de todo. **5 h.** Recibir eventos, validar firmas, garantizar idempotencia (que un evento duplicado no cobre dos veces). Se paga como parte de la automatización, pero sin esto no hay integraciones reales.

## A3 · Vibe coding (Cursor / Claude Code / Windsurf)
Multiplicador de productividad de 2–5×, no una profesión. **Se aprende usándolo, no estudiándolo.** Elige **uno** —recomiendo Claude Code por el flujo de terminal y su integración con MCP— y no cambies durante estas 12 semanas. Probar los tres es tooling infinito disfrazado de investigación.

**El riesgo real:** genera código que parece correcto y que no entiendes. La regla es simple y no negociable: **si no puedes explicar línea por línea lo que hace, no lo despliegas para un cliente.**

## A4 · WhatsApp Business (Cloud API)
Alto valor comercial en España: es donde están de verdad los clientes de una PYME. **8 h**, pero con fricción real: verificación de empresa, plantillas aprobadas, ventana de 24 h y coste por conversación. Prototipa en Telegram (1 h) y migra a WhatsApp cuando haya alguien pagando.
**Ingresos:** bot de atención 1.500–6.000 € + mantenimiento.

## A5 · OCR y procesamiento de documentos
Facturas, albaranes, contratos, formularios. **5 h** con modelos multimodales (que hoy hacen innecesario aprender Tesseract y compañía). Puerta de entrada a gestorías, logística y administración, donde el dolor es evidente y el ROI se calcula en 5 minutos.
**Ingresos:** extractor de facturas 2.000–8.000 €.

## A6 · Scraping
Alimentar sistemas con datos externos. **5 h.** Cuidado con lo legal: robots.txt, condiciones de uso y RGPD si hay datos personales. Un scraping que pone a tu cliente en un problema legal te cuesta el cliente y la reputación.

## A7 · MCP (Model Context Protocol)
Estándar para conectar modelos con herramientas y datos. **10 h.** Ya lo has tocado con `tiktok-mcp`. Ha ganado como estándar de facto, así que sí merece el tiempo — pero **después** de dominar tool use, porque MCP sin entender herramientas es copiar una plantilla.
**Ingresos:** todavía no se vende "MCP" como tal; se vende el sistema. Su valor hoy es de posicionamiento y de reutilización de tu propio trabajo.

---

# NIVEL B — Dos horas cada una

Son variantes de algo que ya sabrás. Dedicarles más tiempo es ineficiente.

| Tecnología | Por qué solo 2 h |
|---|---|
| **OpenAI API** | Misma estructura conceptual que Anthropic: mensajes, herramientas, salidas estructuradas. Aprendes las diferencias, no la idea |
| **Gemini API** | Igual. Su punto fuerte hoy es el multimodal y el precio en tareas masivas: úsala cuando toque, no la estudies aparte |
| **ChatGPT / Claude / Gemini como productos web** | Herramientas de uso diario, no objeto de estudio. Lo que se vende es la API |
| **Telegram bots** | Un bot funcionando en 1 h. Perfecto para prototipar antes de meterte en WhatsApp |
| **Discord bots** | Igual de fácil. Útil para comunidades e interfaces internas, **no como línea de negocio** |
| **Make** | Si un cliente ya lo usa, en 2 h te manejas viniendo de n8n. No lo elijas tú |
| **Firebase** | Solo si un cliente ya lo tiene montado. Para lo nuevo, Supabase |
| **No-code / Low-code (Airtable, Zapier, Bubble…)** | Conócelas para hablar con clientes que ya las usan. No construyas tu negocio sobre ellas |

---

# NIVEL C — Eliminado del plan (y por qué)

Aquí es donde más te voy a llevar la contraria. Cada eliminación tiene motivo y alternativa.

## C1 · Make (como herramienta principal) → usa n8n
**Motivo:** Make es más bonito y más cerrado. Cobra por operación (los costes se disparan al escalar), no se puede self-hostar (bloqueante con clientes que no permiten sacar datos fuera) y su capacidad de meter código propio es limitada. n8n te da self-hosting, nodos de código, control de versiones y precio predecible. **Aprende Make solo si un cliente ya lo tiene** — desde n8n te costará 2 horas.

## C2 · Firebase → usa Supabase/PostgreSQL
**Motivo:** para sistemas con IA necesitas búsqueda vectorial (`pgvector`), consultas relacionales y SQL. Firestore es NoSQL y te obliga a montar piezas aparte. Además Postgres es una habilidad transferible a cualquier trabajo; Firebase te ata a un ecosistema.

## C3 · Bases de datos vectoriales dedicadas (Pinecone, Weaviate, Chroma, Qdrant) → usa pgvector
**Motivo:** por debajo de unos pocos millones de fragmentos, `pgvector` sobre la base de datos que ya tienes rinde de sobra. Una base vectorial aparte añade otro servicio que desplegar, pagar, sincronizar y depurar. **Regla: si tu corpus cabe en un Postgres, no montes una base vectorial.** Cuando de verdad te haga falta, la migración son 2 días y ya sabrás por qué la necesitas.

## C4 · Fine-tuning
**Motivo:** el 95% de los casos en los que la gente cree necesitar fine-tuning se resuelven con mejor prompt, mejores ejemplos o RAG — más barato, más rápido y más fácil de cambiar. El fine-tuning tiene sentido para formatos muy específicos a gran volumen o para bajar costes en tareas masivas. Si en el mes 6 tienes ese problema, lo aprendes en una semana. Hoy sería estudiar la solución de un problema que no tienes.

## C5 · Entrenar modelos / ML clásico / matemáticas de deep learning
**Motivo:** no es tu negocio. Tu ventaja es aplicar modelos frontera a problemas de empresas. Podrías dedicar 300 h a esto y seguirías sin poder competir con un laboratorio. Esas 300 h aplicadas a automatización te dan varios clientes.

## C6 · LangChain / LlamaIndex como framework central
**Motivo:** capas de abstracción que cambian rápido, esconden lo que de verdad pasa y complican la depuración. Al principio aprendes el framework en lugar de aprender el problema. Usa los SDK oficiales y escribe tus propias funciones: son 30 líneas. Cuando necesites orquestación compleja de grafos, valorarás LangGraph con criterio — y con criterio, no por moda.

## C7 · Sistemas multiagente (como objetivo)
**Motivo:** están de moda y **casi siempre son complejidad sin retorno**. Multiplican coste, latencia y superficie de fallo. Un agente bien hecho con buenas herramientas gana a cinco agentes hablando entre ellos en la inmensa mayoría de casos reales. Se ven en el temario del Bloque 4 (3 h) para que sepas cuándo compensan: trabajos genuinamente paralelos e independientes. Nada más.

## C8 · Voice AI
**Motivo:** **no está eliminado por malo — está aplazado.** Es un mercado con demanda real (recepcionistas, agendado de citas, cualificación de leads) pero exige latencia baja, manejo de interrupciones, integración telefónica y control de costes. Es un proyecto de Bloque 5–6, no de 12 semanas. Metértelo ahora sería sacrificar los fundamentos que lo hacen posible. **Fecha de revisión: semana 12.**

## C9 · Bots de Discord como línea de negocio
**Motivo:** las comunidades de Discord tienen presupuesto casi nulo. Como interfaz interna vale (2 h en nivel B); como negocio, no.

## C10 · Bubble y constructores no-code de aplicaciones
**Motivo:** te encierran en una plataforma, tienen techo funcional y el conocimiento no es transferible. Con vibe coding + código real construyes más rápido y sin techo. El no-code para *apps* está siendo desplazado justamente por lo que tú vas a aprender.

## C11 · Certificaciones y cursos de "experto en IA"
**Motivo:** cero valor de señal en este mercado. Nadie te va a contratar ni contratar un proyecto por un certificado. Un GitHub con cinco sistemas funcionando y un cliente que dé referencias valen infinitamente más. Si te sale un curso de 1.500 € prometiendo "ser experto en IA en 8 semanas", ese dinero rinde mucho más en créditos de API y en un dominio.

---

## Resumen: dónde está el dinero, ordenado

| Habilidad | Dificultad | Ticket típico | Tiempo hasta el primer euro |
|---|---|---|---|
| Automatización con n8n | Baja | 300–8.000 € | **4–6 semanas** |
| Bots de atención (WhatsApp) | Baja-media | 1.500–6.000 € | 6–8 semanas |
| Extracción de documentos / OCR | Media | 2.000–8.000 € | 8–10 semanas |
| RAG interno | Media-alta | 3.000–15.000 € | 10–14 semanas |
| Agentes en producción | Alta | 8.000–30.000 € | 4–6 meses |
| SaaS propio con IA | Muy alta | 0 € durante meses, luego recurrente | 6–18 meses |

Fíjate en la última fila: **el SaaS es lo último, no lo primero.** Es lo que todo el mundo quiere construir y lo que más gente arruina, porque exige tener ya distribución, criterio de producto y colchón económico. Consultoría y automatización primero: te pagan por aprender qué problemas tiene la gente de verdad. Ese conocimiento es exactamente lo que después convierte un SaaS en algo que alguien compra.
