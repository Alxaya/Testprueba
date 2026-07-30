# 04 — Diseño del panel y flujos

> Puntos 13, 14 y 15 del encargo: diseño del panel, flujo del usuario y flujo de la IA.

---

## 13. Diseño del panel

### 13.1 Principio de diseño: el panel es para alguien que no quiere usarlo

Nuestro usuario es un odontólogo de 47 años entre paciente y paciente, con guantes puestos, mirando el móvil 40 segundos. No es un *growth marketer* con dos monitores.

Cinco reglas duras:

1. **El 90 % del valor sin abrir el panel.** El producto trabaja solo. El panel sirve para comprobar y para intervenir puntualmente.
2. **Primero móvil, de verdad.** No "responsive": diseñado para el pulgar. El panel de escritorio es el caso secundario.
3. **Cero jerga.** Nunca "flujo", "nodo", "trigger", "webhook", "tokens", "prompt". Se dice: *asistente*, *cita*, *aviso*, *hueco*, *mensaje*.
4. **Una acción principal por pantalla.** Si hay dos botones del mismo peso, la pantalla está mal diseñada.
5. **Nunca una pantalla vacía sin salida.** Todo estado vacío explica qué es y ofrece el siguiente paso.

### 13.2 Arquitectura de la información

```
Recepta
├── 🏠 Inicio               ← lo que verá el 80 % de los días
├── 💬 Conversaciones       ← la bandeja compartida
├── 📅 Agenda               ← calendario y citas
├── 👥 Pacientes            ← contactos e historial
├── 🤖 Asistente            ← qué sabe y qué puede hacer la IA
│   ├── Conocimiento (web, PDFs, preguntas frecuentes)
│   ├── Servicios y precios
│   ├── Reglas (horarios, qué puede hacer sola, cuándo avisar)
│   └── Revisión (lo que hizo, correcciones)
├── 📊 Resultados           ← el Marcador de ROI
└── ⚙️  Ajustes
    ├── Negocio, horarios y profesionales
    ├── WhatsApp (número, estado, calidad)
    ├── Equipo y permisos
    ├── Avisos y recordatorios
    ├── Suscripción y consumo
    └── Privacidad y datos
```

Siete secciones. Ni una más. Cada sección que añadamos en el futuro tiene que justificar por qué no cabe dentro de una de estas.

### 13.3 Pantalla 1 — Inicio (la más importante del producto)

```
┌──────────────────────────────────────────────────────────────┐
│  Buenos días, Marta            Clínica Sonrisa  ▾    🔔 3    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  💰  Este mes Recepta te ha generado               │    │
│   │                                                     │    │
│   │            3.480 €                                  │    │
│   │      ▲ 22 % más que el mes pasado                   │    │
│   │                                     [Ver detalle →] │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ⚠️  NECESITAN QUE MIRES ESTO                    (2)        │
│   ┌────────────────────────────────────────────────────┐    │
│   │ 🔴 Carmen R. — "me duele mucho, es urgente"         │    │
│   │    hace 4 min · el asistente ha parado y te avisa   │    │
│   │                                      [Responder]    │    │
│   ├────────────────────────────────────────────────────┤    │
│   │ 🟠 Javier M. — pregunta por financiación            │    │
│   │    hace 25 min · fuera del conocimiento cargado     │    │
│   │                              [Responder] [Enseñar]  │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   HOY                                                        │
│   ┌───────────┬───────────┬───────────┬───────────┐         │
│   │    18     │    14     │     2     │     1     │         │
│   │  citas    │ atendidas │ mensajes  │  hueco    │         │
│   │           │  por IA   │ pendientes│  libre    │         │
│   └───────────┴───────────┴───────────┴───────────┘         │
│                                                              │
│   ✅ El asistente está activo · responde en ~8 segundos      │
│      WhatsApp conectado · calidad ALTA 🟢                    │
└──────────────────────────────────────────────────────────────┘
```

**Por qué así:**
- El dinero va arriba del todo. Es lo que justifica la factura del mes que viene.
- Lo segundo es **lo que requiere al humano**, no un mural de gráficas. El panel le dice al dueño qué hacer, no le da deberes de interpretación.
- El estado del sistema y de la calidad del número siempre visible: si algo va mal, se entera aquí, no por un paciente enfadado.
- El botón **[Enseñar]** en una conversación es un patrón clave: convierte cada fallo de la IA en una mejora en 10 segundos, sin ir a ninguna sección de configuración.

### 13.4 Pantalla 2 — Conversaciones

```
┌────────────────┬─────────────────────────────────────────────┐
│ 🔴 Necesita    │  Carmen Ruiz · +34 6•• ••• 412               │
│    ayuda (2)   │  Paciente desde 2023 · 7 citas · 0 ausencias │
│ 🤖 IA (34)     ├─────────────────────────────────────────────┤
│ 👤 Míos (3)    │                                             │
│ ✓ Cerradas     │  Carmen · 21:14                             │
│                │  ┌────────────────────────────────┐         │
│ ──────────     │  │ Hola, ¿tenéis hueco esta       │         │
│ 🔴 Carmen R.   │  │ semana para una limpieza?      │         │
│    urgente     │  └────────────────────────────────┘         │
│ 🟠 Javier M.   │                                             │
│ 🤖 Ana L.      │                     🤖 Asistente · 21:14    │
│ 🤖 Pedro S.    │         ┌─────────────────────────────────┐ │
│ 👤 Luis F.     │         │ ¡Hola Carmen! Sí 😊 Para        │ │
│                │         │ higiene dental (45 min) tengo:  │ │
│                │         │  · Jueves 10:30 con Laura       │ │
│                │         │  · Jueves 17:00 con Laura       │ │
│                │         │  · Viernes 12:15 con Laura      │ │
│                │         │ ¿Cuál te viene mejor?           │ │
│                │         └─────────────────────────────────┘ │
│                │                    ✓✓ leído · 0,0000 € (svc)│
│                │                                             │
│                │  Carmen · 21:16                             │
│                │  ┌────────────────────────────────┐         │
│                │  │ El jueves a las 17 perfecto    │         │
│                │  └────────────────────────────────┘         │
│                │                                             │
│                │  ╔═══════════════════════════════════════╗  │
│                │  ║ 📅 CITA CREADA por el asistente       ║  │
│                │  ║ Higiene dental · Jue 6 ago, 17:00     ║  │
│                │  ║ Laura Gómez · Box 2 · 45 min          ║  │
│                │  ║              [Ver en agenda] [Editar] ║  │
│                │  ╚═══════════════════════════════════════╝  │
│                ├─────────────────────────────────────────────┤
│                │ [⏸ Tomar el control]  Escribe un mensaje... │
│                │ 🟢 Ventana abierta · quedan 23 h 44 min     │
└────────────────┴─────────────────────────────────────────────┘
```

**Detalles que importan:**
- Las **acciones de la IA se muestran como tarjetas**, no como texto. El dueño ve que se creó una cita real, no que "el bot dijo algo".
- **La ventana de 24 h es visible** y en lenguaje humano. Cuando se cierre, el compositor lo explicará: *"Han pasado 24 h desde su último mensaje. Solo puedes enviarle un aviso aprobado (coste ~0,03 €)"*. Educamos sin dar una clase sobre la política de Meta.
- **"Tomar el control"** pausa la IA en esa conversación y la reanuda sola a las 2 h. Nadie tiene que acordarse de reactivar nada.
- El coste por mensaje visible es una decisión de transparencia radical. Genera confianza y previene la sorpresa en la factura, que es la queja n.º 1 contra ManyChat y Wati.

### 13.5 Pantalla 3 — Resultados (el Marcador de ROI)

```
┌──────────────────────────────────────────────────────────────┐
│  Resultados          [Este mes ▾]        [Descargar PDF]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              3.480 €  generados en julio                     │
│              ────────────────────────────                    │
│              Coste de Recepta: 89 €  →  Retorno: 39×         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Ausencias evitadas          14 citas        1.960 €  → │ │
│  │ Huecos rellenados            9 citas        1.080 €  → │ │
│  │ Citas fuera de horario       4 citas          440 €  → │ │
│  │ Pacientes reactivados        0 citas            0 €  → │ │
│  │                                          ─────────     │ │
│  │                                           3.480 €      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  TU TASA DE AUSENCIAS                                        │
│    Antes de Recepta   ████████████████░░  16 %               │
│    Ahora              ██████░░░░░░░░░░░░   6 %               │
│    Media del sector   ███████████████░░░  15 %               │
│                                                              │
│  OTROS DATOS                                                 │
│    Conversaciones atendidas ............ 412                 │
│    Resueltas sin tocar nada ............ 78 %                │
│    Tiempo de respuesta medio ........... 9 segundos          │
│    Horas de trabajo ahorradas .......... ~31 h               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Cada línea es **clicable hasta la cita concreta** con su evidencia: qué mensaje se envió, qué contestó el paciente, qué habría pasado sin nosotros. No es una estimación de marketing: es un registro auditable (tabla `value_events`).

**El PDF descargable es intencionado.** El dueño se lo enseña a su socio, a su gestor y a otros dentistas. Es nuestro mejor comercial.

### 13.6 Pantalla 4 — Asistente

Cuatro pestañas, todas en lenguaje llano:

**Conocimiento** — Lista de lo que el asistente sabe: la web (con fecha de última lectura y botón de releer), PDFs de tarifas, preguntas frecuentes. Con un buscador de prueba: *"pregúntale algo para ver qué contesta"*.

**Servicios y precios** — Tabla editable: servicio, duración, buffer, precio, quién lo hace, si pide señal. Precargada con las 30 prestaciones dentales habituales.

**Reglas** — Interruptores en castellano llano:
```
El asistente puede…
 [✓] Dar precios de la lista        [✓] Crear citas
 [✓] Reagendar citas                [ ] Cancelar citas (avísame a mí)
 [✓] Responder fuera de horario     [✓] Pedir señal en tratamientos >300 €

Avísame siempre cuando…
 [✓] Alguien mencione dolor o urgencia
 [✓] Haya una queja o reclamación
 [✓] Pregunten algo que el asistente no sepa
 [✓] Alguien pida hablar con una persona
```
Estas casillas son, en realidad, la tabla `business_policies`. El dueño está programando el comportamiento del agente sin saber que está programando.

**Revisión** — Cronológico de lo que hizo la IA, con pulgar arriba/abajo y campo de corrección. Es nuestro conjunto de datos de mejora y, para el cliente, su sensación de control.

### 13.7 Sistema visual

- **Tipografía**: Inter. Tamaño base 16 px, nunca menos de 14 px.
- **Color**: base neutra, un solo acento (verde WhatsApp evitado deliberadamente para no parecer un clon; propuesta: azul profundo). Semáforo estricto: rojo = requiere humano, ámbar = atención, verde = todo bien.
- **Modo claro y oscuro** desde el día 1.
- **Accesibilidad**: contraste AA como mínimo, navegación completa por teclado, objetivos táctiles de 44 px.
- **Tono de la interfaz**: cercano y directo, de usted a tú, sin exclamaciones de más. *"Se ha creado la cita"*, no *"¡Genial! 🎉 ¡Tu cita ha sido creada con éxito!"*.

---

## 14. Flujo del usuario

### 14.1 Flujo A — Alta y activación (el que decide si tenemos negocio)

**Objetivo: de la web al primer mensaje atendido en menos de 30 minutos, sin hablar con nadie.**

```
[Anuncio / recomendación / calculadora de no-shows]
        │
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 1. REGISTRO                                    (1 min)  │
 │    Email o Google. Sin tarjeta. Sin llamada de ventas.  │
 └────────────────────────┬────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 2. TU NEGOCIO                                  (2 min)  │
 │    Nombre · tipo (dental) · web · horario                │
 │    ⚡ Leemos la web al vuelo y precargamos servicios,    │
 │       precios y preguntas frecuentes                     │
 └────────────────────────┬────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 3. REVISA LO QUE HEMOS ENCONTRADO              (5 min)  │
 │    "Hemos detectado 12 servicios. ¿Correcto?"            │
 │    El usuario corrige, no crea desde cero.               │
 │    ⬅ Diferencia clave: llegamos con el trabajo hecho    │
 └────────────────────────┬────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 4. TU AGENDA                                   (5 min)  │
 │    Profesionales · sillones · horarios                   │
 │    [Conectar Google Calendar] ← 1 clic, muy recomendado  │
 └────────────────────────┬────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 5. CONECTAR WHATSAPP                        (5-10 min)  │
 │    Embedded Signup de Meta, en una ventana emergente.    │
 │    Dos caminos claros:                                   │
 │      A) Número nuevo (recomendado, sin riesgo)           │
 │      B) Migrar el actual ⚠️ aviso destacado: se pierde   │
 │         el historial del móvil                           │
 └────────────────────────┬────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 6. PRUÉBALO TÚ MISMO                           (3 min)  │
 │    "Escríbete desde tu móvil: [QR]"                      │
 │    El usuario habla con su propio asistente y ve la      │
 │    cita aparecer en su agenda. 🎯 MOMENTO "AJÁ"          │
 └────────────────────────┬────────────────────────────────┘
                          ▼
 ┌─────────────────────────────────────────────────────────┐
 │ 7. MODO SOMBRA (2 semanas, por defecto)                 │
 │    "Durante 14 días el asistente te propondrá las        │
 │     respuestas y tú apruebas con un toque."              │
 │    ⬅ Reduce el miedo a soltar el control, que es la      │
 │       objeción real de una clínica                       │
 └─────────────────────────────────────────────────────────┘
```

**Métricas de este embudo (las vigilamos semanalmente):** registro → negocio configurado (>80 %), → WhatsApp conectado (>60 %, es el paso que más gente pierde), → primer mensaje real atendido (>50 %), → conversión a pago en 14 días (>25 %).

### 14.2 Flujo B — El día a día del dueño

```
 08:30  Abre el móvil. Notificación: "2 conversaciones necesitan
        tu atención. 4 citas creadas anoche."
 08:31  Lee la urgencia de Carmen. Responde a mano en 30 segundos.
 08:32  Cierra la app.
 ...
 14:00  Cancela un paciente de las 18:30. El sistema, solo:
          → busca en la lista de espera quién encaja
          → ofrece el hueco al primero (mensaje utility)
          → si no responde en 20 min, pasa al siguiente
          → adjudica al primero que acepta y avisa al equipo
        El dueño se entera cuando ve la agenda llena.
 ...
 20:00  Notificación: "Hoy: 6 citas creadas, 2 ausencias evitadas,
        290 € recuperados."
```

**Tiempo total de uso del panel: menos de 5 minutos al día.** Ese es el objetivo, y es contraintuitivo: en este producto, el éxito es que el cliente lo use poco y lo note mucho.

### 14.3 Flujo C — El paciente (nuestro usuario final invisible)

```
 22:47  Sábado. Le duele una muela. Busca en Google, ve el WhatsApp
        de la clínica, escribe:
        "hola necesito cita cuanto antes, me duele una muela"
        ↓
 22:47  Respuesta en 8 segundos:
        "Hola 😊 Soy el asistente de Clínica Sonrisa (te atiende
         una persona si lo necesitas). Siento que te duela.
         ¿Es un dolor fuerte y continuo?"
        ↓
 22:48  "si bastante"
        ↓
        [La IA detecta urgencia clínica → NO diagnostica]
        "Te reservo la primera urgencia del lunes a las 9:00 y
         aviso ahora mismo al equipo. Si el dolor es muy intenso
         esta noche, acude a urgencias.
         ¿Te confirmo el lunes a las 9:00?"
        ↓
 22:49  "si por favor"
        ↓
        ✅ Cita creada · equipo notificado · marcada como urgencia
        ↓
 Lunes  07:00  "Buenos días Ana, te esperamos hoy a las 9:00
        08:00  en C/ Mayor 12. ¿Confirmas? [Sí] [Cambiar hora]"
```

Comparado con el estado actual — el mensaje se lee el lunes a las 9:30 y la paciente ya fue a otra clínica — la diferencia de negocio es total. **Y aquí se ven en acción tres decisiones de diseño**: transparencia de IA en el primer mensaje (obligación legal), prohibición de diagnosticar (decisión de riesgo), y escalado con acción útil en lugar de "espera al lunes".

---

## 15. Flujo de la IA

### 15.1 Vista general de la tubería

```
 MENSAJE ENTRANTE
       │
       ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 0. NORMALIZACIÓN                                          │
 │    Texto / audio → transcripción / imagen → descripción   │
 │    Detección de idioma (es / ca / en)                     │
 │    Agrupación: espera 1,5 s por si llegan más mensajes    │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 1. PUERTA DE CONTROL (sin IA, instantánea)                │
 │    ¿Conversación pausada por un humano? → parar           │
 │    ¿Contacto bloqueado / spam?          → parar           │
 │    ¿Es respuesta a un recordatorio      → atajo           │
 │     ("SÍ", "confirmo")?                    determinista   │
 │    ⬅ Este atajo elimina ~25 % de llamadas al modelo       │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 2. CONTEXTO                                               │
 │    Ficha del contacto + historial de citas                │
 │    Resumen rodante de la conversación (no 40 mensajes)    │
 │    Estado: ¿había una cita a medio agendar?               │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 3. CLASIFICACIÓN (modelo rápido y barato)                 │
 │    Intención + urgencia + sentimiento + confianza         │
 │    informar · agendar · reagendar · cancelar ·            │
 │    urgencia_clínica · queja · comercial · otro            │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 4. POLÍTICA (determinista, sin IA)                        │
 │    Consulta business_policies del negocio:                │
 │    ¿la IA puede actuar en esta intención?                 │
 │    ¿a esta hora? ¿este cliente tiene esta función?        │
 │    → Si NO: escalar a humano con aviso al equipo          │
 │    ⬅ El control lo tiene el negocio, no el modelo         │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 5. RAZONAMIENTO CON HERRAMIENTAS (modelo grande)          │
 │    Bucle de máximo 4 ciclos, con presupuesto de tokens    │
 │    y tiempo límite                                        │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 6. VERIFICACIÓN DE SALIDA (determinista)                  │
 │    ¿Menciona un precio? → debe coincidir con el catálogo  │
 │    ¿Menciona un hueco?  → debe venir de una herramienta   │
 │    ¿Da consejo clínico? → bloquear y escalar              │
 │    ¿Longitud, tono, idioma correctos?                     │
 │    → Si falla: no se envía. Se escala.                    │
 └────────────────────────┬─────────────────────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 7. ENVÍO + REGISTRO                                       │
 │    Enviar por Cloud API (servicio o plantilla)            │
 │    Registrar en ai_runs: modelo, tokens, coste, latencia, │
 │    intención, herramientas, resultado                     │
 │    Si hubo valor → registrar en value_events              │
 └──────────────────────────────────────────────────────────┘
```

### 15.2 Las herramientas del agente

El agente **no sabe nada**: pregunta. Estas son sus únicas ventanas al mundo real.

| Herramienta | Qué hace | Guardarraíl asociado |
|---|---|---|
| `buscar_conocimiento` | Búsqueda semántica en el material del negocio | Filtrada por tenant, siempre. Devuelve el fragmento con su origen |
| `consultar_servicio` | Precio, duración y requisitos de un servicio | Fuente única de precios. **El modelo tiene prohibido dar un precio que no venga de aquí** |
| `buscar_disponibilidad` | Huecos reales según servicio, profesional y preferencias | Aplica buffers, solapes, vacaciones y horarios |
| `retener_hueco` | Bloquea un hueco 90 segundos mientras el paciente decide | Evita adjudicar dos veces el mismo hueco |
| `crear_cita` | Crea la cita, transaccional | Idempotente. Falla si hay solape (restricción de base de datos) |
| `mover_cita` / `cancelar_cita` | Reagenda o cancela | Solo si la política del negocio lo permite. Cancelar dispara la lista de espera |
| `apuntar_lista_espera` | Añade al paciente a la lista con sus preferencias | |
| `solicitar_señal` | Genera enlace de pago de Stripe | Solo para servicios marcados como "requiere señal" |
| `escalar_a_humano` | Notifica al equipo con contexto y urgencia | Siempre disponible. **Es la salida segura por defecto** |
| `registrar_nota` | Anota algo en la ficha del paciente | Nunca datos clínicos sensibles sin necesidad |

### 15.3 Los guardarraíles, explícitamente

**Prohibiciones absolutas del agente:**
1. Inventar precios, huecos, horarios o promociones.
2. Dar consejo, diagnóstico u opinión clínica de cualquier tipo. Toda mención a dolor, sangrado, infección, medicación o "¿qué me pasa?" → escalado inmediato, con reserva de la primera urgencia disponible.
3. Prometer resultados de tratamiento.
4. Hablar de otros pacientes o revelar cualquier dato ajeno a la conversación actual.
5. Aceptar instrucciones del mensaje del paciente que contradigan sus reglas (inyección de prompts). La defensa real es arquitectónica: **el modelo solo tiene acceso a los datos de su propio tenant, así que no puede filtrar lo que no puede leer.**
6. Continuar cuando su confianza es baja: por debajo del umbral, escala. **Preferimos un escalado de más que una respuesta inventada.**

**Y una regla de honestidad:** el primer mensaje de cada conversación declara que es un asistente automático y ofrece hablar con una persona. Es obligación de transparencia del Reglamento Europeo de IA y, además, mejora la conversión: la gente perdona a un bot que se presenta como tal, pero se enfada con uno que finge.

### 15.4 Cómo mejora el sistema con el tiempo

```
 Conversación real
        ↓
 Registrada en ai_runs (intención, herramientas, resultado, coste)
        ↓
 ┌──────────────────┬────────────────────┬────────────────────┐
 │ Escalados        │ Correcciones       │ Conversaciones     │
 │ (¿por qué no     │ humanas del        │ que acabaron en    │
 │  supo?)          │ dueño ("Enseñar")  │ cita (éxito)       │
 └────────┬─────────┴─────────┬──────────┴─────────┬──────────┘
          ▼                   ▼                    ▼
   Hueco de conocimiento   Ajuste de           Patrones que
   → sugerir añadirlo      instrucciones       funcionan
   al material                                 → reforzar
          └─────────────────┬──────────────────────┘
                            ▼
              CONJUNTO DE EVALUACIÓN VERSIONADO
              (~200 conversaciones reales etiquetadas)
                            ▼
              Ningún cambio de prompt o de herramienta
              se despliega sin pasar la evaluación
```

**Esto no es un extra: es la disciplina que separa un producto de IA que mejora de uno que se degrada en silencio.** Sin conjunto de evaluación, cada "mejora" del prompt es una apuesta a ciegas que puede romper tres cosas para arreglar una.

### 15.5 Objetivos de calidad medibles

| Métrica | Objetivo MVP | Objetivo mes 12 |
|---|---|---|
| Resolución sin humano | ≥ 70 % | ≥ 85 % |
| Precisión de clasificación de intención | ≥ 90 % | ≥ 96 % |
| Alucinaciones de precio o disponibilidad | **0** (bloqueadas por verificación) | **0** |
| Urgencias clínicas escaladas correctamente | 100 % | 100 % |
| Latencia de primera respuesta (p95) | < 6 s | < 3 s |
| Coste por conversación | < 0,05 € | < 0,02 € |
| Satisfacción del paciente final (encuesta 1-5) | ≥ 4,2 | ≥ 4,5 |

La única métrica con tolerancia cero es la de urgencias clínicas. Todas las demás son de negocio; esa es de responsabilidad.
