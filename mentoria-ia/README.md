# Mentoría IA — 12 semanas intensivas

Programa de formación diseñado como lo haría un CTO: **orientado a resultados económicos, no a acumular conocimiento**.

> **Duración planificada:** 12 semanas (3 meses), día a día.
> **Continuación:** el mapa de 12 meses está en `08-mapa-12-meses.md`, pero no se planifica hasta cerrar la semana 12.
> **Inicio:** julio 2026 · **Revisión del roadmap:** cada 3 semanas (`07-changelog.md`)

## Índice

| Documento | Qué contiene |
|---|---|
| [`00-contrato-y-diagnostico.md`](00-contrato-y-diagnostico.md) | Reglas del juego, cómo trabajamos, test de diagnóstico, setup y semana 0 |
| [`01-roadmap-12-semanas.md`](01-roadmap-12-semanas.md) | Los 4 bloques: objetivos, contenidos, proyectos, criterios de avance |
| [`02-catalogo-tecnologias.md`](02-catalogo-tecnologias.md) | Cada tecnología con las 7 preguntas obligatorias + **lo que eliminamos y por qué** |
| [`03-plan-diario-bloque-1.md`](03-plan-diario-bloque-1.md) | Semanas 1–3, día a día, con ejercicios concretos |
| [`04-examenes.md`](04-examenes.md) | Los 4 exámenes de bloque y la nota mínima para avanzar |
| [`05-mentalidad-y-negocio.md`](05-mentalidad-y-negocio.md) | Cómo piensa quien construye empresas con IA. Precios, clientes, decisiones |
| [`06-seguimiento.md`](06-seguimiento.md) | Plantillas de registro diario y revisión semanal |
| [`07-changelog.md`](07-changelog.md) | Cambios del roadmap: qué entra, qué sale y por qué |
| [`08-mapa-12-meses.md`](08-mapa-12-meses.md) | Qué viene después de la semana 12 (no se ejecuta todavía) |

## Lo primero que tienes que oír (y no te va a gustar)

Tu lista original tiene **40+ tecnologías**. Esa lista es el primer error, y es exactamente el error que hace que casi nadie llegue a cobrar. No es una lista de aprendizaje: es una lista de ansiedad.

En 12 semanas a 15 h/semana tienes **180 horas**. Repartidas entre 40 tecnologías salen 4,5 horas por cada una: suficiente para hacer un "hola mundo" de todas y no saber hacer nada de verdad con ninguna. Ese perfil no lo contrata nadie y no lo contrata *justamente*.

De tu lista, **11 tecnologías no las vas a tocar** (justificado una por una en `02-catalogo-tecnologias.md`) y **8 las despachas en 2 h cada una** porque son variantes triviales de algo que ya sabrás.

El 20% que produce el 80% son **cinco bloques**:

1. **Prompt engineering aplicado + una API de LLM a fondo** (Anthropic). Las demás APIs son la misma idea con otros nombres.
2. **Programación suficiente** (Python, y TypeScript solo cuando toque) — no para ser ingeniero de software, para no ser rehén de nadie cuando algo se rompe.
3. **Automatización: n8n + webhooks + APIs de terceros + PostgreSQL.** Es donde está el dinero rápido.
4. **Datos propios: embeddings, RAG, OCR, scraping — y evaluación.** Es donde está el dinero serio.
5. **Agentes, MCP y producción.** Es donde está el dinero de 2027.

Y un sexto que no es técnico y decide todo lo demás: **encontrar el problema caro y ponerle precio.** Los cinco primeros bloques serán *commodity* en 24 meses. El sexto no.

## La segunda cosa que no te va a gustar

**"Vibe coding" no es una habilidad que se venda.** Cursor, Claude Code y Windsurf son multiplicadores de productividad, no una profesión. Quien solo hace vibe coding sin fundamentos produce sistemas que funcionan en la demo y explotan en producción — y en producción es donde está el dinero. Los vas a usar desde el día 1 y todos los días, pero como *herramienta*, no como identidad profesional.

Lo que se paga es: **saber qué construir, saber demostrar que lo construido funciona, y saber arreglarlo cuando se rompe un domingo a las 3 de la mañana.**

## Qué habrás conseguido en la semana 12

Objetivos verificables, no sensaciones:

- [ ] 5+ repositorios públicos con sistemas que funcionan y se pueden ejecutar desde cero.
- [ ] 2 automatizaciones corriendo en producción para alguien que no eres tú.
- [ ] 1 asistente RAG sobre documentos reales, con evaluación medida (no "parece que va bien").
- [ ] 1 agente con herramientas propias y un servidor MCP hecho por ti.
- [ ] **Entre 500 y 2.500 € cobrados** de al menos un cliente real.
- [ ] 1 propuesta comercial de 2.000–5.000 € enviada y defendida.
- [ ] Saber decir, para cualquier sistema tuyo, cuánto cuesta ejecutarlo 1.000 veces.

Lo que **no** vas a tener en la semana 12: un SaaS con usuarios de pago, sistemas multiagente sofisticados, ni proyectos de 10.000 €. Eso está en el mapa de 12 meses (`08`), y llega antes si estas 12 semanas se hacen bien.

## Compromiso de horas

El plan está calibrado a **15 h/semana como mínimo viable** (≈2 h entre semana × 5 + 5 h en fin de semana).

| Horas/semana | Qué pasa realmente |
|---|---|
| < 10 h | El plan de 12 semanas se convierte en 24 y lo abandonas en la 8. No lo hagas: pídeme un plan más estrecho |
| 15 h | El plan tal como está escrito. Duro pero sostenible |
| 25 h | Terminas los 4 bloques con holgura y llegas más lejos en la parte comercial |
| 40 h | Solo si es tu ocupación principal. Cuidado con quemarte en la semana 5 |

**Si no puedes sostener 15 h/semana, dímelo hoy**, no en la semana 4. Rediseño hacia un objetivo más estrecho y más rentable a corto plazo (por ejemplo: solo automatización para PYMEs, rentable en 6 semanas). Un plan ambicioso abandonado vale exactamente cero.

## Punto de partida asumido

He mirado este repositorio antes de escribir el plan. Ya hay trabajo hecho: una estrategia completa de tienda Shopify, un MCP de TikTok con endpoints reales, un generador de vídeos, un negocio de limpieza de vehículos. **No partes de cero**: ya has tocado APIs, MCP, Git y trabajo asistido por IA.

Pero eso también dice algo más incómodo: **cuatro proyectos abiertos, cero ingresos.** Es el patrón número uno de fracaso en este camino y la semana 0 empieza exactamente ahí.
