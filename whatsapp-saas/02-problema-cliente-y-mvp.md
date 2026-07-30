# 02 — Problema, cliente ideal, MVP y roadmap

> Puntos 6 a 9 del encargo.

---

## 6. Qué problema resolvemos exactamente

### 6.1 El problema, en una frase

> **Los negocios de cita previa pierden dinero todos los días por conversaciones que nadie atiende a tiempo y por huecos de agenda que nadie rellena.**

No es un problema de "comunicación". Es un problema de **capacidad operativa**: hay una persona (normalmente el dueño, o alguien que además está atendiendo a un paciente) haciendo de centralita con un móvil en el bolsillo del uniforme.

### 6.2 El problema, desmenuzado en cinco pérdidas medibles

**Pérdida 1 — El cliente que escribe fuera de horario y se va.**
El 40–60 % de los mensajes entrantes de un negocio de servicios llegan fuera del horario de atención (noches, findes, festivos). Un mensaje contestado el lunes a las 9:30 ya es un cliente que llamó a la clínica de al lado el sábado. Y aquí no hay segunda oportunidad: el cliente no vuelve a preguntar.

**Pérdida 2 — La ausencia (no-show).**
12–19 % de las citas privadas no se atienden. Hasta 25 % en primeras visitas dentales; más del 48 % de pacientes nuevos no acude a la primera cita. Una clínica dental media de 3 sillones pierde **18.000–35.000 €/año**. El sillón vacío no se recupera: el tiempo del profesional ya se pagó.

**Pérdida 3 — El hueco que se queda vacío.**
Cancelan a las 17:00 la cita de las 18:30. Nadie tiene tiempo de llamar a 20 personas para rellenarlo. El hueco se pierde entero. En una clínica media son 2–4 huecos por semana: entre 8.000 y 15.000 €/año tirados.

**Pérdida 4 — El trabajo administrativo invisible.**
Entre 1,5 y 3 horas diarias de una persona dedicadas a: responder precios repetidos, confirmar citas una por una, reagendar, recordar. A coste laboral español, son **9.000–18.000 €/año** de tiempo de una persona haciendo copiar-pegar.

**Pérdida 5 — El cliente dormido.**
El paciente que vino hace 14 meses a una limpieza y nadie ha vuelto a contactar. Es el cliente más barato del mundo (ya te conoce, ya te pagó) y el más ignorado.

**Suma total de la sangría en una clínica dental media: 35.000–70.000 €/año.** Nosotros cobramos 1.068 €/año. Ese diferencial es todo el negocio.

### 6.3 Cómo lo resuelven hoy (y por qué no funciona)

| Solución actual | Por qué falla |
|---|---|
| WhatsApp Business gratis + móvil | Un solo dispositivo, sin equipo, sin automatización real, respuestas rápidas manuales, número personal del dueño |
| Contratar más recepción | 22.000–28.000 €/año de coste laboral; sigue sin cubrir noches ni findes |
| Servicio de call center externo | Caro, genérico, no conoce el negocio, mala experiencia, no cubre WhatsApp |
| Chatbot de árbol de decisión | El cliente lo detecta en 2 mensajes, se frustra y llama; peor que nada |
| Software de citas con recordatorios por SMS/email | Recordatorio unidireccional: avisa, pero no conversa, no reagenda ni rellena el hueco |
| Meta Business Agent (nativo) | Conversa bien, pero no reserva de verdad: no tiene calendario en vivo ni integraciones |

Todas fallan por lo mismo: **o hay un humano caro, o hay una automatización tonta**. Nadie ha puesto una automatización *lista* al precio de un software.

### 6.4 Lo que NO resolvemos (delimitación honesta)

- No traemos clientes nuevos: no somos una agencia de marketing ni de captación.
- No sustituimos al software de gestión clínica (historia clínica, facturación, radiografías). **Nos integramos con él.**
- No hacemos telemedicina, ni diagnóstico, ni damos consejo sanitario. La IA tiene prohibido opinar sobre salud: eso escala a humano siempre. (Además de ser lo correcto, nos mantiene fuera del ámbito de "sistema de IA de alto riesgo" del Reglamento Europeo de IA.)

---

## 7. Cliente ideal (ICP) — a por uno solo

### 7.1 El ICP primario

> **Clínica dental privada en España, de 1 a 4 sillones, con 3 a 12 empleados, facturación entre 250.000 € y 1,2 M€/año, con el dueño-odontólogo como decisor único, que hoy gestiona WhatsApp desde un móvil compartido en recepción.**

Perfil de la persona que firma: propietario de 35–55 años, es a la vez el clínico principal y el gerente, no tiene departamento de IT, no quiere "aprender un software", cobra por hora de sillón y entiende perfectamente lo que cuesta un hueco vacío.

### 7.2 Por qué este y no otro (criterios de selección)

Puntúo verticales candidatos sobre 5 en los criterios que de verdad predicen si un SaaS pyme funciona:

| Vertical | Dolor en € | Ticket asumible | Decisor único | Canal de distribución | Complejidad de agenda | **Total** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Clínica dental** | 5 | 5 | 5 | 4 | 4 | **23** |
| Estética / medicina estética | 5 | 4 | 5 | 3 | 4 | 21 |
| Fisioterapia / podología | 4 | 3 | 5 | 3 | 3 | 18 |
| Peluquería / barbería | 3 | 2 | 5 | 3 | 3 | 16 |
| Veterinaria | 4 | 4 | 4 | 2 | 3 | 17 |
| Restauración | 2 | 2 | 4 | 3 | 2 | 13 |
| E-commerce | 3 | 3 | 4 | 5 | 1 | 16 |
| Inmobiliaria | 3 | 4 | 3 | 2 | 2 | 14 |

**Razones concretas para dental:**

1. **El dolor se mide en euros y el cliente ya lo sabe.** No hay que educar: todo dentista sabe lo que le cuesta una ausencia. La venta es aritmética.
2. **Ticket alto por cita** (80–3.000 €), lo que hace que 89 €/mes sea irrelevante frente al retorno. Una sola ausencia evitada al mes ya paga el año.
3. **Decisor único y rápido.** El dueño decide en la misma reunión. No hay comité de compras.
4. **Ya pagan software** (Gesden, Odontonet, Klinikare, Dentalink…). Están acostumbrados a la suscripción; no hay que romper la objeción del "yo no pago software".
5. **Canal de distribución identificable**: distribuidores de material dental con comerciales que ya visitan clínicas, colegios profesionales, agencias de marketing dental, congresos sectoriales. Esto es oro para pasar de 30 a 100 clientes.
6. **Agenda compleja de verdad** (duración por tratamiento, sillón, higienista vs. odontólogo, buffers de esterilización) — y esa complejidad es nuestro foso: es lo que Meta no va a resolver a corto plazo.
7. **Sector con boca a boca fortísimo.** Los dentistas hablan entre ellos. Un caso de éxito en una ciudad se propaga.

**Por qué NO restauración ni e-commerce:** ticket bajo, márgenes finísimos, churn altísimo, y en e-commerce competimos de frente contra ManyChat/Chatfuel en su terreno con su distribución. Sería pelear la peor batalla posible.

### 7.3 Anti-ICP (a quién decimos que no, aunque nos paguen)

- Negocios sin cita previa (comercio, hostelería de barra).
- Cadenas y franquicias grandes (>10 locales): ciclo de venta de 6 meses, requisitos enterprise, nos desangran de recursos en el año 1.
- Cualquiera que quiera enviar campañas masivas de marketing por WhatsApp. Riesgo de baneo del número y de nuestra reputación como Tech Provider.
- Negocios sin agenda digital y sin voluntad de tener una. Sin agenda no hay producto.

### 7.4 Expansión ordenada

```
Mes 1-4     Clínicas dentales, 1 ciudad (la tuya)          → 20 clientes
Mes 4-8     Dental, nacional + medicina estética           → 100 clientes
Mes 8-12    + Fisioterapia, podología, veterinaria          → 300 clientes
Año 2       + Peluquería/barbería premium; México y Colombia
```

---

## 8. MVP — la versión mínima para vender

### 8.1 Criterio del MVP

El MVP no es "lo mínimo que funciona". Es **lo mínimo que un dentista paga y no cancela al tercer mes**. Todo lo que no contribuya a que la factura del mes 4 se cobre, fuera.

**Test de aceptación del MVP (una sola frase):** *una clínica que no nos conoce se da de alta sola, y 30 minutos después su WhatsApp está atendiendo pacientes y creando citas reales en su agenda sin que nadie intervenga.*

### 8.2 Alcance funcional del MVP

#### Bloque A — Alta y conexión (el que más ventas mata si falla)

| # | Funcionalidad | Por qué es imprescindible |
|---|---|---|
| A1 | Registro con email/Google y creación de organización | Base |
| A2 | **Conexión de WhatsApp con Embedded Signup de Meta** (número nuevo o migración del existente) | Desde abril de 2026 es el camino por defecto para altas nuevas. Si esto no es de autoservicio, el coste de adquisición se dispara |
| A3 | Asistente de configuración en 6 pasos, ≤30 min | El onboarding *es* el producto en pyme |
| A4 | Ingesta de conocimiento: URL de la web + subida de PDF/imágenes de tarifas + preguntas guiadas | Alimenta el cerebro sin trabajo del cliente |
| A5 | Plantillas dentales precargadas (servicios, duraciones, precios típicos, FAQs) | Llegamos con el 80 % hecho |

#### Bloque B — El motor de IA

| # | Funcionalidad | Detalle |
|---|---|---|
| B1 | Agente conversacional en español (+ catalán e inglés) | Detección automática de idioma |
| B2 | Clasificación de intención | informar · agendar · reagendar · cancelar · urgencia · queja · comercial · spam |
| B3 | Uso de herramientas (tool calling) | consultar disponibilidad, crear cita, mover, cancelar, consultar precio, escalar |
| B4 | **Guardarraíles duros** | Prohibido inventar precios, huecos o consejos clínicos. Todo dato sale de una herramienta, nunca del modelo |
| B5 | Escalado a humano | Por confianza baja, por palabra clave (dolor, urgencia, reclamación) o petición explícita |
| B6 | **Modo sombra** | Las 2 primeras semanas la IA propone y el humano aprueba con un toque |

#### Bloque C — Agenda (nuestro foso)

| # | Funcionalidad | Detalle |
|---|---|---|
| C1 | Agenda propia con recursos | Profesionales, sillones/boxes, horarios, vacaciones, festivos |
| C2 | Catálogo de servicios | Duración, precio, buffer previo/posterior, profesional habilitado, requiere señal sí/no |
| C3 | Motor de disponibilidad | Cálculo de huecos con solapes, buffers y reglas por recurso |
| C4 | Sincronización bidireccional con Google Calendar | Muchas clínicas pequeñas viven ahí |
| C5 | **Lista de espera automática** | Hueco liberado → oferta secuenciada a los candidatos que encajan → primero que acepta se lo lleva |
| C6 | **Recordatorios anti no-show** | T-48 h y T-3 h, con confirmar/reagendar/cancelar de un toque (mensajes *utility*, baratos) |

#### Bloque D — Bandeja y equipo

| # | Funcionalidad |
|---|---|
| D1 | Bandeja compartida en tiempo real, usuarios ilimitados |
| D2 | Toma de control humano ("pausar IA" en una conversación, con reanudación automática a las 2 h) |
| D3 | Ficha de contacto con historial de citas y notas |
| D4 | Web app móvil (PWA) con notificaciones push — el dueño vive en el móvil |

#### Bloque E — Panel y dinero

| # | Funcionalidad |
|---|---|
| E1 | **Marcador de ROI en euros**, auditable cita a cita |
| E2 | Métricas operativas: conversaciones, tasa de resolución sin humano, citas creadas, tasa de no-show |
| E3 | Suscripción con Stripe: prueba de 14 días sin tarjeta, planes, autoservicio de cancelación |
| E4 | Medidor de uso y avisos al 80 % / 100 % del incluido |

#### Bloque F — Cumplimiento (no negociable en sanitario)

| # | Funcionalidad |
|---|---|
| F1 | Contrato de encargado del tratamiento aceptado en el alta |
| F2 | Datos en la UE, cifrado en reposo y en tránsito |
| F3 | Registro de consentimiento de WhatsApp y gestión de bajas |
| F4 | Exportación y borrado de datos de un contacto a demanda |
| F5 | Aviso de IA en el primer mensaje (transparencia exigible) |

### 8.3 Explícitamente FUERA del MVP

Voz · Instagram/Facebook · constructor visual de flujos · campañas masivas de marketing · integración con software de gestión clínica (Gesden y compañía: **va en el mes 5–7**, no antes) · cobro de señales (mes 4) · informes avanzados · API pública · marca blanca · app nativa iOS/Android · multiidioma más allá de ES/CA/EN.

### 8.4 Plan de construcción del MVP (12 semanas, 1–2 personas)

| Semana | Entregable | Riesgo principal |
|---|---|---|
| 0 | **Alta como Meta Tech Provider y verificación de negocio** (en paralelo a todo lo demás) | ⚠️ Camino crítico: 2–14 días hábiles y no depende de nosotros. **Empieza el día 1** |
| 1–2 | Esqueleto: multi-tenant, auth, base de datos, despliegue, CI | Bajo |
| 3–4 | Ingesta de webhooks de WhatsApp, envío, bandeja en tiempo real | Medio — orden e idempotencia de mensajes |
| 5–6 | Motor de agenda: recursos, servicios, disponibilidad, Google Calendar | **Alto — es la pieza más difícil y donde está el foso** |
| 7–8 | Motor de IA: RAG, intenciones, herramientas, guardarraíles, modo sombra | Alto — calidad, no funcionalidad |
| 9 | Recordatorios, lista de espera, plantillas de Meta aprobadas | Medio — la aprobación de plantillas la controla Meta |
| 10 | Panel, Marcador de ROI, Stripe, onboarding autoservicio | Medio |
| 11 | Endurecimiento: RGPD, auditoría, modo degradado, observabilidad | Medio |
| 12 | **Piloto con 3 clínicas reales, gratis, con nosotros dentro** | El único que importa de verdad |

**Puerta de salida del MVP (no se sale sin cumplirlo):** 3 clínicas piloto, ≥70 % de conversaciones resueltas sin humano, ≥1 no-show evitado documentado por clínica y semana, y las 3 dicen por escrito que pagarían.

---

## 9. Roadmap de 12 meses

Cuatro trimestres, cada uno con **un solo objetivo dominante**. Un trimestre con tres prioridades es un trimestre sin ninguna.

### T1 · Agosto–Octubre 2026 — «Que funcione de verdad»
**Objetivo: 10 clientes de pago. MRR 600 €.**

- MVP completo (bloques A–F).
- 3 pilotos gratuitos → convertir a pago con precio fundador (39 €/mes vitalicio).
- Instrumentación de calidad: cada conversación puntuada, revisión manual de los fallos, iteración semanal de prompts y herramientas.
- Contenido inicial: la **calculadora de coste de no-shows** como imán de captación.
- **Métrica de salida:** ≥70 % de resolución autónoma y 0 incidentes de datos.

### T2 · Noviembre 2026–Enero 2027 — «Que se venda solo»
**Objetivo: 60 clientes. MRR 4.500 €.**

- **Cobro de señales** vía Stripe (palanca directa contra el no-show, y la funcionalidad más pedida previsiblemente).
- **Integración con software de gestión clínica**: empezar por 1 (el que usen nuestros primeros clientes) + Google Calendar ya hecho.
- Reactivación de pacientes dormidos (campañas *utility* segmentadas, no marketing masivo).
- Autoservicio de punta a punta: alta, pago y configuración sin tocar a una persona.
- Programa de referidos (1 mes gratis para ambas partes).
- Primeros 2 partners de distribución firmados.
- **Métrica de salida:** CAC < 300 € y churn mensual < 5 %.

### T3 · Febrero–Abril 2027 — «Que escale»
**Objetivo: 160 clientes. MRR 13.000 €.**

- Multi-local y multi-profesional avanzado (cadenas de 2–5 clínicas).
- Expansión a medicina estética y fisioterapia con paquetes verticales.
- **Voz**: recepcionista telefónico con la misma agenda y el mismo cerebro. Es el mayor multiplicador de ARPU (+40–60 €/mes) y donde los verticales de voz cobran 150–500 $/mes.
- Panel de agencia / marca blanca ligera para partners.
- Optimización de costes de IA: enrutado de modelos, caché de prompts, RAG estricto. Objetivo: **−40 % de coste por conversación**.
- **Métrica de salida:** margen bruto ≥ 78 % y NPS ≥ 50.

### T4 · Mayo–Julio 2027 — «Que sea un negocio»
**Objetivo: 300 clientes. MRR 26.000 € (≈312 k€ ARR).**

- 3–4 integraciones más de software de gestión (la barrera de salida más fuerte que existe).
- Analítica avanzada y comparativas de sector ("tu no-show está 4 puntos por encima de la media de clínicas de tu tamaño") — dato que solo tenemos nosotros y que crea efecto de red.
- Preparación de LatAm (México y Colombia): pasarela local, precios locales, soporte en huso horario.
- Certificación de seguridad ligera y auditoría de cumplimiento para vender a cadenas.
- **Métrica de salida:** revenue retention neto ≥ 100 % y payback de CAC < 4 meses.

### Vista de un vistazo

| | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Clientes | 10 | 60 | 160 | 300 |
| MRR | 600 € | 4.500 € | 13.000 € | 26.000 € |
| ARPU | 60 € | 75 € | 81 € | 87 € |
| Equipo | 1–2 | 2 | 3 | 4–5 |
| Foco | Producto | Venta | Escala | Retención |

### Hitos que desbloquean financiación

- **Mes 4:** 10 clientes de pago + 1 caso de estudio con euros → suficiente para levantar una ronda pre-semilla en España (150–300 k€) si se quiere acelerar.
- **Mes 8:** 100 clientes, churn <5 %, CAC recuperado en <4 meses → métricas de semilla.
- **Mes 12:** 300 k€ de ARR con crecimiento del 25 %+ mensual → ronda semilla de 1–2 M€ con posición de fuerza, o rentabilidad y no levantar nada. **Mi recomendación: llegar al mes 12 sin levantar y decidir desde ahí.**
