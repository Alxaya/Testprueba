# 07 — Changelog del roadmap

Aquí se registra **todo cambio del plan**: qué entra, qué sale, por qué, y quién lo decidió. Sirve para dos cosas: que no repitamos debates ya cerrados, y que dentro de tres meses puedas ver por qué el plan es como es.

**Se revisa obligatoriamente al cerrar cada bloque** (semanas 3, 6, 9 y 12), con tres preguntas:
1. ¿Ha aparecido algo que cambie el plan?
2. ¿Algo del plan ha dejado de tener sentido?
3. ¿Tu velocidad real coincide con la planificada?

---

## 2026-07-28 — Versión inicial del plan

**Decisión: plazo de 3 meses en lugar de 12.**
Petición del usuario. El texto original pedía a la vez "3 meses de mentoría" y "en un año nivel profesional". Resuelto así: se planifica día a día un programa de 12 semanas; el arco de 12 meses queda como mapa de continuación en `08-mapa-12-meses.md`, sin planificación diaria hasta cerrar la semana 12.

**Decisión: expectativa económica corregida a la baja.**
El objetivo declarado era "cobrar miles de euros por proyecto". En 12 semanas eso no es realista y prometerlo sería vender humo. Objetivo fijado: 500–2.500 € cobrados y una propuesta de 2.000–5.000 € enviada en la semana 12. Los proyectos de cuatro y cinco cifras están en el mes 4+.

**Eliminadas del plan (11):** Make como herramienta principal, Firebase, bases de datos vectoriales dedicadas, fine-tuning, entrenar modelos / ML clásico, LangChain-LlamaIndex como framework central, sistemas multiagente como objetivo, Voice AI (aplazado, no descartado), bots de Discord como negocio, Bubble y constructores no-code de apps, certificaciones. Justificación una por una en `02-catalogo-tecnologias.md`, nivel C.

**Añadido al plan (no estaba en la lista del usuario):**
- **Evaluación de sistemas con IA** (nivel S). Es la mayor ventaja competitiva disponible y no aparecía en la petición original. Todo el mundo sabe hacer demos; casi nadie sabe demostrar.
- **Captación de clientes y precios** como contenido con horas asignadas desde la semana 4, no como apéndice.
- **Higiene de seguridad** (gestión de claves) desde el día 1.

**Degradadas a "2 horas" (8):** OpenAI API, Gemini API, ChatGPT/Claude/Gemini como productos web, bots de Telegram, bots de Discord, Make, Firebase, no-code genérico. Motivo: son variantes de conceptos del núcleo; el coste marginal de aprenderlas después de dominar el núcleo es mínimo.

**Correcciones directas a la petición original:**
1. "Prompt engineering profesional" no es una profesión. Es una habilidad transversal. Corregido en `02`, ficha S1.
2. "Vibe coding" no es una habilidad vendible. Es un multiplicador de productividad. Corregido en `README.md` y `02`, ficha A3.
3. La lista de 40+ tecnologías es el principal factor de fracaso, no un plan de estudios. Corregido reduciendo a 8 tecnologías núcleo.
4. "Lanzar SaaS" se sitúa al final del recorrido, no al principio: exige distribución y criterio de producto que aún no existen.

**Estado de las tecnologías aplazadas con fecha de revisión:**

| Tecnología | Revisar en | Condición para entrar |
|---|---|---|
| Voice AI | Semana 12 | Bloques 1–4 aprobados y un cliente que lo pida |
| Sistemas multiagente | Semana 12 | Un caso real con trabajo genuinamente paralelo |
| Fine-tuning | Mes 6 | Un caso de volumen alto donde el prompting toque techo |
| Bases vectoriales dedicadas | Cuando el corpus supere lo que aguante pgvector | Medición, no intuición |
| SaaS propio | Mes 4+ | 3 clientes de servicios en el mismo nicho, con el mismo dolor |

---

## Plantilla para las próximas entradas

```markdown
## AAAA-MM-DD — Revisión de fin de Bloque N

**Velocidad real:** __ h/semana de media (planificado: 15)
**Bloque completado:** sí / no / parcialmente (qué falta)
**Nota del examen:** __ / 100

### Cambios en el plan
- ENTRA: <qué> — <por qué> — <a costa de qué se quita>
- SALE: <qué> — <por qué>
- APLAZADO: <qué> — <hasta cuándo> — <con qué condición>

### Decisiones tomadas por el usuario en contra de mi recomendación
- <qué> — mi argumento fue <X> — decisión del usuario: <Y> — se revisa en <fecha>

### Ajuste de expectativas
<si el ritmo real obliga a recortar alcance, se escribe aquí y se recorta — no se arrastra>
```
