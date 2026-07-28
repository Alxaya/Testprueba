# 00 — Contrato de mentoría, diagnóstico y semana 0

## 1. Reglas del juego

Estas reglas son mías, no tuyas. Las aplico aunque te molesten.

1. **No te doy la razón por defecto.** Si tu idea es mala, te digo por qué y te propongo la alternativa. Si insistes después de oír el argumento, es tu decisión y ejecuto — pero queda escrito en el changelog, con fecha.
2. **No avanzas de bloque sin aprobar el examen.** Sin excepciones y sin "ya lo entiendo". Entenderlo y saber hacerlo son cosas distintas, y solo la segunda se cobra.
3. **Si no hay artefacto, no ha pasado.** Cada día produce un commit, un sistema funcionando, un mensaje enviado a un cliente o un documento entregado. Leer, ver vídeos e "investigar" no son artefactos.
4. **Si detecto procrastinación disfrazada, te lo digo sin adornos.** Las cuatro formas habituales:
   - *Tooling infinito*: cambiar de editor, framework o stack en vez de terminar lo que tienes.
   - *Curso-adicción*: consumir contenido en lugar de construir.
   - *Refactor de lo que nadie usa*: pulir un proyecto sin un solo usuario.
   - *Preparación eterna*: "cuando termine de aprender X, ya empiezo a buscar clientes". Nunca termina.
5. **El roadmap se actualiza, no se venera.** Cada 3 semanas reviso si algo quedó obsoleto o si apareció algo que lo cambia. Todo cambio se justifica en `07-changelog.md`.
6. **Prohibido empezar un proyecto nuevo con otro sin cerrar.** Cerrar = en producción con usuarios, o archivado explícitamente con una frase de por qué.
7. **El trabajo comercial no espera al final.** A partir de la semana 4 hay tareas de captación todas las semanas, aunque técnicamente te sientas "verde". Siempre te vas a sentir verde. Esa sensación no se va nunca; solo cambia de tema.

## 2. Lo que exijo en cada entrega

Todo proyecto cumple esto o no cuenta como terminado:

- [ ] Está en GitHub con un README que explica **qué problema resuelve y de quién es ese problema**.
- [ ] Se ejecuta desde cero siguiendo el README (lo compruebo yo).
- [ ] Maneja errores: qué pasa si la API falla, si el input viene vacío, si el usuario mete basura, si se acaba la cuota.
- [ ] Tiene **coste estimado por 1.000 ejecuciones** en el README. Si no sabes lo que cuesta, no lo puedes vender.
- [ ] Cero claves en el código. Variables de entorno, siempre, desde el primer script.

Ese último punto lo voy a repetir mucho. Filtrar una API key en un repo público es el error más caro y más común de quien empieza, y ahora mismo es trivial que un bot lo detecte en menos de un minuto.

## 3. Diagnóstico inicial — hazlo hoy

No es un examen: calibra la velocidad. Responde con honestidad brutal. Si inflas las respuestas, el plan va demasiado rápido y te estrellas en la semana 3.

Puntúa: **0** = ni idea · **1** = lo he visto o lo he hecho con ayuda · **2** = lo hago solo sin buscar

### Bloque A — Base técnica
| # | Item | Nota |
|---|---|---|
| A1 | Moverme por la terminal (`cd`, `ls`, `mkdir`, rutas relativas) | |
| A2 | `git clone`, `commit`, `push` sin copiar comandos de ningún sitio | |
| A3 | Explicar qué es una rama y por qué existen | |
| A4 | Leer un JSON anidado y decir qué campos tiene | |
| A5 | Escribir un bucle, un `if` y una función en Python | |
| A6 | Explicar qué es una API REST, y qué son GET, POST y un status 401 | |
| A7 | Leer un stack trace y localizar la línea del problema | |

### Bloque B — IA
| # | Item | Nota |
|---|---|---|
| B1 | Diferencia entre usar Claude/ChatGPT en web y usar su API | |
| B2 | Qué es un token y por qué me cobran por ellos (entrada vs salida) | |
| B3 | Qué es la ventana de contexto y qué pasa cuando se llena | |
| B4 | Qué es un system prompt y en qué se diferencia del mensaje de usuario | |
| B5 | Qué es tool use / function calling | |
| B6 | Qué es RAG y, sobre todo, **cuándo NO hace falta** | |
| B7 | Qué es MCP y qué problema concreto resuelve | |

### Bloque C — Negocio
| # | Item | Nota |
|---|---|---|
| C1 | He cobrado alguna vez por un trabajo técnico | |
| C2 | Sé calcular el coste real de una hora de mi trabajo | |
| C3 | Sé escribir a una empresa en frío sin sonar a spam | |
| C4 | Sé estimar cuánto dinero/tiempo le ahorra a una empresa un proceso automatizado | |
| C5 | Tengo acceso real (familia, amigos, exjefes, clientes) a 5+ empresas pequeñas | |

### Interpretación

| Total (máx. 38) | Dónde empiezas |
|---|---|
| 0–12 | Semana 0 completa (5 días). No te saltes nada |
| 13–22 | Semana 0 en 2 días: solo lo que puntuaste 0 o 1 |
| 23–30 | Semana 0 en 1 día (limpieza + setup), directo al Bloque 1 |
| 31+ | Haz directamente el examen del Bloque 1 (`04-examenes.md`). Si lo apruebas, empiezas en el Bloque 2 |

**El bloque C pesa más de lo que parece.** Si sacas 22 en A+B y 2 en C, eres un técnico que no va a cobrar: ese perfil sobra en el mercado y está mal pagado. Si sacas 8 en A+B y 8 en C, tienes un problema mucho más fácil de resolver, porque lo técnico se aprende con horas y lo comercial con años.

## 4. Semana 0 — Limpieza (obligatoria, 1–5 días según diagnóstico)

### 4.1 Cerrar lo abierto

Tienes cuatro proyectos sin cerrar en este repositorio. Para cada uno (`shopify-store`, `tiktok-mcp`, `generador-videos`, `negocio-limpieza-vehiculos`) escribe **tres líneas** en `mentoria-ia/decisiones-semana-0.md`:

1. ¿Qué problema resuelve y **de quién** es ese problema?
2. ¿Alguien ha pagado o pagaría? ¿Cuánto? ¿**Cómo lo sabes**? (una opinión tuya no es evidencia)
3. Decisión: **CONTINÚA** (con el próximo hito y su fecha) o **ARCHIVADO** (con la razón).

**Regla dura: como máximo uno queda en CONTINÚA.** El resto se archivan — no se borran, se archivan con la razón escrita, para que dentro de cuatro meses no vuelvas a empezar el mismo proyecto creyendo que es una idea nueva.

Esto no es burocracia. Es probablemente el ejercicio más valioso de los tres meses: **matar tus propias ideas rápido es la habilidad que más dinero te va a ahorrar.** Un proyecto zombi de ocho meses cuesta más que diez ideas descartadas en una tarde.

### 4.2 Setup obligatorio

Sin esto no arranca el Bloque 1.

| Herramienta | Para qué | Coste |
|---|---|---|
| GitHub (ya lo tienes) | Todo tu trabajo vive aquí | Gratis |
| Claude Code o Cursor | Tu multiplicador diario | ~20 €/mes |
| Cuenta de API de Anthropic | Tu API principal, desde el día 3 | Pago por uso — empieza con 5 € |
| Python 3.11+ y `uv` | Entorno de desarrollo | Gratis |
| n8n (Docker en local, o cloud) | Automatización — se activa en la semana 4 | Gratis self-host |
| Supabase (plan free) | Base de datos — se activa en la semana 5 | Gratis |
| Dominio propio + correo | Para escribir a clientes sin usar Gmail personal | ~12 €/año |

**Gasto total de los 3 meses: 100–180 €.** Si eso es un problema real hoy, dímelo y reordeno el plan para empezar por lo que genera caja antes, con herramientas gratuitas y aceptando que el resultado técnico final sea más modesto.

Norma: **nada se contrata "para más adelante".** Cada suscripción se activa la semana en que se usa. Pagar por herramientas que no usas es la forma más silenciosa de sentir que avanzas sin avanzar.

### 4.3 Higiene de seguridad (30 minutos, hoy)

1. Crea `.gitignore` con `.env`, `.env.*`, `venv/`, `__pycache__/`, `node_modules/`.
2. Revisa tu historial de Git buscando claves ya subidas: `git log -p | grep -iE "api[_-]?key|secret|token|sk-"`.
3. Si encuentras alguna: **revócala en el panel del proveedor primero**, y después limpia el repo. Borrar el commit no basta — mientras la clave sea válida, sigue siendo válida.
4. Activa 2FA en GitHub, Anthropic y tu correo.

## 5. Ritmo semanal (todas las semanas, sin excepción)

| Día | Qué pasa |
|---|---|
| Lunes–viernes | 2 h de ejecución. Tareas cerradas del día en `06-seguimiento.md` |
| Sábado | 4–5 h: bloque grande del proyecto de la semana |
| Domingo (30 min) | **Revisión semanal**: rellenas la plantilla y yo devuelvo diagnóstico, correcciones y las tareas de la semana siguiente |

Si un domingo no hay revisión rellenada, la semana siguiente empieza con el mismo contenido. No avanzo el temario con datos que no tengo.
