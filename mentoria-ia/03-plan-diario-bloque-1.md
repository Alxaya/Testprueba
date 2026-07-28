# 03 — Plan diario, Bloque 1 (semanas 1–3)

**Formato:** lunes a viernes 2 h · sábado 5 h · domingo 30 min de revisión. Total 15 h/semana.

**Regla de oro de cada día:** termina con un commit. Un día sin commit es un día que no ha ocurrido.

**Cómo usar el asistente (Claude Code / Cursor) durante este bloque:** úsalo para explicarte cosas, revisar tu código y desatascarte. **No le pidas que escriba el ejercicio entero durante las semanas 1 y 2.** Si le delegas la fase de fundamentos, en la semana 6 vas a estar delante de un cliente sin poder depurar tu propio sistema. A partir de la semana 3 se abre la mano: escribe él, revisas y entiendes tú.

---

# SEMANA 1 — Terminal, Git, Python y tu primera llamada a la API

**Objetivo de la semana:** que puedas crear un proyecto desde cero, versionarlo y llamar a un modelo desde tu propio código.

### Lunes — Terminal y estructura (2 h)
- [ ] Repasa: `cd`, `ls`, `pwd`, `mkdir`, `mv`, `cp`, `rm`, rutas relativas vs absolutas.
- [ ] Instala Python 3.11+ y `uv`. Crea un entorno virtual y actívalo.
- [ ] Crea el repositorio `ia-lab` con esta estructura: `README.md`, `.gitignore`, `01-cli-resumen/`.
- [ ] **Entregable:** repo creado y subido a GitHub.
- **Ejercicio:** sin buscar en Google, crea una carpeta, entra, crea 3 ficheros, renómbralos y borra uno. Si tardas más de 2 minutos, repítelo 5 veces.

### Martes — Git de verdad (2 h)
- [ ] Ciclo completo: `status` → `add` → `commit` → `push`. Diez veces hasta que salga sin pensar.
- [ ] Crea una rama, haz un cambio, súbela, abre un Pull Request, fusiónalo.
- [ ] Provoca un conflicto a propósito y resuélvelo. **Sí, a propósito**: la primera vez que te pase con un cliente delante no puede ser la primera vez.
- [ ] **Entregable:** un PR fusionado y un conflicto resuelto, ambos visibles en el historial.
- **Pregunta que te haré el domingo:** ¿qué diferencia hay entre `git fetch` y `git pull`?

### Miércoles — Python I (2 h)
- [ ] Variables, tipos, `f-strings`, listas, diccionarios, bucles, condicionales, funciones.
- [ ] **Ejercicio 1:** función que recibe una lista de números y devuelve media, máximo y mínimo en un diccionario.
- [ ] **Ejercicio 2:** lee un fichero `.txt` y cuenta cuántas veces aparece cada palabra. Devuelve las 10 más frecuentes.
- [ ] **Entregable:** ambos ejercicios en `ejercicios/semana-1/`.

### Jueves — Python II: ficheros, JSON y errores (2 h)
- [ ] Leer y escribir ficheros. Módulo `json`. `try/except` y por qué capturar `Exception` a lo bruto es mala idea.
- [ ] Variables de entorno con `os.environ` y `python-dotenv`. Crea tu `.env` y **verifica que está en `.gitignore`**.
- [ ] **Ejercicio:** script que lee un JSON de configuración, valida que existan los campos obligatorios y falla con un mensaje claro si falta alguno.
- [ ] **Entregable:** script + un `.env.example` (sin valores reales) en el repo.

### Viernes — Cómo funciona un LLM (2 h)
- [ ] Conceptos operativos: token, ventana de contexto, entrada vs salida, por qué alucina, por qué no sabe qué día es hoy.
- [ ] Calcula: si un prompt son 3.000 tokens de entrada y 500 de salida, ¿cuánto cuestan 10.000 ejecuciones con Sonnet 5 (3 $/1M entrada, 15 $/1M salida)? **Hazlo a mano.**
- [ ] Repite el cálculo con Opus 5 (5 $/25 $) y con Haiku 4.5 (1 $/5 $). Escribe en tres líneas cuándo usarías cada uno.
- [ ] **Entregable:** `notas/coste-modelos.md` con los tres cálculos y tu conclusión.

### Sábado — Primera llamada a la API + `cli-resumen` v0 (5 h)
- [ ] Crea tu cuenta de API de Anthropic. Carga 5 €. Guarda la clave en `.env`.
- [ ] Primera llamada: `pip install anthropic`, mensaje simple, imprime la respuesta.
- [ ] Imprime también `response.usage` (tokens de entrada y salida) y calcula el coste de esa llamada concreta.
- [ ] Construye `cli-resumen` v0: recibe un `.txt` por argumento y devuelve un resumen de 5 líneas.
- [ ] Añade manejo de errores: fichero inexistente, fichero vacío, fallo de API.
- [ ] **Entregable:** `01-cli-resumen/` funcionando con su README.

### Domingo — Revisión (30 min)
Rellena `06-seguimiento.md`. Envíamela.

---

# SEMANA 2 — Prompt engineering y la API a fondo

**Objetivo:** pasar de "pedirle cosas al modelo" a "diseñar el comportamiento del modelo".

### Lunes — Anatomía de un prompt profesional (2 h)
- [ ] Estructura: rol · tarea · contexto · formato · criterios de éxito.
- [ ] **Ejercicio:** coge un prompt malo tuyo (uno real, de los que has usado en el proyecto de TikTok o Shopify) y reescríbelo con la estructura completa. Guarda las dos versiones.
- [ ] Ejecuta ambos 5 veces con la misma entrada y anota las diferencias de consistencia.
- [ ] **Entregable:** `notas/prompt-antes-despues.md` con las dos versiones y tus observaciones.

### Martes — System prompt, few-shot y descomposición (2 h)
- [ ] Diferencia real entre system prompt y mensaje de usuario, y qué poner en cada uno.
- [ ] **Ejercicio:** tarea de clasificación resuelta de dos formas — (a) instrucciones detalladas, (b) 3 ejemplos. Compara resultados sobre 10 casos.
- [ ] **Ejercicio:** coge una tarea compleja (leer un email → decidir prioridad → redactar respuesta) y divídela en 3 llamadas encadenadas. Compárala con hacerlo de una sola vez.
- [ ] **Entregable:** ambos experimentos con conclusiones escritas.

### Miércoles — Salidas estructuradas (2 h)
- [ ] Structured outputs: forzar JSON con esquema. Por qué "devuélveme un JSON" en el prompt no es suficiente para producción.
- [ ] **Ejercicio:** extractor que recibe la descripción libre de un producto y devuelve `{nombre, precio, categoría, en_stock}` validado.
- [ ] Provoca fallos a propósito: entrada vacía, entrada absurda, entrada en otro idioma. Documenta qué hace el sistema en cada caso.
- [ ] **Entregable:** extractor + tabla de comportamiento ante entradas raras.

### Jueves — Contexto largo y caching (2 h)
- [ ] Qué hacer cuando el documento no cabe: trocear + resumir por partes + resumen final.
- [ ] Prompt caching: qué es, cuándo se activa, cuánto ahorra (~90% en la parte cacheada), y qué lo invalida (cualquier byte que cambie antes del punto de corte — por eso nunca metas la fecha actual al principio del system prompt).
- [ ] **Ejercicio:** amplía `cli-resumen` para aceptar documentos de 100+ páginas.
- [ ] **Entregable:** `cli-resumen` v1 con estrategia de troceo y coste medido.

### Viernes — Las otras dos APIs (2 h)
- [ ] OpenAI API y Gemini API: solo las diferencias de sintaxis y de precio respecto a lo que ya sabes.
- [ ] **Ejercicio:** el mismo prompt en las tres, midiendo respuesta, latencia y coste.
- [ ] **Entregable:** `03-comparador-modelos/` v0 funcionando.
- **Reflexión obligatoria (3 líneas en el README):** ¿en qué se parecen tanto las tres APIs que aprender la segunda te llevó 40 minutos? Si entiendes eso, ya no le vas a tener miedo a ninguna API nueva.

### Sábado — `clasificador-emails` v0 (5 h)
- [ ] Elige un caso real: clasificar correos entrantes de un negocio en 5 categorías (venta, soporte, factura, spam, otro).
- [ ] Reúne o genera **30 ejemplos reales** y etiquétalos a mano. Sí, a mano. Este es el trabajo que casi nadie hace y por eso casi nadie tiene sistemas fiables.
- [ ] Construye el clasificador con salida estructurada y nivel de confianza.
- [ ] **Entregable:** clasificador + `casos.jsonl` con los 30 casos etiquetados.

### Domingo — Revisión (30 min)

---

# SEMANA 3 — Evaluación, tool use y cierre de bloque

**Objetivo:** dejar de creer que tus sistemas funcionan y empezar a demostrarlo.

### Lunes — Tu primer set de evaluación (2 h)
- [ ] Escribe `evaluar.py`: recorre los 30 casos, compara la salida del clasificador con la etiqueta correcta e imprime el porcentaje de acierto y la matriz de confusión (qué categoría se confunde con cuál).
- [ ] **Entregable:** tu primer número real. Anótalo: es tu línea base.
- **Aviso:** si te sale 100% a la primera, tus casos son demasiado fáciles. Añade 10 casos difíciles y ambiguos.

### Martes — Iterar con datos (2 h)
- [ ] Mira **solo los fallos**. Agrúpalos por tipo de error.
- [ ] Cambia el prompt para atacar el grupo de errores más grande. Vuelve a medir.
- [ ] Repite 3 veces. Registra en una tabla: versión de prompt → precisión → coste.
- [ ] **Entregable:** tabla de iteraciones. **Esta tabla es una pieza de venta**, no un ejercicio de clase.

### Miércoles — LLM como juez (2 h)
- [ ] Para tareas sin respuesta única (resúmenes, redacción), cómo usar un modelo para puntuar según una rúbrica.
- [ ] **Ejercicio:** evaluador que puntúa de 1 a 5 los resúmenes de `cli-resumen` según fidelidad, concisión y cobertura.
- [ ] Comprueba tú mismo 10 de sus puntuaciones. ¿Coincides con el juez? Ese desacuerdo es información valiosa.
- [ ] **Entregable:** evaluador + tu análisis del desacuerdo.

### Jueves — Tool use, primer contacto (2 h)
- [ ] Qué es una herramienta: nombre, descripción, esquema de entrada. Cómo el modelo decide usarla y cómo le devuelves el resultado.
- [ ] **Ejercicio:** herramienta `obtener_hora_actual` y herramienta `calcular`. Haz que el modelo las use.
- [ ] **Ejercicio:** herramienta que consulta una API pública real (tiempo, cambio de divisa, lo que sea).
- [ ] **Entregable:** script con 3 herramientas funcionando.
- **Idea clave:** una descripción de herramienta mala hace que el modelo no la use o la use mal. La descripción es un prompt. Trátala como tal.

### Viernes — Higiene, costes y documentación (2 h)
- [ ] Revisa los 3 proyectos: ¿claves fuera del código? ¿README que se entiende? ¿errores manejados?
- [ ] Añade a cada README el **coste estimado por 1.000 ejecuciones**.
- [ ] Añade a cada proyecto una sección "Limitaciones conocidas". Sé honesto: esa sección es lo que te va a ahorrar un cliente enfadado.
- [ ] **Entregable:** los 3 repos presentables ante un desconocido.

### Sábado — EXAMEN DEL BLOQUE 1 (5 h)
Ver `04-examenes.md`. Sin ayuda de IA para las partes marcadas como "sin asistente".

### Domingo — Revisión + corrección del examen
Si apruebas, el lunes empieza el Bloque 2 y te preparo el plan diario de las semanas 4–6. Si no, repetimos la parte fallada. **Repetir no es un castigo: es que avanzar sobre una base rota sale mucho más caro en la semana 9.**

---

## Errores que voy a estar vigilando en este bloque

1. **Saltarte el etiquetado manual de los 30 casos.** Es el trabajo aburrido que separa a los profesionales. Si lo generas con IA sin revisarlo, estás evaluando el modelo contra sí mismo y midiendo humo.
2. **Delegar el código al asistente en las semanas 1–2.** Vas a "avanzar" el doble y en la semana 6 vas a estar bloqueado delante de un cliente.
3. **Empezar a tocar n8n antes de tiempo** porque es más divertido. Llega en la semana 4 y llega antes si estas tres semanas se hacen bien.
4. **Perseguir el 100% de precisión.** El objetivo no es la perfección, es **conocer tu número** y saber qué pasa cuando falla.
