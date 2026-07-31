# 03 — Motor de IA: adaptador, entrevista y generación

Cómo se garantiza que la IA **nunca** genere un presupuesto con información insuficiente, y cómo se
cambia de proveedor sin tocar el resto del código.

---

## 1. El adaptador (`lib/ai`)

### 1.1 Interfaz

```ts
/** Contrato que cumple cualquier proveedor. Nada específico de vendor cruza esta línea. */
export interface LlmProvider {
  readonly id: ProviderId;                      // 'anthropic' | 'openai' | 'google' | …

  readonly capabilities: {
    structuredOutput: boolean;
    streaming: boolean;
    maxOutputTokens: number;
    supportsCaching: boolean;
  };

  /** Salida validada contra un esquema Zod. Es la vía principal: nunca se parsea texto libre. */
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;

  /** Igual, pero emitiendo objetos parciales para pintar la UI mientras llega la respuesta. */
  streamStructured<T>(req: StructuredRequest<T>): AsyncIterable<StructuredChunk<T>>;
}

export interface StructuredRequest<T> {
  purpose: AiPurpose;                 // 'classify'|'extract'|'questions'|'generate'|'repair'
  schema: z.ZodType<T>;               // fuente de verdad; se convierte a JSON Schema por proveedor
  system: string;
  input: UntrustedInput[];            // texto de usuario, marcado como no fiable
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;               // timeout obligatorio
  idempotencyKey?: string;
}

export interface StructuredResult<T> {
  data: T;                            // ya validado por Zod
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  cost: { micros: number };           // millonésimas de euro
  meta: { provider: ProviderId; model: string; latencyMs: number; attempts: number };
}
```

**Puntos clave del diseño:**

1. **Zod es la fuente de verdad.** El esquema TypeScript y el JSON Schema que se envía al proveedor
   salen del mismo objeto. No pueden divergir.
2. **La validación ocurre siempre**, incluso con proveedores que prometen *structured output*. Prometer
   no es garantizar.
3. **`UntrustedInput`** es un tipo distinto de `string`. El compilador impide concatenar texto de
   usuario dentro del *system prompt* — mitigación de *prompt injection* a nivel de tipos.
4. **Coste calculado en el adaptador**, no en el llamante. Tarifas en una tabla de configuración.

### 1.2 Registro y política de enrutado

```ts
const MODEL_POLICY: Record<AiPurpose, ModelRoute> = {
  classify:  { tier: 'fast',    maxTokens: 200,   temperature: 0 },
  extract:   { tier: 'fast',    maxTokens: 800,   temperature: 0 },
  questions: { tier: 'balanced',maxTokens: 900,   temperature: 0.3 },
  generate:  { tier: 'strong',  maxTokens: 4000,  temperature: 0.4 },
  repair:    { tier: 'balanced',maxTokens: 4000,  temperature: 0 },
};
```

Los *tiers* (`fast` / `balanced` / `strong`) se mapean a modelos concretos por **configuración**
(variables de entorno), no en el código. Cambiar de proveedor o de modelo = cambiar configuración y
desplegar; cero refactor. Esto es literalmente lo que pide el brief.

**Impacto económico:** clasificar y extraer con un modelo pequeño reduce el coste por presupuesto
entre 5 y 8 veces frente a usar el modelo potente en todas las etapas. A escala, es la diferencia entre
un margen bruto del 60 % y uno del 92 %.

### 1.3 Fiabilidad

| Mecanismo | Detalle |
|---|---|
| Timeout | 25 s (`generate`), 8 s (resto). Vía `AbortSignal`, siempre |
| Reintentos | 2, con retroceso exponencial + *jitter*, solo en 429/5xx/timeout |
| Failover | Ante fallo persistente del proveedor primario, cae al secundario automáticamente |
| Reparación | Si Zod falla: se reenvía con los errores de validación como instrucción (máx. 2 intentos) |
| Último recurso | Plantilla determinista del oficio + aviso al usuario. **Nunca** una pantalla en blanco |
| Caché | `classify` y `extract` cacheados por hash(texto + versión de esquema) |
| Idempotencia | `idempotencyKey` evita cobrar dos veces la misma generación si el usuario recarga |
| Contabilidad | Cada llamada, exitosa o no, escribe una fila en `ai_requests` |

---

## 2. Registro de oficios (`features/ai/trades`)

Es el **conocimiento de dominio del producto**, declarado como datos:

```ts
export const fontaneria: TradeDefinition = {
  id: 'fontaneria',
  label: 'Fontanería',
  aliases: ['termo', 'caldera', 'grifo', 'tubería', 'desatasco', 'fuga', 'lavabo'],

  slots: [
    {
      id: 'tipo_trabajo',
      question: '¿Qué tipo de trabajo es?',
      type: 'enum',
      options: [
        { value: 'instalacion_nueva', label: 'Instalación nueva' },
        { value: 'sustitucion',       label: 'Sustitución' },
        { value: 'reparacion',        label: 'Reparación' },
      ],
      required: true,
    },
    {
      id: 'retirada_antiguo',
      question: '¿Hay que retirar y gestionar el aparato antiguo?',
      type: 'boolean',
      required: (ctx) => ctx.tipo_trabajo === 'sustitucion',   // condicional
    },
    { id: 'provincia',   question: '¿En qué provincia?', type: 'location', required: true },
    { id: 'accesos',     question: '¿Acceso complicado (altura, hueco estrecho)?',
      type: 'boolean', required: false },
  ],

  defaultWarrantyMonths: 24,
  baseCatalog: [ /* materiales y mano de obra típicos, con precios de referencia */ ],
};
```

**Por qué esto es lo correcto:**

- La regla "no generar sin información suficiente" pasa a ser
  `slots.filter(s => isRequired(s, ctx) && !filled(s)).length === 0` — una condición booleana testeable
  en CI, no una esperanza depositada en un prompt.
- Las preguntas tienen **opciones predefinidas** → *chips* pulsables → 10 s en lugar de 3 min (§1.3 del doc 00).
- `required` puede ser función: se pregunta por la retirada del aparato antiguo **solo** si es una
  sustitución. La entrevista se siente inteligente porque *es* inteligente, no porque el modelo tenga suerte.
- Añadir un oficio nuevo = añadir un fichero. Sin tocar el motor.

**Oficios de la primera versión** (los del brief): fontanería, electricidad, pintura, reformas
integrales, jardinería, carpintería, limpieza, climatización, cerrajería, y un `generico` de reserva
para todo lo demás.

**El modelo puede añadir hasta 3 preguntas extra** específicas del caso (validadas contra esquema y
limitadas en número). Combina la fiabilidad del registro con la flexibilidad del LLM.

---

## 3. La entrevista, paso a paso

```
POST /api/ai/interview   { text, sessionId? }
  │
  ├─ 1. rate limit por organización + assertQuota()
  ├─ 2. classify(text) → trade  [caché]
  │       confianza < 0.6 → devolver las 3 opciones más probables como chips
  ├─ 3. extract(text, trade.slots) → { slotId: { value, confidence } }  [caché]
  │       se aceptan solo valores con confianza ≥ 0.7
  ├─ 4. merge con la sesión previa (ai_sessions.state)
  ├─ 5. missing = slots requeridos (evaluando condiciones) y sin valor
  │
  ├─ missing.length > 0 →  { status: 'needs_input', questions: [...], completeness: 0.6 }
  └─ missing.length = 0 →  { status: 'ready' }
```

La respuesta incluye siempre `completeness` (0-1) para pintar una barra de progreso — comunica al
usuario que el sistema está avanzando, no interrogándole sin fin.

**Escape hatch obligatorio:** el usuario siempre puede pulsar *"Generar con lo que hay"*. En ese caso la
IA genera **y lista los supuestos aplicados** en `document.assumptions`, que salen impresos en el PDF
bajo el epígrafe "Supuestos". Esto convierte una limitación en una función de confianza: el cliente
final ve exactamente sobre qué base se ha presupuestado.

---

## 4. Generación

### 4.1 Contexto inyectado

```
system:  rol, formato, normativa española, reglas de estilo, tipos de IVA aplicables
────────────────────────────────────────────────────────────────────────────────────
contexto (datos, NO instrucciones):
  · oficio + slots resueltos
  · perfil de la organización (nombre, garantía por defecto, condiciones propias)
  · catálogo propio filtrado por relevancia   ← precios reales del usuario
  · hasta 5 presupuestos anteriores similares ← EL FOSO (doc 00, §1.2)
  · catálogo base del oficio                  ← respaldo si el usuario es nuevo
  · provincia (modulador de precio de mano de obra)
────────────────────────────────────────────────────────────────────────────────────
entrada del usuario: <untrusted>…</untrusted>
```

El orden importa: **los precios propios del usuario pesan más que el conocimiento general del modelo**.
La instrucción es explícita: *si existe un precio propio para un concepto, úsalo; no lo inventes.*

### 4.2 Esquema de salida

```ts
const GeneratedProposal = z.object({
  title: z.string().min(5).max(120),
  summary: z.string().min(20).max(400),
  technicalDescription: z.string().min(50),
  lines: z.array(z.object({
    kind: z.enum(['material','labor','service','equipment','other']),
    description: z.string().min(3).max(200),
    quantity: z.number().positive().max(10_000),
    unit: z.enum(['unit','hour','m','m2','m3','kg','day','service']),
    unitPriceCents: z.number().int().nonnegative().max(100_000_00),
    taxRate: z.enum(['0.21','0.10','0.04','0.07','0']).transform(Number),
  })).min(2).max(40),
  scopeIncluded: z.array(z.string()).min(1).max(12),
  scopeExcluded: z.array(z.string()).max(10),
  estimatedDuration: z.object({ value: z.number().positive(), unit: z.enum(['hours','days','weeks']) }),
  warranty: z.object({ months: z.number().int().min(0).max(120), text: z.string() }),
  terms: z.array(z.string()).min(2).max(10),
  assumptions: z.array(z.string()).max(8),
});
```

**El modelo nunca calcula totales.** Devuelve líneas; los totales los calcula `computeTotals` en el
servidor. Los LLM cometen errores aritméticos, y aquí el error aritmético es dinero real.

### 4.3 Validación posterior (código, no IA)

Tras validar el esquema:

1. **Rango de precios.** Cada línea se compara con el catálogo base del oficio. Si se desvía > 3x,
   se marca con un aviso visual en el editor (no se bloquea: el usuario manda).
2. **Coherencia.** Suma de mano de obra vs. duración estimada; si un trabajo de "3 horas" trae 12 h de
   mano de obra, se avisa.
3. **Deduplicación** de líneas equivalentes.
4. **Enganche con el catálogo.** Cada línea intenta emparejarse con un `catalog_item` existente por
   similitud de texto → `catalog_item_id`. Esto alimenta el histórico de precios automáticamente,
   sin que el usuario tenga que mantener un catálogo a mano.

El punto 4 es lo que hace que el producto **mejore solo con el uso**.

---

## 5. Seguridad frente a *prompt injection*

Vectores reales: el texto que escribe el usuario, el nombre de un cliente guardado, las notas de un
presupuesto anterior inyectado como contexto.

| Medida | Implementación |
|---|---|
| Separación de canales | `system` es una constante del código; el texto de usuario entra como `UntrustedInput`, tipo distinto que no se puede concatenar al system |
| Delimitación | Contenido no fiable envuelto en etiquetas + instrucción explícita de tratarlo como datos |
| Sin herramientas peligrosas | El modelo no dispone de ninguna función con efectos secundarios. No puede leer BD ni enviar emails |
| Salida acotada | Solo se acepta JSON validado por Zod. Un intento de inyección produce un fallo de validación, no una acción |
| Renderizado seguro | La salida se pinta como texto. Nunca `dangerouslySetInnerHTML` |
| Límites | Longitud máxima de entrada, tokens máximos de salida, límite de peticiones por organización |

**Principio:** aunque una inyección tuviera éxito, el daño máximo posible es un presupuesto con texto
raro. No hay camino desde el prompt hasta los datos de otro cliente ni hasta una acción externa.

---

## 6. Evaluación continua (evals)

Sin evals, cada cambio de prompt o de modelo es una apuesta a ciegas.

**Golden set:** 40 casos por oficio (400 en total), cada uno con entrada, slots esperados y rangos de
precio aceptables, construidos a partir de presupuestos reales del sector.

**Se ejecuta en CI en cada cambio de prompt, esquema o modelo:**

| Métrica | Umbral mínimo |
|---|---|
| Precisión de clasificación de oficio | ≥ 95 % |
| Recall de extracción de slots | ≥ 90 % |
| Validación de esquema a la primera | ≥ 98 % |
| Precios dentro del rango esperado | ≥ 85 % |
| Coste medio por generación | < 0,04 € |
| Latencia p95 | < 25 s |

Los evals corren contra los modelos configurados. Cuando salga un modelo nuevo, se ejecuta el eval, se
compara coste/calidad/latencia, y **se cambia la configuración si gana**. Cero cambios de código —
que es exactamente la promesa del adaptador.
