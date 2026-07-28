# 04 — Exámenes de bloque

## Cómo funcionan

- **Se hacen el sábado** de la última semana de cada bloque, en una sesión de 5 h.
- **Nota mínima para avanzar: 70%.** Por debajo, se repite la parte fallada durante la semana siguiente y el bloque siguiente se retrasa. No negocio esto.
- Las partes marcadas **`[sin asistente]`** se hacen sin Claude Code, sin Cursor y sin ChatGPT. Puedes consultar documentación oficial. Si haces trampa aquí, la trampa te la vas a encontrar tú en la semana 9, no yo.
- Las partes marcadas **`[con asistente]`** se hacen como trabajas de verdad: con IA. Ahí evalúo tu criterio, no tu memoria.
- **La parte oral cuenta igual que la práctica.** Saber explicar es lo que te van a comprar los clientes.

---

# EXAMEN 1 — Fundamentos (fin de semana 3)

### Parte A · Teórica oral `[sin asistente]` — 25 puntos
Respondes por escrito, en tus palabras, sin copiar de ningún sitio. Máximo 5 líneas por pregunta.

1. ¿Qué es un token y por qué la entrada y la salida cuestan distinto? (3)
2. Tienes un documento de 500 páginas y una pregunta sobre él. Explica dos estrategias distintas y cuándo elegirías cada una. (5)
3. ¿Qué es el prompt caching, cuánto ahorra aproximadamente y qué lo invalida? (4)
4. Tu clasificador acierta el 82%. El cliente quiere 95%. Enumera cuatro cosas que probarías, en orden, y por qué ese orden. (5)
5. ¿Cuándo elegirías Haiku en lugar de Opus? Da un ejemplo concreto con números. (4)
6. ¿Por qué "no hagas X" funciona peor que decir qué sí hacer? (2)
7. ¿Qué diferencia hay entre `git fetch` y `git pull`? (2)

### Parte B · Práctica `[sin asistente]` — 40 puntos
Tienes 2 h. Te doy un fichero de 40 reseñas de producto sin etiquetar.

- [ ] (15) Construye un clasificador que devuelva `{sentimiento, tema, urgencia, confianza}` con salida estructurada validada.
- [ ] (10) Maneja: reseña vacía, reseña en otro idioma, reseña de 5.000 palabras. Documenta el comportamiento en cada caso.
- [ ] (10) Etiqueta a mano 20 de las 40, mide la precisión e imprime la matriz de confusión.
- [ ] (5) Calcula y documenta el coste por 1.000 reseñas.

### Parte C · Práctica `[con asistente]` — 20 puntos
- [ ] (12) Añade al clasificador una herramienta (tool use) que consulte una API externa y enriquezca el resultado.
- [ ] (8) Refactoriza para que cambiar de modelo sea una variable de entorno, no un cambio de código.

### Parte D · Criterio — 15 puntos
- [ ] (8) Te doy un prompt de 600 palabras escrito por otra persona. Encuentra al menos 4 problemas y reescríbelo.
- [ ] (7) Un cliente te dice: *"quiero un chatbot que responda cualquier cosa sobre mi empresa"*. Escribe las 5 preguntas que le harías antes de dar un precio, y explica por qué cada una.

**Aprobado: 70/100.** Suspenso automático si aparece una clave de API en cualquier commit.

---

# EXAMEN 2 — Automatización (fin de semana 6)

### Parte A · Teórica `[sin asistente]` — 20 puntos
1. ¿Qué es la idempotencia en un webhook y qué pasa exactamente si no la garantizas? (5)
2. Un flujo de n8n falla a las 3 de la mañana. Enumera qué tienes que tener montado para enterarte y para arreglarlo sin perder datos. (5)
3. ¿Qué es RLS en Supabase y por qué importa si tu automatización maneja datos de varios clientes? (5)
4. Explica el límite de la ventana de 24 h de WhatsApp Business y cómo afecta al diseño de un bot. (5)

### Parte B · Práctica — 45 puntos
Te doy un caso: *una clínica dental recibe consultas por email y WhatsApp; quiere clasificarlas, registrarlas y responder las frecuentes.*

- [ ] (15) Diseña el flujo completo en un diagrama **antes de tocar n8n**. Incluye qué pasa cuando algo falla.
- [ ] (20) Impleméntalo en n8n con base de datos en Supabase.
- [ ] (10) Reintentos, notificación de fallos y un log auditable de cada mensaje procesado.

### Parte C · Negocio — 35 puntos
- [ ] (15) **Evidencia de cliente real cobrado.** Factura o justificante de pago. Sin esto, el examen no se aprueba aunque el resto esté perfecto.
- [ ] (10) Cálculo de ROI para ese cliente: horas ahorradas × coste hora = ahorro mensual, frente a lo que le cobraste.
- [ ] (10) Registro de captación: a cuántos contactaste, cuántos respondieron, cuántos se reunieron contigo, cuántos compraron. Con los números reales, no con los que te gustaría.

**Aprobado: 70/100.** La parte C es eliminatoria: sin cliente cobrado no se avanza. Es duro a propósito. Toda la industria está llena de gente técnicamente competente que nunca cruzó esta línea.

---

# EXAMEN 3 — Datos y RAG (fin de semana 9)

### Parte A · Teórica `[sin asistente]` — 25 puntos
1. Explica qué es un embedding a alguien no técnico, en 4 líneas. (5)
2. Tu RAG recupera fragmentos irrelevantes. Da cinco causas posibles ordenadas de más a menos probable. (8)
3. ¿Cuándo NO montarías un RAG? Dos escenarios concretos. (6)
4. ¿Cómo mides que un RAG "funciona"? Nombra al menos tres métricas distintas y qué mide cada una. (6)

### Parte B · Práctica — 45 puntos
Te doy un corpus de ~200 páginas de documentación real.

- [ ] (10) Ingesta: troceado, embeddings, almacenamiento en pgvector. Justifica tu estrategia de troceo por escrito.
- [ ] (10) Recuperación + generación, **con cita de fuente obligatoria** en cada respuesta.
- [ ] (10) Control de alucinación: el sistema dice "no está en los documentos" cuando toca. Demuéstralo con 5 preguntas trampa cuya respuesta no está en el corpus.
- [ ] (15) Set de evaluación de 30 preguntas con respuesta y fuente esperadas, e informe automático de precisión.

### Parte C · Documentos — 20 puntos
- [ ] (12) Extractor de datos estructurados desde 10 facturas en PDF, incluyendo al menos 2 escaneadas de mala calidad.
- [ ] (8) Validación automática (los importes cuadran) y marcado de los casos que necesitan revisión humana.

### Parte D · Criterio — 10 puntos
- [ ] (10) Te doy la arquitectura de un RAG hecha por otra persona con 3 errores de diseño. Encuéntralos y explica el impacto de cada uno.

**Aprobado: 70/100.** Suspenso automático si tu RAG responde con seguridad a una de las preguntas trampa.

---

# EXAMEN 4 — Agentes, producción y venta (fin de semana 12)

### Parte A · Teórica `[sin asistente]` — 20 puntos
1. Las cuatro condiciones que deben cumplirse para usar un agente en lugar de un flujo fijo. (8)
2. ¿Qué es MCP y qué problema resuelve que no resolvía tool use por sí solo? (6)
3. Un agente tuyo se ha gastado 400 € en una noche. Enumera qué falló y qué tres mecanismos lo habrían evitado. (6)

### Parte B · Práctica — 40 puntos
- [ ] (20) Agente con 4+ herramientas propias que resuelve una tarea de negocio de principio a fin, con límite de gasto y traza completa de cada paso.
- [ ] (12) Servidor MCP propio, funcionando desde Claude Code.
- [ ] (8) Desplegado y accesible: no vale "funciona en mi portátil".

### Parte C · Producción — 15 puntos
- [ ] (8) Logs, alertas ante fallos y panel o consulta que responda "¿cuánto me costó ayer?".
- [ ] (7) Documento de operación: qué hacer si el sistema falla, a quién avisar, cómo revertir.

### Parte D · Venta — 25 puntos
- [ ] (15) **Propuesta comercial de 2.000–5.000 € enviada a un cliente identificado.** Diagnóstico, solución, alcance, exclusiones, precio, plazos y mantenimiento.
- [ ] (10) Defiéndela oralmente. Yo hago de cliente difícil: *"es caro"*, *"¿y si no funciona?"*, *"mi sobrino me lo hace por 500 €"*. Necesito ver que respondes sin bajar el precio por reflejo.

**Aprobado: 70/100.** La parte D es eliminatoria: la propuesta tiene que estar **enviada**, no redactada.

---

## Qué pasa después del examen 4

Si apruebas los cuatro, tienes: cinco sistemas en producción, dinero cobrado, evidencia demostrable y una propuesta de cuatro cifras en marcha. En ese momento —y solo en ese— abrimos `08-mapa-12-meses.md` y decidimos la siguiente dirección: especialización vertical, SaaS propio, empleo bien pagado o agencia. **Esa decisión se toma con datos de estas 12 semanas, no con las ganas de hoy.**
