# 06 — Riesgos, decisiones de arquitectura e inversión

> Anexo del CTO. Lo que un inversor pregunta en el minuto 20 de la reunión, y lo que el equipo necesita saber para no rediscutir lo mismo cada mes.

---

## A. Registro de decisiones (ADR resumido)

Cada decisión con su alternativa y su motivo. Si alguien quiere cambiar una, tiene que rebatir el motivo, no proponer la alternativa otra vez.

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | Vertical de citas (dental primero) | SaaS horizontal para pymes | Meta comoditizó la conversación genérica. El foso está en la operación específica |
| 2 | Meta Cloud API directo como Tech Provider | BSP revendedor (Twilio, 360dialog) | Elimina 15–30 % de margen y una dependencia crítica. Vale el trabajo extra |
| 3 | Monolito modular en TypeScript | Microservicios / poliglota | 1–2 personas. La velocidad manda; las costuras quedan marcadas para extraer luego |
| 4 | PostgreSQL + pgvector | Base vectorial dedicada | Una base menos que operar. pgvector sobra durante años |
| 5 | RLS de PostgreSQL para multi-tenant | Aislamiento solo en la aplicación | Defensa en profundidad. Una fuga entre clínicas nos cierra la empresa |
| 6 | Bucle de agente propio | Framework de agentes genérico | Necesitamos guardarraíles duros, trazabilidad y control de coste. Una abstracción genérica nos los quita |
| 7 | Capa propia de abstracción de LLM | Acoplarse a un proveedor | El mercado de modelos se mueve cada trimestre. Poder cambiar en un día es una ventaja competitiva |
| 8 | Precio plano por local | Por contacto o por asiento | Es la queja n.º 1 del sector contra los líderes. Convertimos su defecto en nuestra bandera |
| 9 | Señales vía Stripe Connect, dinero directo a la clínica | Custodiar el dinero nosotros | Evita ser entidad de pago y toda su carga regulatoria |
| 10 | `value_events` como libro inmutable | Calcular el ROI en vivo | La credibilidad del Marcador depende de que las cifras pasadas no cambien |
| 11 | La IA no da consejo clínico, nunca | Asistente sanitario más "útil" | Riesgo legal y de daño real. Además nos mantiene fuera del "alto riesgo" del Reglamento Europeo de IA |
| 12 | Coexistencia configurable con Meta Business Agent | Ignorar a Meta y competir de frente | Si Meta abarata la conversación, nuestro margen mejora en vez de morir |
| 13 | Modo sombra en el onboarding | Activar la IA a full desde el minuto 1 | La objeción real de una clínica es el miedo a perder el control, no el precio |
| 14 | Sin voz en el MVP | Voz desde el día 1 | Duplicaría el alcance del MVP. Va en T3, cuando el núcleo esté sólido |

---

## B. Matriz de riesgos

Probabilidad × impacto, con mitigación concreta. Los tres primeros son los que quitan el sueño.

### 🔴 Riesgos críticos

**R1 — Meta lanza gestión de agenda nativa en Business Agent.**
*Probabilidad: alta (está anunciado como próxima capacidad). Impacto: severo.*
Es la amenaza número uno y hay que asumirla como escenario probable, no como riesgo remoto.
**Mitigación:** (a) profundidad vertical — Meta hará "conectar Google Calendar", no "buffers de esterilización por box con higienista habilitado"; (b) integración con el software de gestión clínica, que Meta no va a hacer nunca para 8 sistemas españoles; (c) el Marcador de ROI y la relación con el cliente; (d) coexistencia por diseño (decisión 12); (e) **movernos rápido a voz y a multicanal operativo**, donde Meta no llega. Si Meta acaba haciendo el 80 % de lo nuestro, nuestro destino es ser la capa vertical encima, no el sustituto — y eso sigue siendo un negocio.

**R2 — Suspensión de nuestra cuenta de Meta o cambio de las reglas del programa.**
*Probabilidad: media. Impacto: existencial (nos quedamos sin producto en horas).*
**Mitigación:** cumplimiento escrupuloso desde el día 1; **prohibición absoluta de campañas masivas en nuestra plataforma** (aunque un cliente lo pida y pague); vigilancia activa de la calidad de cada número; contacto directo con el equipo de partners de Meta; y **contrato de reserva con un BSP** listo para conmutar en 48 h aunque perdamos margen. Sale caro tenerlo y es un seguro barato.

**R3 — Churn por encima del 6 % mensual.**
*Probabilidad: media-alta (es el mal endémico del SaaS pyme). Impacto: severo.*
**Mitigación:** Marcador de ROI, integración profunda con el software del cliente (barrera de salida), alerta temprana de clientes sin eventos de valor, contacto humano en los primeros 60 días y planes anuales.

### 🟠 Riesgos altos

**R4 — Coste de IA descontrolado.** Mitigación: enrutado de dos niveles, caché de prompts, atajos deterministas, límite de gasto por tenant, y precio con componente de uso para que un cliente intensivo pague lo que consume.

**R5 — Una alucinación con consecuencias reales** (un precio inventado, una cita prometida que no existe). Mitigación: verificación determinista de la salida (§15.3), datos solo desde herramientas, y escalado ante confianza baja. Es la razón de ser de todo el capítulo de guardarraíles.

**R6 — Incidente de datos de salud.** Mitigación: capítulo 19 entero. Y la asunción operativa de que **ocurrirá algo alguna vez**: lo que nos define es el plan de respuesta, no la ilusión de que no pasará.

**R7 — Un competidor local bien financiado copia el posicionamiento.** Mitigación: velocidad, integraciones (lo más lento de copiar) y relación directa con el cliente. Nuestro producto es defendible por acumulación, no por secreto.

### 🟡 Riesgos medios

**R8 — Dependencia de un solo canal (WhatsApp).** Mitigación: la arquitectura separa "canal" de "operación"; añadir teléfono, Instagram o web es un adaptador, no una reescritura.

**R9 — Riesgo de fundador único / factor autobús.** Mitigación: documentación (este repositorio), infraestructura como código, y contratar a la segunda persona técnica antes de los 100 clientes.

**R10 — Estacionalidad** (agosto y Navidad son meses muertos en dental). Mitigación: contratos anuales y planificar la caja.

---

## C. Qué hace falta para levantar inversión (si se decide)

### Recomendación: no levantar hasta el mes 8-12

El coste de construir el MVP es de tiempo, no de dinero. Levantar con 0 clientes significa valoración baja y perder control por un capital que no hace falta. **Mejor plan: llegar a 100 clientes con ~10.000 € de gasto y decidir desde una posición de fuerza.**

### Si se levanta, el material que hay que tener

| Elemento | Estado |
|---|---|
| Documento de mercado y competencia | ✅ Este repositorio |
| Producto funcionando con clientes reales de pago | ⬜ Mes 4 |
| Caso de estudio con euros verificables | ⬜ Mes 4 |
| Métricas: MRR, churn, CAC, LTV, payback | ⬜ Mes 6 |
| Modelo financiero a 36 meses | ⬜ Mes 6 |
| Datos de retención por cohortes | ⬜ Mes 8 |

### Ronda pre-semilla orientativa (mes 8-10)

**Importe: 300–400 k€. Uso:**

| Partida | % | Para qué |
|---|---|---|
| Producto e ingeniería | 45 % | 2 desarrolladores: integraciones y voz |
| Ventas y marketing | 30 % | 1 comercial + partners + captación |
| Soporte y éxito de cliente | 15 % | 1 persona (defensa directa del churn) |
| Infraestructura y legal | 10 % | Escalado, cumplimiento, auditoría |

**Qué compra ese dinero:** pasar de 100 a 800 clientes en 12 meses (≈ 850 k€ de ARR) y abrir México y Colombia.

### El argumento de inversión en cinco frases

1. WhatsApp mueve 45.000 M$ de comercio y 200 M de negocios lo usan; el canal está resuelto.
2. Meta acaba de comoditizar la conversación, lo que **elimina de un plumazo a la mitad de los competidores** y deja libre el terreno de la operación.
3. Los negocios de cita previa pierden 35.000–70.000 €/año en huecos y ausencias; nosotros cobramos 1.068 €/año y lo demostramos en euros.
4. Vertical + integraciones + datos operativos = foso que Meta no va a cavar y que un horizontal no puede copiar rápido.
5. Margen bruto del 79 %, payback en 3,6 meses y un mercado de 250.000 negocios solo en España, replicable en LatAm con el mismo idioma y mejor hábito de canal.

---

## D. Los tres supuestos que hay que validar antes de escribir código serio

Todo el documento se apoya en tres creencias. Si alguna es falsa, el plan cambia. **Se validan en el piloto, no en una hoja de cálculo.**

| # | Supuesto | Cómo se valida | Qué hacemos si es falso |
|---|---|---|---|
| 1 | Una clínica dejará que una IA gestione su agenda de verdad | 3 pilotos con modo sombra: medir cuántas respuestas aprueban sin editar | Si aprueban <70 %, el producto es un copiloto de recepción, no un recepcionista. Cambia el pricing y el mensaje |
| 2 | El ROI es real y medible (≥30 % menos de ausencias) | Medir 60 días antes y 60 días después en los pilotos | Si no baja, no hay producto. Habría que pivotar hacia el ahorro de tiempo administrativo, que es un argumento mucho más débil |
| 3 | Un dentista paga 89 €/mes por esto | Precio fundador a 39 € y, en paralelo, cotizar a 89 € a clientes nuevos | Si nadie paga 89 €, bajamos a 59 € y el modelo sigue en pie con más volumen |

**El supuesto 2 es el pilar.** Todo lo demás —el Marcador, la venta, el precio, la retención— se apoya en que reduzcamos las ausencias de forma medible. Es lo primero que hay que instrumentar cuando se empiece a programar.

---

## E. Siguiente paso concreto

Cuando confirmes los cinco puntos del [`README.md`](README.md), el orden de trabajo es:

1. **Día 1 (en paralelo a todo):** alta en Meta Business, verificación de negocio y solicitud de Tech Provider. Es el camino crítico y no depende de nosotros.
2. **Semana 1:** esqueleto técnico — multi-tenant con RLS, autenticación, despliegue continuo, observabilidad.
3. **Semana 3:** ida y vuelta completa de un mensaje de WhatsApp (recibir, guardar, responder desde la bandeja). Sin IA todavía.
4. **Semana 5:** motor de agenda. **Es la pieza difícil y es nuestro foso: se hace bien o no se hace.**
5. **Semana 7:** motor de IA sobre la agenda, con guardarraíles desde el primer día.
6. **Semana 12:** tres clínicas reales usándolo.

No hay ninguna razón para escribir una línea de código antes de tener el punto 1 en marcha y el vertical confirmado.
