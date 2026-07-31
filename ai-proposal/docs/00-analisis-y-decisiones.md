# 00 — Análisis del producto y decisiones técnicas

> Documento de nivel CTO. Aquí no se escribe código: se decide qué se construye, por qué,
> y qué alternativas se descartan. Cada decisión lleva su justificación y su coste.

---

## 1. Análisis del problema real

### 1.1 Qué duele hoy

Un electricista que instala un termo eléctrico no tiene un problema de "no saber escribir".
Tiene tres problemas concretos:

1. **Tiempo muerto no facturable.** Presupuestar es trabajo de oficina: 20-40 min por presupuesto,
   normalmente de noche, después de la jornada. Un autónomo hace 5-15 presupuestos/semana.
   Son 3-8 horas semanales sin cobrar.
2. **Presupuestos que pierden trabajos.** Un Word mal maquetado, sin desglose y sin garantía
   compite mal contra una empresa que manda un PDF con marca. La conversión depende del formato
   tanto como del precio.
3. **Precios inconsistentes.** El mismo trabajo se presupuesta a 380 € en marzo y a 310 € en junio
   porque no hay memoria de precios. Esto se come el margen sin que nadie lo detecte.

**Conclusión de producto:** el valor no es "la IA escribe texto". El valor es
**velocidad + formato profesional + consistencia de precios**. La IA es el medio, no el producto.

### 1.2 La consecuencia arquitectónica más importante

El foso defensivo (_moat_) de este SaaS **no es el prompt**. Cualquiera copia un prompt en una tarde.

El foso es el **histórico de precios propio de cada cliente**: cuando la herramienta lleva 6 meses
sabiendo que _tú_ cobras el termo de 100 L a 415 € con 2,5 h de mano de obra, ya no genera texto
genérico — genera _tu_ presupuesto. Ese dato no es portable a la competencia, y el coste de cambio
crece cada mes.

**Por tanto, la arquitectura de datos es prioritaria sobre la arquitectura de IA.** Todo presupuesto
debe quedar almacenado de forma **estructurada y consultable** (líneas normalizadas, no un blob de
texto), porque de ahí sale:

- La sugerencia de precios ("la última vez cobraste X").
- Las analíticas de negocio (margen por oficio, tasa de aceptación).
- Los presupuestos futuros mejores que los de la competencia.

Esta es la razón por la que más abajo se rechaza guardar el presupuesto como texto generado.

### 1.3 La tensión del "menos de 30 segundos" vs. "la IA pregunta"

Hay una contradicción aparente en el brief: prometemos 30 segundos, pero la IA debe hacer preguntas
antes de generar. Cinco preguntas en un chat = 2-3 minutos. La promesa se rompe.

**Resolución (decisión de producto que condiciona el frontend):** la fase de preguntas **no es un chat**.
Es **una sola pantalla de formulario dinámico** donde las preguntas se responden con _chips_ pulsables
(opciones precalculadas), no escribiendo. Cinco chips = 8-12 segundos reales.

El chat conversacional se descarta explícitamente como interfaz principal:

|                          | Chat libre          | Pantalla de _slots_ con chips |
| ------------------------ | ------------------- | ----------------------------- |
| Tiempo del usuario       | 2-3 min             | 8-15 s                        |
| En móvil (guantes, obra) | Malo (teclado)      | Excelente (pulsar)            |
| Testeable                | No determinista     | Determinista                  |
| Coste IA                 | 1 llamada por turno | 1 llamada total               |
| Tasa de abandono         | Alta                | Baja                          |

El chat queda como _fallback_ opcional para casos raros, no como camino principal.

---

## 2. Decisiones técnicas y alternativas descartadas

Formato: **Decisión → Por qué → Qué se descarta → Coste de equivocarse.**

### D1. Multi-tenant por organización desde el día 1 (no por `user_id`)

**Decisión.** Toda tabla de negocio cuelga de `org_id`, no de `user_id`. Existe `organizations` +
`memberships(org_id, user_id, role)` desde la primera migración.

**Por qué.** En el ICP del brief hay _agencias_, _empresas de limpieza_ e _instaladores_ — negocios con
2-20 empleados. El día que el primer cliente diga "quiero que mi oficinista también entre", con un
modelo `user_id` hay que migrar todas las tablas, todas las políticas RLS y todas las queries, en
producción, con datos reales. Es un proyecto de semanas.

**Descartado.** `owner_id uuid references auth.users` en cada tabla. Es más simple hoy y letal a los 6 meses.

**Coste de equivocarse.** Migración de esquema completa + reescritura de seguridad. Es _la_ decisión
que más veces mata la escalabilidad de un SaaS B2B temprano.

**Coste de acertar hoy.** ~1 día extra de trabajo (tabla de membresías, selector de organización, invitaciones).

---

### D2. Dinero en enteros (céntimos), nunca en `float`

**Decisión.** `bigint` de céntimos + `currency char(3)`. Cantidades en `numeric(12,3)`. Porcentajes en `numeric(5,4)`.

**Por qué.** `0.1 + 0.2 !== 0.3` en IEEE-754. En un producto que emite documentos económicos, un
descuadre de 1 céntimo entre el PDF y la pantalla destruye la confianza del usuario más que un bug visual.

**Descartado.** `numeric` de Postgres para importes: es correcto matemáticamente, pero al pasar por
JSON/JS se convierte en `number` y reintroduce el error en el frontend. Los enteros sobreviven el viaje.

**Regla de redondeo fijada:** se redondea **a céntimo en cada línea** (half-up), luego se suman las
bases por tipo impositivo, y el impuesto se calcula **sobre la base agregada de cada tipo**. Es la
práctica estándar de facturación en España y evita descuadres de ±1 cent frente a Hacienda.

---

### D3. Motor de impuestos configurable, no "IVA 21% hardcodeado"

**Decisión.** Función pura `computeTotals(lines, taxProfile)` con un `TaxProfile` por organización
y anulable por presupuesto.

**Por qué.** El mercado español que describes **no es IVA 21% y ya**:

- **IVA reducido 10%** en obras de renovación de vivienda particular con más de 2 años de antigüedad
  cuando el material aportado no supera el 40% de la base. Un reformista lo usa constantemente.
- **Retención de IRPF (15%, o 7% para nuevos autónomos)** cuando el autónomo factura a empresa o
  profesional. Se resta del total. Si no está, el presupuesto es incorrecto para media base de usuarios.
- **Recargo de equivalencia** (5,2 / 1,4 / 0,5 %) cuando el _cliente_ es comerciante minorista.
- **IGIC 7%** en Canarias, **IPSI** en Ceuta y Melilla. Sin esto, cero clientes en Canarias.

**Descartado.** Un campo `tax_rate` global. Funciona para la demo y genera devoluciones de suscripción
en cuanto entra un reformista o un canario.

**Además:** el modelo de datos se diseña para que un presupuesto pueda **convertirse en factura** más
adelante (series de numeración, inmutabilidad tras emisión). Un presupuesto no tiene obligaciones
legales de facturación; una factura sí (Verifactu / registro de facturación). No implementamos
facturación ahora, pero **no cerramos la puerta**, porque "presupuesto → factura" es la expansión de
ingresos más obvia del producto.

---

### D4. El presupuesto se guarda estructurado, no como texto generado

**Decisión.** `proposals` (cabecera + totales + secciones narrativas en `jsonb` versionado) +
`proposal_lines` (líneas normalizadas, una fila por concepto).

**Por qué.** Ver §1.2. Sin líneas normalizadas no hay memoria de precios, no hay analíticas, no hay
duplicar-y-editar decente, y el PDF se convierte en la única fuente de verdad (desastre).

**Descartado.** Guardar el markdown/HTML que devuelve el modelo. Es el atajo clásico. Convierte el
producto en "un wrapper de ChatGPT" y hace imposible el foso del §1.2.

**Nota de rendimiento.** El autoguardado escribe en un `jsonb` de borrador (una sola fila, barato) y la
normalización a `proposal_lines` ocurre en la misma transacción vía RPC. A 5-30 líneas por presupuesto
esto es irrelevante para Postgres.

---

### D5. La IA es un motor de _slot filling_, no un prompt gigante

**Decisión.** Registro declarativo de oficios (`TradeRegistry`) que define, por oficio, los datos
obligatorios (_slots_). El LLM se usa para 4 tareas acotadas y verificables: **clasificar**, **extraer**,
**proponer preguntas extra**, **generar**. La decisión de "¿tengo suficiente información?" es
**código determinista**, no criterio del modelo.

**Por qué.** El requisito "la IA nunca debe generar un presupuesto con información insuficiente" es
**imposible de garantizar** delegándolo al modelo: es probabilístico y regresiona con cada cambio de
versión del proveedor. Con un registro de slots es una comprobación booleana, testeable en CI.

**Descartado.** Un system prompt largo tipo "pregunta hasta tener todo y luego genera". Funciona el 80%
de las veces, que en un producto de pago es una tasa de fallo inaceptable.

**Beneficio secundario.** Permite enrutar por coste: clasificar/extraer con un modelo pequeño y rápido,
generar con un modelo potente. Diferencia de coste por presupuesto: ~5-8x.

---

### D6. Adaptador de IA con salida estructurada validada, no una librería-paraguas

**Decisión.** Interfaz propia `LlmProvider` (≈150 líneas) con implementaciones por proveedor
(Anthropic, OpenAI, Google). Toda salida se valida contra un esquema Zod; si falla, se reintenta con
prompt de reparación; si vuelve a fallar, se cae a plantilla determinista.

**Por qué.** El brief pide poder cambiar de proveedor sin tocar el resto del código. Una interfaz propia
lo consigue y además nos deja controlar lo que de verdad importa en producción: _timeouts_, reintentos,
_failover_ entre proveedores ante 429/5xx, contabilidad de tokens y coste por organización,
idempotencia y caché.

**Descartado.** Un framework de orquestación genérico. Añade una capa de abstracción que no controlamos,
dificulta el _debugging_ de los fallos de esquema (el 90% de los incidentes reales) y ata el proyecto a
su ritmo de _releases_.

**Importante para el negocio:** cada llamada registra tokens y coste en `ai_requests`. Sin eso no se
conoce el **margen bruto por usuario** y no se puede fijar el precio de la suscripción con criterio.

---

### D7. Una sola app Next.js con fronteras modulares estrictas (no monorepo de paquetes)

**Decisión.** Una aplicación Next.js con arquitectura _feature-first_ (`src/features/*`), donde cada
_feature_ expone una API pública (`index.ts`) y **ESLint prohíbe** importar los internos de otra _feature_.

**Por qué.** El monorepo con `packages/` se justifica cuando hay ≥2 aplicaciones desplegables o equipos
separados. Hoy hay una app. Adoptarlo ahora cuesta configuración de _build_, cachés, resolución de tipos
y CI, a cambio de cero beneficio. Las fronteras que evitan el "código espagueti" son **reglas de import**,
no carpetas de npm.

**Descartado.** Turborepo desde el día 1.

**Cuándo cambiar (criterio explícito, no "cuando duela"):** cuando aparezca un segundo desplegable
(app móvil nativa, servicio de _workers_, API pública para partners). Como las fronteras ya existen,
extraer `features/pdf` o `features/ai` a un paquete es mecánico.

---

### D8. RLS de Postgres como frontera de seguridad, no la lógica de la aplicación

**Decisión.** Todas las tablas con RLS activo. La app **nunca** filtra por `org_id` como mecanismo de
seguridad (lo hace por rendimiento y claridad, pero la garantía la da la base de datos).
La `service_role key` no se usa jamás en un camino accesible al usuario.

**Por qué.** Un `WHERE org_id = ?` olvidado en un solo _endpoint_ es una fuga de datos entre clientes.
Con RLS, ese olvido devuelve cero filas en lugar de los datos de otro. La seguridad debe fallar cerrada.

**Consecuencias operativas asumidas:**

- Las políticas RLS se **testean** con SQL en CI (intento de acceso cruzado entre dos organizaciones
  debe devolver 0 filas). Una regresión de RLS es el peor incidente posible en un SaaS B2B.
- Las políticas usan `(select auth.uid())` en lugar de `auth.uid()` — fuerza a Postgres a evaluarlo una
  vez por consulta (_InitPlan_) en vez de una vez por fila. En tablas de 100k filas la diferencia es de
  órdenes de magnitud.
- El enlace público compartido **no** usa `service_role`: usa una función `security definer` acotada que
  recibe el token y devuelve exactamente un presupuesto.

---

### D9. Motor de PDF declarativo sobre `pdf-lib`

**Decisión.** `pdf-lib` (como pides) + `@pdf-lib/fontkit`, envuelto en un **motor de layout propio**:
las plantillas son _datos_ (bloques: texto, tabla, separador, imagen) que un motor mide, corta y pagina.

**Por qué.** `pdf-lib` es de bajo nivel: dibuja en coordenadas absolutas, no sabe de saltos de página,
ni de altura de texto, ni de tablas. Escribir plantillas dibujando a mano genera código imposible de
mantener en cuanto haya 3 plantillas. Con un motor declarativo, **añadir una plantilla nueva es añadir
un objeto**, no 400 líneas de `drawText`.

**Detalle crítico que se rompe en el 100% de las implementaciones ingenuas:** las fuentes estándar de
PDF usan WinAnsi y rompen con caracteres fuera de ese juego. Se **embeben fuentes TTF con subsetting**
(`fontkit`) para garantizar acentos, "ñ", "€" y comillas tipográficas correctas.

**Riesgo controlado.** Generación en _runtime_ Node (no Edge), objetivo p95 < 1,5 s. Si en el futuro se
añaden fotos de obra y se acerca al límite de tiempo de la función, se pasa a generación asíncrona con
cola y notificación. El diseño ya devuelve el PDF por URL firmada, así que el cambio no afecta al cliente.

---

### D10. Enlace compartido con seguimiento de apertura

**Decisión.** Enlace público con token aleatorio de 256 bits del que se guarda **solo el hash SHA-256**,
con caducidad, revocación y registro de eventos (`view`, `download`, `accept`, `reject`).

**Por qué.** Además de ser lo correcto en seguridad (una filtración de la base de datos no expone los
enlaces vivos), habilita la función que más se percibe como "magia" en este tipo de producto:
**"tu cliente ha visto el presupuesto hace 10 minutos"**, y **aceptar/rechazar con un botón**. Coste de
implementación bajo, impacto en retención alto.

---

### D11. i18n y tokens de diseño desde el principio, aunque solo lancemos en español

**Decisión.** Todo texto de interfaz pasa por catálogo de traducción; todo color/espaciado/tipografía
pasa por _tokens_ CSS. Lanzamos solo `es-ES`.

**Por qué.** Retrofitar i18n sobre 200 componentes es un trabajo de semanas y se hace mal. Hacerlo desde
el inicio cuesta prácticamente cero. Lo mismo con los tokens: el "modo oscuro premium" que pides se
consigue con una capa de tokens; sin ella, un cambio de marca obliga a tocar cada componente.

---

### D12. Facturación por suscripción desde la arquitectura, aunque se implemente al final

**Decisión.** Las tablas de suscripción, plan y contadores de uso existen desde la primera migración, y
**toda** operación que consume IA pasa por una única puerta `assertQuota()` en servidor.

**Por qué.** El brief dice "preparado para venderse mediante suscripción". Si los límites de plan se
añaden al final, quedan repartidos por 15 sitios y siempre falta uno — que es justo por donde se cuela
el uso gratis ilimitado. Un único punto de control se audita en 5 minutos.

---

## 3. Riesgos identificados y su mitigación

| #   | Riesgo                                                              | Impacto                                           | Mitigación                                                                                                                                                             |
| --- | ------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Precios irreales generados por la IA                                | Alto — destruye la confianza en la primera sesión | Catálogo base por oficio + histórico propio inyectado en el contexto + rangos de validación con aviso                                                                  |
| R2  | Regresión de RLS = fuga entre clientes                              | Crítico                                           | Tests SQL de acceso cruzado obligatorios en CI                                                                                                                         |
| R3  | Coste de IA por encima del precio de suscripción                    | Alto — margen negativo                            | Enrutado por coste, caché de clasificación/extracción, coste registrado por petición, cuotas por plan                                                                  |
| R4  | _Prompt injection_ vía texto del usuario o del cliente final        | Medio                                             | Texto de usuario tratado como dato delimitado, sin herramientas con efectos secundarios expuestas al modelo, salida validada por esquema y nunca renderizada como HTML |
| R5  | Dependencia de un único proveedor de IA (corte o subida de precios) | Medio-alto                                        | Adaptador + _failover_ configurado, esquemas independientes del proveedor                                                                                              |
| R6  | Presupuestos legalmente incorrectos (IVA/IRPF)                      | Alto                                              | Motor de impuestos con perfiles + textos legales revisables + aviso de que no sustituye a asesoría fiscal                                                              |
| R7  | Tiempo de generación percibido como lento                           | Medio                                             | _Streaming_ con parseo parcial: las secciones aparecen a medida que llegan                                                                                             |

---

## 4. Observación sobre el nombre

"AI Proposal" es genérico: difícil de registrar como marca, imposible de posicionar en SEO (compite con
la expresión literal) y no comunica nada en español, que es el mercado inicial. No bloquea nada técnico,
pero conviene decidirlo **antes** de comprar dominio y fijar la identidad.

Alternativas orientadas a mercado español, cortas y registrables: **Presuply**, **Presuptia**,
**Quotia**, **Presupix**. Decisión tuya; el código no depende del nombre (está tras un token de marca).

---

## 5. Qué NO se va a construir (y por qué)

Delimitar es tan importante como construir. Fuera de alcance en este roadmap:

- **Facturación fiscal completa** (Verifactu/TicketBAI). Es un producto en sí mismo con obligaciones
  legales. El modelo de datos lo permite en el futuro; la implementación no entra ahora.
- **App móvil nativa.** La PWA responsive cubre el caso de uso real (presupuestar desde la furgoneta).
- **Firma electrónica cualificada (eIDAS).** La aceptación por enlace con registro de IP y sello de
  tiempo es suficiente para un presupuesto. La firma cualificada es un añadido de pago posterior.
- **Chat libre como interfaz principal.** Ver §1.3.
