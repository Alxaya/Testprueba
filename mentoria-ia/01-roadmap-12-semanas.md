# 01 — Roadmap de 12 semanas

## Vista general

| Bloque | Semanas | Tema | Entregable que decide si apruebas |
|---|---|---|---|
| **0** | Semana 0 | Limpieza, setup, diagnóstico | 4 proyectos decididos + entorno funcionando |
| **1** | 1–3 | Prompt engineering + API de LLM + Python suficiente | 3 herramientas CLI + 1 clasificador con precisión medida |
| **2** | 4–6 | Automatización que se cobra: n8n, webhooks, Postgres | 2 automatizaciones en producción + **primer cliente pagando** |
| **3** | 7–9 | Datos propios: embeddings, RAG, OCR, scraping, evaluación | Asistente RAG desplegado con evals y coste conocido |
| **4** | 10–12 | Agentes, MCP, producción y venta | Agente en producción + servidor MCP propio + propuesta de 2.000–5.000 € |

## Por qué este orden y no otro

Tu lista mezclaba cosas de niveles muy distintos como si fueran comparables. El orden correcto se deduce de cuatro criterios (los tuyos): **demanda de mercado, potencial económico, curva de aprendizaje y utilidad a largo plazo**. Cuando chocan, mando así:

1. **Primero lo que te hace autosuficiente** (Bloque 1). Sin API + Python básico dependes de que la herramienta de turno haga justo lo que necesitas. En el momento en que un cliente pide algo raro —y siempre lo pide— o sabes bajar al código o pierdes el proyecto.
2. **Después lo que genera caja rápido** (Bloque 2). La automatización para PYMEs es el punto del mercado con mejor ratio *dinero / dificultad*. Un flujo de n8n que ahorra 6 horas semanales a una gestoría se vende sin que el cliente entienda una palabra de IA. Cobrar pronto cambia tu psicología entera: dejas de "estudiar IA" y pasas a resolver problemas de gente que paga.
3. **Después lo que sube el precio por proyecto** (Bloque 3). RAG sobre los documentos propios de la empresa es lo que separa un proyecto de 800 € de uno de 5.000 €, porque toca datos que solo tiene ese cliente y nadie más se los puede vender.
4. **Al final lo que te posiciona para 2027** (Bloque 4). Agentes y MCP son lo que hoy diferencia y lo que en dos años será estándar. Se ponen al final porque un agente construido sin dominar contexto, herramientas y evaluación es una demo bonita que no aguanta un cliente real.

**Lo que NO hacemos y por qué:** entrenar modelos, fine-tuning, matemáticas de deep learning, ni "aprender ML". No es que no sea valioso — es que no es tu negocio. Tu ventaja es aplicar modelos frontera a problemas concretos de empresas, no competir con laboratorios que gastan miles de millones. Cada hora en cálculo de gradientes es una hora que no estás vendiendo.

---

# BLOQUE 1 · Semanas 1–3 — Autosuficiencia técnica

> **Objetivo:** que puedas construir cualquier cosa pequeña que se te ocurra, tú solo, sin depender de que exista un nodo o un tutorial. Y que sepas si lo que has construido funciona *de verdad*.

### Contenidos (≈45 h)

| # | Tema | Horas | Por qué está aquí |
|---|---|---|---|
| 1.1 | Terminal, Git y GitHub de verdad (ramas, PRs, resolver conflictos) | 5 | Es tu memoria y tu portfolio. Sin esto no hay evidencia de nada |
| 1.2 | Python suficiente: tipos, funciones, listas/dicts, ficheros, `requests`, entornos con `uv` | 10 | El 90% de lo que vas a escribir cabe en estos conceptos |
| 1.3 | Cómo funciona un LLM por dentro (a nivel operativo, no matemático): tokens, contexto, temperatura, por qué alucina | 3 | Sin este modelo mental, depurar un prompt es superstición |
| 1.4 | **Prompt engineering profesional** | 8 | Ver desglose abajo. Es la palanca más barata de todas |
| 1.5 | **API de Anthropic a fondo**: mensajes, system prompts, streaming, structured outputs, tool use, prompt caching, control de costes | 12 | Tu API principal. Las demás son la misma idea con otros nombres |
| 1.6 | OpenAI API y Gemini API | 2 | Solo las diferencias. Son isomorfas: no merecen más tiempo |
| 1.7 | Evaluación básica: cómo se demuestra que un sistema con IA funciona | 5 | **El diferenciador real.** Cualquiera hace una demo; casi nadie mide |

### 1.4 Prompt engineering profesional — qué es de verdad

Olvida los "1.000 prompts mágicos". El prompting profesional es esto:

- **Rol, tarea, contexto, formato, criterios de éxito** — explícitos, en ese orden.
- **Ejemplos (few-shot)**: 3 buenos ejemplos superan a 3 párrafos de instrucciones. Casi siempre.
- **Descomposición**: una tarea difícil dividida en 3 llamadas simples gana a una llamada heroica.
- **Salida estructurada**: si el resultado lo consume código, exige JSON con esquema (structured outputs), nunca "devuélveme una lista".
- **Instrucciones negativas caras**: decir "no hagas X" funciona peor que describir qué sí hacer. Positivo > negativo.
- **Iteración con datos**: cambias el prompt, pasas tu set de 20 casos, mides. Si no mides, no estás haciendo ingeniería, estás haciendo horóscopo.
- **Coste**: un prompt de 4.000 tokens ejecutado 10.000 veces al mes es una factura. El prompt caching (~90% de ahorro en la parte cacheada) y la elección de modelo son decisiones de arquitectura, no detalles.

### 1.7 Evaluación — el tema que casi nadie estudia y que más te va a diferenciar

La pregunta que separa a un profesional de un aficionado no es "¿sabes hacer un chatbot?", es **"¿cómo sabes que tu chatbot no está mintiendo el 8% de las veces?"**.

Lo mínimo que tienes que dominar en este bloque:
- Construir un **set de evaluación** de 20–50 casos con la respuesta correcta esperada.
- Medir **precisión / aciertos** antes y después de cada cambio del prompt.
- Usar un **LLM como juez** para criterios cualitativos, sabiendo que el juez también se equivoca.
- Registrar cada ejecución (entrada, salida, coste, latencia) para poder auditar después.

Cuando en la semana 11 le digas a un cliente *"mi sistema clasifica correctamente el 94% de los correos, y aquí están los 50 casos de prueba"*, estarás jugando en una liga distinta a la de quien enseña una captura de pantalla.

### Proyectos del bloque (los tres son obligatorios)

1. **`cli-resumen`** — Herramienta de terminal que recibe un fichero (txt/pdf/markdown) y devuelve un resumen estructurado en JSON. Debe manejar ficheros más largos que la ventana de contexto.
2. **`clasificador-emails`** — Clasifica textos en categorías con salida estructurada, **con un set de 30 casos etiquetados y precisión medida**. Este es el que más importa.
3. **`comparador-modelos`** — Script que lanza el mismo prompt contra Claude, GPT y Gemini y compara respuesta, latencia y coste. Aquí aprendes las tres APIs de golpe y te queda una herramienta que usarás todo el año.

### Examen del Bloque 1 → `04-examenes.md`

---

# BLOQUE 2 · Semanas 4–6 — Automatización que se cobra

> **Objetivo:** un sistema tuyo corriendo en la empresa de otra persona, y dinero cobrado. Aunque sean 300 €.

### Contenidos (≈45 h)

| # | Tema | Horas | Por qué está aquí |
|---|---|---|---|
| 2.1 | **n8n** a fondo: nodos, credenciales, error handling, reintentos, self-hosting con Docker | 12 | El estándar de facto para automatización con IA. Ver `02` para la comparación con Make |
| 2.2 | **Webhooks e integraciones**: qué son, cómo se reciben, cómo se aseguran, idempotencia | 5 | Es el pegamento de todo. Sin esto no hay integraciones reales |
| 2.3 | **PostgreSQL + Supabase**: tablas, relaciones, consultas, índices, autenticación, RLS | 10 | Toda automatización seria necesita estado. Aquí es donde vive |
| 2.4 | Bots como interfaz: **Telegram** (prototipar) y **WhatsApp Cloud API** (facturar) | 8 | Telegram se monta en 1 hora; WhatsApp tiene fricción pero es lo que quieren los clientes |
| 2.5 | Automatización de ventas y procesos empresariales: leads, presupuestos, seguimiento, informes | 5 | Los procesos concretos que las PYMEs pagan por automatizar |
| 2.6 | **Captación de clientes** (empieza en la semana 4, no antes ni después) | 5 | Ver `05-mentalidad-y-negocio.md` |

### Cómo se decide qué automatizar (regla que uso yo)

Antes de tocar n8n, un proceso tiene que cumplir tres cosas:
1. **Repetitivo y frecuente** (≥3 veces por semana). Si pasa una vez al mes, automatizarlo cuesta más de lo que ahorra.
2. **Reglas claras o clasificables.** Si el criterio vive en la cabeza de alguien y cambia cada día, primero hay que hacerlo explícito — y esa conversación ya es consultoría facturable.
3. **Con un coste visible.** "Nos ahorra tiempo" no es un argumento de venta. "Ahorra 6 h/semana de una persona que cuesta 22 €/h = 570 €/mes" sí lo es.

Si un proceso no cumple los tres, **no lo automatices y dilo**. Decir que no a un proyecto malo es una de las cosas que más te va a diferenciar de la competencia, que dice que sí a todo y después no entrega.

### Proyectos del bloque

1. **`n8n-lead-pipeline`** — Formulario o email entrante → clasificación con IA → alta en Supabase → aviso por Telegram → respuesta automática redactada. Con reintentos y notificación de fallos.
2. **`bot-atencion-whatsapp`** — Bot que responde preguntas frecuentes de un negocio real, con escalada a humano cuando no está seguro. Ese "cuando no está seguro" es la parte difícil y la que importa.
3. **PROYECTO REAL CON CLIENTE** — Una automatización pagada. Rango objetivo: **300–900 €** para el primero. Si te ofrecen hacerlo gratis "para el portfolio", di que no: cobra 150 € simbólicos como mínimo. El trabajo gratis te enseña a trabajar gratis, y el cliente que no paga tampoco te da feedback serio.

### Examen del Bloque 2 → `04-examenes.md`

---

# BLOQUE 3 · Semanas 7–9 — Datos propios: RAG, OCR y evaluación

> **Objetivo:** subir el precio por proyecto de cientos a miles de euros trabajando sobre los datos que solo tiene tu cliente.

### Contenidos (≈45 h)

| # | Tema | Horas | Por qué está aquí |
|---|---|---|---|
| 3.1 | **Embeddings**: qué son, cómo se calculan, distancia coseno, qué significa "similar" | 5 | La base conceptual. Sin esto, RAG es magia y no puedes depurarlo |
| 3.2 | **Chunking e ingesta**: cómo trocear documentos sin destrozar el significado | 6 | Es donde se rompe el 80% de los RAG malos. Se subestima siempre |
| 3.3 | **pgvector sobre Postgres/Supabase** | 6 | Tu base vectorial. Ver `02`: por qué NO una base vectorial dedicada |
| 3.4 | **RAG completo**: recuperación, reranking, citación de fuentes, control de alucinaciones | 10 | El producto vendible |
| 3.5 | **Evaluación de RAG**: precisión de recuperación, fidelidad de la respuesta, casos trampa | 8 | Lo que convierte una demo en un contrato |
| 3.6 | **OCR y documentos**: PDFs escaneados, facturas, formularios, tablas | 5 | Puerta de entrada a gestorías, despachos, administración, logística |
| 3.7 | **Scraping**: HTTP, HTML, paginación, límites legales y de robots.txt | 5 | Alimentar sistemas con datos externos, sin meterte en problemas |

### La conversación honesta sobre RAG

RAG está a la vez **sobrevalorado y subestimado**, y hay que saber distinguir:

- **Sobrevalorado** como respuesta automática. Con ventanas de contexto de 1M tokens, muchos casos que en 2023 exigían RAG hoy se resuelven metiendo los documentos directamente en el prompt y usando prompt caching. Más simple, más fiable, a veces más barato. **Regla: si el corpus completo cabe en contexto y se consulta con frecuencia, no montes RAG.**
- **Subestimado** en la parte que nadie enseña: la ingesta y la evaluación. Montar un RAG que "responde" son 4 horas con cualquier tutorial. Montar uno que **no se inventa cosas**, que **cita la fuente** y del que puedes demostrar la tasa de acierto son 3 semanas. Justo por eso lo segundo se paga y lo primero no.

### Proyectos del bloque

1. **`rag-documentos`** — Asistente sobre un corpus real (normativa, manuales, contratos, catálogo). Obligatorio: **cita la fuente en cada respuesta** y dice "no lo sé" cuando no está en los documentos.
2. **`ocr-facturas`** — Extractor de datos estructurados desde facturas en PDF/foto a una tabla de Supabase, con validación (que los importes cuadren) y revisión humana de los casos dudosos.
3. **`evals-rag`** — Set de 50 preguntas con respuesta correcta y fuente esperada, con informe automático de precisión. Este es el artefacto que enseñas en una reunión comercial.

### Examen del Bloque 3 → `04-examenes.md`

---

# BLOQUE 4 · Semanas 10–12 — Agentes, MCP, producción y venta

> **Objetivo:** cerrar el círculo. Un sistema autónomo, en producción, monitorizado, y una propuesta comercial seria encima de la mesa.

### Contenidos (≈45 h)

| # | Tema | Horas | Por qué está aquí |
|---|---|---|---|
| 4.1 | **Tool use avanzado**: diseñar herramientas, esquemas estrictos, errores, ejecución en paralelo | 8 | Un agente es un bucle + buenas herramientas. Las herramientas son el 80% |
| 4.2 | **Arquitectura de agentes**: cuándo un agente y cuándo un flujo determinista | 6 | La decisión más importante y la que casi todo el mundo falla |
| 4.3 | **MCP (Model Context Protocol)**: cliente, servidor, recursos, herramientas. Construir el tuyo | 10 | Ya lo has rozado con `tiktok-mcp`. Ahora en serio |
| 4.4 | **Producción**: despliegue, variables de entorno, logs, alertas, límites de gasto | 8 | Sin esto no es un producto, es un experimento |
| 4.5 | **Costes y rendimiento**: elección de modelo, caching, batch, presupuesto por tarea | 5 | Un agente mal diseñado se come el margen del proyecto entero |
| 4.6 | **Multiagente**: qué es, cuándo compensa y por qué normalmente no | 3 | Ver `02`. Casi siempre es complejidad sin retorno |
| 4.7 | **Venta y propuesta**: diagnóstico, alcance, precio, contrato, mantenimiento | 5 | Ver `05-mentalidad-y-negocio.md` |

### Cuándo NO usar un agente (léelo dos veces)

Un agente es un bucle donde el modelo decide qué hacer a continuación. Eso es potente y también caro, lento y difícil de depurar. **Usa un flujo determinista siempre que puedas**, y un agente solo cuando se cumplan las cuatro condiciones:

1. La tarea es multi-paso y **no puedes especificar los pasos de antemano**.
2. El valor del resultado justifica más coste y más latencia.
3. El modelo es realmente capaz de hacerlo (pruébalo antes de arquitecturarlo).
4. **Los errores se pueden detectar y revertir** (tests, revisión humana, rollback).

Si falla una sola de las cuatro, haz un flujo fijo. He visto muchos más proyectos morir por agentificar algo que era un `if` que por lo contrario.

### Proyectos del bloque

1. **`agente-operativo`** — Agente con 4–6 herramientas propias que resuelve una tarea de negocio real de principio a fin (por ejemplo: recibe petición → consulta BD → consulta web → redacta → registra → notifica), con límite de gasto y registro de cada paso.
2. **`mcp-server-propio`** — Un servidor MCP que exponga las herramientas de uno de tus proyectos anteriores, usable desde Claude Code. Aquí conviertes tu trabajo en una capacidad reutilizable.
3. **PROPUESTA COMERCIAL** — Documento de 2.000–5.000 € para un cliente identificado: diagnóstico del problema, solución, alcance, precio, plazos, mantenimiento. **Enviada, no guardada en un cajón.**

### Examen final → `04-examenes.md`

---

## Regla de ajuste continuo

Cada 3 semanas, al cerrar un bloque, reviso tres cosas y las escribo en `07-changelog.md`:

1. **¿Ha aparecido algo que cambie el plan?** (modelo nuevo, capacidad nueva, herramienta que se come a otra).
2. **¿Algo del plan ha dejado de tener sentido?** Se elimina y se explica por qué.
3. **¿Tu velocidad real coincide con la planificada?** Si vas al 60%, recorto alcance en lugar de acumular deuda. Arrastrar un bloque sin terminar es como arrastrar deuda técnica: cada semana cuesta más.

Lo que **no** cambia nunca: el orden autosuficiencia → caja → precio → posicionamiento, y la regla de no avanzar sin aprobar.
