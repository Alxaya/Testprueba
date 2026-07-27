# Arquitectura del sistema

> Documento de diseño. Se escribió **antes** que el código y describe el porqué de
> cada decisión. Si el código y este documento divergen, gana este documento: hay
> que corregir el código o actualizar el diseño de forma consciente.

## 1. Objetivo y principios de diseño

Construir un bot de trading de criptomonedas que pueda ejecutarse 24/7 de forma
desatendida, con prioridad absoluta en este orden:

1. **No perder dinero por fallos de software.** Un bug nunca debe poder abrir una
   posición mayor de la permitida, ni saltarse un stop, ni duplicar una orden.
2. **Estabilidad.** El proceso no muere ante un error de red, un rate limit o una
   respuesta rara del exchange. Se degrada y se recupera.
3. **Observabilidad.** Todo lo que ocurre queda registrado y es consultable
   (logs, base de datos, panel web, alertas).
4. **Extensibilidad.** Añadir una estrategia, un exchange o un canal de alertas
   debe ser escribir una clase nueva, no tocar el núcleo.
5. **Rendimiento**, solo después de lo anterior.

### Principios concretos que atraviesan todo el código

| Principio | Cómo se materializa |
|---|---|
| **Paridad backtest / live** | El mismo objeto `Strategy`, el mismo `RiskManager` y el mismo `Portfolio` se usan en backtest, paper y live. Solo cambia el `Broker` y la fuente de datos. Un backtest que no se parece al live es un backtest inútil. |
| **Sin look-ahead** | Las señales se calculan con la vela **cerrada** en `t` y se ejecutan al **open de `t+1`**. Ninguna función de indicador puede ver datos futuros. |
| **Idempotencia** | Cada orden lleva un `client_order_id` determinista. Un reintento tras un timeout no duplica la orden. |
| **Fail-closed** | Ante duda (no se puede leer el balance, el precio es incoherente, la BD falla) el bot **no opera**. El estado por defecto es "no hacer nada". |
| **Sin secretos en el repo** | Claves solo por variables de entorno. El fichero de configuración referencia *nombres* de variables, nunca valores. |
| **Todo el estado es reconstruible** | Reiniciar el proceso no pierde posiciones ni histórico: se reconcilia contra el exchange y contra SQLite. |

---

## 2. Vista general en capas

```
┌──────────────────────────────────────────────────────────────────────┐
│  INTERFAZ            CLI (bot.cli)          Panel web (FastAPI)       │
│                      backtest/paper/live    REST + dashboard          │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │                                  │ (solo lectura +
                │                                  │  kill switch)
┌───────────────▼──────────────────────────────────▼───────────────────┐
│  ORQUESTACIÓN                                                        │
│  TradingEngine (asyncio)          BacktestEngine (bucle determinista) │
│  · planifica cierres de vela      · recorre velas históricas          │
│  · watchdog + reconexión          · mismas reglas, sin red            │
│  · heartbeat + apagado limpio     · sin look-ahead                    │
└───────────────┬──────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│  DOMINIO (puro, sin I/O, testeable al 100%)                          │
│                                                                       │
│   Window ──► Strategy ──► Signal ──► RiskManager ──► OrderIntent      │
│   (ventana   (lógica)     (qué      (cuánto y si    (orden lista      │
│    de velas)              hacer)     se permite)     para enviar)     │
│                                                                       │
│   Portfolio (posiciones, PnL, equity)   Indicators (numpy)            │
└───────────────┬──────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│  INFRAESTRUCTURA (adaptadores intercambiables)                        │
│                                                                       │
│   Broker (ABC)          DataProvider (ABC)      Notifier (ABC)        │
│   ├─ PaperBroker        ├─ CCXTDataProvider     ├─ TelegramNotifier   │
│   └─ CCXTBroker         └─ SQLiteOHLCVStore     └─ NullNotifier       │
│                                                                       │
│   Repository (SQLite WAL): órdenes, fills, trades, equity, eventos    │
└──────────────────────────────────────────────────────────────────────┘
```

La regla de dependencias es estricta: **el dominio no importa infraestructura**.
`Strategy` no sabe qué es ccxt; `RiskManager` no sabe qué es SQLite. Eso es lo que
permite testear la lógica de dinero sin red y sin base de datos.

---

## 3. Flujo de una operación, paso a paso

```
 1. Cierra la vela de 1h (12:00 UTC)
 2. TradingEngine espera `confirmation_delay_s` (por defecto 5 s) — el exchange
    puede tardar en consolidar la última vela.
 3. DataProvider descarga las últimas N velas. Se descarta la vela en curso.
    Si el timestamp de la última vela cerrada ya se procesó → se ignora (dedupe).
 4. Se construye un `Window` (vista numpy de las últimas N velas, coste cero).
 5. Para cada estrategia suscrita a (símbolo, timeframe):
       signal = strategy.generate(window, posicion_actual)
 6. El `RiskManager` recibe la señal:
       · ¿hay kill switch activo?            → rechaza
       · ¿se superó la pérdida diaria máx.?  → rechaza
       · ¿drawdown máximo superado?          → rechaza y apaga
       · ¿demasiadas posiciones abiertas?    → rechaza
       · ¿cooldown tras rachas de pérdidas?  → rechaza
       calcula el stop (del signal o por ATR) y de ahí el tamaño:
           qty = (equity · risk_per_trade) / |entrada − stop|
       aplica topes: % máx. por posición, exposición total, cash disponible,
       mínimo nocional y precisión del mercado.
 7. `OrderRouter` envía la orden al `Broker` con `client_order_id` determinista,
    reintentos con backoff y verificación posterior (¿existe ya esa orden?).
 8. El `Fill` resultante actualiza el `Portfolio`, se persiste en SQLite y se
    envía una alerta de Telegram.
 9. En cada vela posterior se comprueban stop loss, take profit y trailing stop
    antes de pedir señales nuevas.
10. Cada vela se guarda un snapshot de equity → alimenta el panel web y las
    métricas de riesgo.
```

---

## 4. Componentes

### 4.1 `bot/core` — modelos y utilidades del dominio

Dataclasses inmutables o con `slots`: `Candle`, `Signal`, `Order`, `Fill`,
`Position`, `Trade`, `AccountState`, `OrderIntent`. Enums para `Side`,
`OrderType`, `OrderStatus`, `SignalAction`, `RunMode`, `AlertLevel`.

`Window` es la abstracción clave: expone `open/high/low/close/volume/ts` como
arrays numpy de las últimas N velas **ya cerradas**. En backtest son *vistas*
(slices sin copia) sobre el array completo; en live se materializan desde un
deque. La estrategia no puede distinguir uno de otro — esa es la paridad.

`Window` incluye una caché de indicadores por ventana, de modo que si dos
estrategias (o dos ramas de la misma) piden `ema(close, 50)` sobre la misma vela,
se calcula una sola vez.

### 4.2 `bot/config` — configuración

- YAML declarativo (`config/config.yaml`) validado con **pydantic v2**.
- Los secretos **nunca** están en el YAML: se declara `api_key_env: BINANCE_API_KEY`
  y el valor se lee del entorno / `.env`.
- Validación estricta: campos desconocidos → error al arrancar, no en producción
  a las 3 de la mañana.
- Comprobaciones cruzadas: no se puede arrancar en modo `live` sin claves, ni con
  `risk_per_trade_pct` > 5, ni sin haber pasado por `paper` (flag explícito
  `i_understand_live_trading_risk: true`).

### 4.3 `bot/data` — datos de mercado

- `DataProvider` (ABC) → `fetch_ohlcv(symbol, timeframe, since, limit)`.
- `CCXTDataProvider`: REST con paginación, respeto del rate limit del exchange,
  reintentos con backoff exponencial y jitter, y validación de integridad
  (timestamps monótonos, sin huecos, sin velas duplicadas, OHLC coherente).
- `OHLCVStore` (SQLite): caché en disco de velas históricas. Descargar 3 años de
  BTC/USDT 1h es lento; hacerlo una vez y reutilizarlo es la diferencia entre un
  backtest de 4 segundos y uno de 4 minutos.
- `HistoricalDownloader`: descarga incremental (solo lo que falta) y relleno de
  huecos.

**Por qué REST y no WebSocket en v1:** el bot opera al cierre de vela (1m–1d), no
en microestructura. REST con reintentos es mucho más simple de razonar y de
recuperar tras una desconexión. El WebSocket está previsto como optimización en
la fase 8, detrás de la misma interfaz `DataProvider`.

### 4.4 `bot/broker` — acceso al exchange

Interfaz `Broker` (ABC):

```python
fetch_balance() -> Balance
fetch_ticker(symbol) -> Ticker
create_order(...) -> Order
cancel_order(id, symbol) -> Order
fetch_order(id, symbol) -> Order
fetch_open_orders(symbol=None) -> list[Order]
market_info(symbol) -> MarketInfo   # precisión, mínimos, tick size
```

Dos implementaciones:

- **`PaperBroker`** — simulador. Mantiene su propio libro de balances como si
  fuese un exchange real. Modela:
  - **comisiones** maker/taker configurables (por defecto 10 bps, taker),
  - **slippage** en puntos básicos sobre el precio de referencia,
  - **rechazos realistas**: saldo insuficiente, nocional mínimo, precisión.
  Es el mismo objeto que usa el backtester, así que el backtest y el paper trading
  comparten exactamente el mismo modelo de costes.
- **`CCXTBroker`** — exchange real vía [ccxt]. Soporta testnet (Binance testnet
  por defecto). Añade: rate limiter, reintentos idempotentes, normalización de
  precios/cantidades a la precisión del mercado, y reconciliación al arrancar
  (¿qué órdenes y posiciones hay realmente ahí fuera?).

**Spot primero.** Los cortos y el apalancamiento están deshabilitados por defecto:
una señal `ENTER_SHORT` en un broker spot se registra y se descarta con un aviso.
Habilitar derivados es una decisión consciente en configuración, no un accidente.

### 4.5 `bot/strategies` — estrategias

`Strategy` (ABC):

```python
warmup: int                                  # velas mínimas antes de operar
generate(window, position) -> Signal | None  # única función obligatoria
describe() -> StrategyDoc                    # ventajas, límites, riesgos
```

Registro por decorador (`@register("ema_crossover")`) → añadir una estrategia es
crear un fichero; el CLI, el panel y la config la reconocen automáticamente.

Se implementan **solo estrategias clásicas y públicas**, cada una documentada con
sus ventajas, sus limitaciones y sus riesgos reales (ver
[`docs/03-estrategias.md`](03-estrategias.md)):

| Estrategia | Familia | Idea |
|---|---|---|
| `ema_crossover` | Seguimiento de tendencia | Cruce de medias exponenciales rápida/lenta con filtro de tendencia |
| `donchian_breakout` | Ruptura (estilo Turtle) | Compra máximos de N periodos, sale por mínimo de M o stop ATR |
| `macd_trend` | Seguimiento de tendencia | Cruce de la línea MACD con su señal, filtrado por pendiente |
| `rsi_mean_reversion` | Reversión a la media | Compra sobreventa, vende sobrecompra, con filtro de régimen |
| `bollinger_reversion` | Reversión a la media | Toca banda inferior → entrada; vuelta a la media → salida |
| `buy_and_hold` | Referencia | Baseline obligatorio: si no bates esto, no tienes nada |

`buy_and_hold` no es una estrategia que se vaya a ejecutar en producción: existe
para que **ningún backtest se lea sin su comparación honesta** contra comprar y
esperar.

### 4.6 `bot/risk` — gestión de riesgo

Es el componente con más autoridad del sistema: **puede vetar cualquier orden** y
es el único que decide tamaños.

Controles por operación:
- Tamaño por **fracción fija de riesgo**: se arriesga un `risk_per_trade_pct` del
  equity por operación, calculado sobre la distancia al stop (no sobre el nocional).
- Stop obligatorio: si la estrategia no aporta uno, se usa `ATR × multiplicador`.
- Take profit opcional como múltiplo de R.
- Trailing stop opcional (por ATR).
- Topes: `%` máximo por posición, exposición total máxima, número máximo de
  posiciones simultáneas, una posición por símbolo y estrategia.

Cortacircuitos de cartera (se evalúan en cada vela):
- **Pérdida diaria máxima** (reinicio a las 00:00 UTC) → deja de abrir.
- **Drawdown máximo** desde el máximo histórico de equity → *kill switch*: cierra
  todo y para.
- **Racha de pérdidas consecutivas** → enfriamiento de N velas.
- **Kill switch manual**: fichero `KILL` en disco o botón en el panel web. Se
  comprueba en cada ciclo, antes de cualquier envío de orden.

### 4.7 `bot/execution` — enrutado y cartera

- `OrderRouter`: construye el `client_order_id` determinista
  (`{estrategia}-{símbolo}-{timestamp_vela}-{acción}`), envía, reintenta con
  backoff, y ante un timeout **consulta antes de reenviar**. Normaliza precios y
  cantidades a la precisión del mercado.
- `Portfolio`: aplica fills, mantiene posiciones, precio medio, PnL realizado y no
  realizado, comisiones acumuladas, curva de equity y trades cerrados.

### 4.8 `bot/backtest` — backtesting

`BacktestEngine` recorre las velas y en cada una, **en este orden**:

1. Ejecuta las órdenes pendientes de la vela anterior al `open` actual (+ slippage).
2. Comprueba stops, take profits y trailing con el `high`/`low` de la vela.
3. Pide señales a las estrategias con la ventana que termina en el `close` actual.
4. Encola las órdenes resultantes para el `open` de la vela siguiente.
5. Registra el snapshot de equity.

Supuestos explícitos y **conservadores** (documentados en el informe de cada
backtest, porque un backtest sin sus supuestos es publicidad):

- Si en la misma vela se tocan stop y take profit, **se asume que saltó el stop**.
- Si el precio abre con hueco más allá del stop, se rellena al `open`, no al stop.
- Comisiones y slippage siempre aplicados, también en las salidas.
- Sin modelado de profundidad de libro: las órdenes se asumen pequeñas frente al
  volumen. Esto deja de ser cierto con tamaños grandes o pares ilíquidos.

`metrics.py` calcula: retorno total, CAGR, volatilidad anualizada, Sharpe,
Sortino, máximo drawdown y su duración, Calmar, % de aciertos, profit factor,
expectancy, R-múltiplos, exposición, rotación y número de operaciones.

`walkforward.py` implementa optimización *walk-forward* (ventanas rodantes
in-sample / out-of-sample) porque una rejilla de parámetros optimizada sobre todo
el histórico es **sobreajuste garantizado**. El informe muestra siempre el
resultado out-of-sample, que es el único que significa algo.

### 4.9 `bot/persistence` — registro completo

SQLite en modo WAL (un solo fichero, sin servidor, transaccional, suficiente para
este volumen). Tablas: `runs`, `orders`, `fills`, `trades`, `positions`,
`equity`, `signals`, `events`.

Todo lo que el bot decide queda escrito, **incluidas las señales rechazadas por
riesgo y el motivo del rechazo**. Cuando dentro de tres meses te preguntes "¿por
qué no entró aquí?", la respuesta está en la tabla `signals`.

### 4.10 `bot/notifications` — alertas

`Notifier` (ABC) con niveles `DEBUG/INFO/WARNING/ERROR/CRITICAL`.
`TelegramNotifier` usa la API HTTP del bot de Telegram con:
- cola asíncrona (una alerta lenta nunca bloquea el trading),
- reintentos y respeto del rate limit de Telegram,
- deduplicación y agrupación de mensajes repetidos,
- filtro por nivel mínimo configurable.

Eventos notificados: arranque/parada, apertura/cierre de posición, stop ejecutado,
cortacircuito disparado, error del exchange, heartbeat periódico y resumen diario.

### 4.11 `bot/web` — panel

FastAPI + un dashboard de una sola página en HTML/JS sin dependencias externas
(sin CDN: debe funcionar en un servidor sin salida a internet). Muestra: estado,
equity y drawdown, posiciones abiertas, historial de operaciones, métricas,
estrategias activas con su documentación, y últimos eventos.

**Seguridad del panel:** es de solo lectura salvo un único endpoint de escritura
(activar/desactivar el kill switch), protegido por token Bearer. Por defecto
escucha en `127.0.0.1`; exponerlo a internet exige token y, se recomienda, un
proxy inverso con TLS. El panel nunca muestra ni expone claves de API.

---

## 5. Concurrencia y ciclo de vida

Un solo proceso `asyncio`:

- **Tarea de trading** por cada `(timeframe)`: duerme hasta el próximo cierre de
  vela, procesa todos los símbolos y estrategias de ese timeframe.
- **Tarea de notificaciones**: consume la cola de alertas.
- **Tarea del servidor web**: uvicorn en el mismo loop.
- **Watchdog**: si una tarea muere, la reinicia con backoff y avisa por Telegram.

Nada de hilos compartiendo estado mutable. El `Portfolio` vive en el loop de
trading; el panel lee un snapshot inmutable publicado en cada vela.

Apagado limpio: `SIGINT`/`SIGTERM` → deja de aceptar señales nuevas, espera a que
terminen las órdenes en vuelo, persiste el estado y cierra. **No cierra posiciones
al apagar** (eso sería una decisión de trading tomada por el sistema operativo);
para eso está el kill switch explícito.

Reinicio: se reconcilia el estado contra el exchange (órdenes abiertas, balances)
y contra SQLite (posiciones lógicas). Las discrepancias se registran y se
notifican; si son graves, el bot arranca en modo "solo lectura".

---

## 6. Rendimiento

Decisiones tomadas por rendimiento, sin comprometer la claridad:

- Indicadores **vectorizados con numpy**, no bucles de Python.
- Las ventanas de backtest son **vistas** (`slices`) sobre los arrays completos:
  recorrer 100.000 velas no copia memoria.
- **Caché de indicadores por ventana**: varias estrategias sobre el mismo símbolo
  comparten el cálculo.
- Caché **en disco** de OHLCV (SQLite) para no volver a descargar histórico.
- SQLite en **WAL** con índices y escrituras por lotes.
- `uvloop` si está disponible; sesiones HTTP reutilizadas; rate limiter propio
  para no comerse baneos del exchange.
- El coste real del live es I/O, no CPU: el bucle procesa una vela por hora, así
  que el esfuerzo de optimización se concentra en el backtest y en la red.

---

## 7. Seguridad

- **Claves solo en variables de entorno**, nunca en el repo. `.gitignore` cubre
  `.env`, `data/`, `logs/`.
- Permisos de la API key: **habilitar solo trading spot, nunca retiradas**, y
  restringir por IP en el exchange. El bot comprueba al arrancar que la clave no
  tenga permisos de retirada cuando el exchange lo expone.
- Los logs enmascaran claves, firmas y cabeceras de autenticación.
- El modo `live` exige un flag explícito de confirmación en la configuración.
- El panel web es de solo lectura salvo el kill switch, con token obligatorio si
  no escucha en localhost.
- Dependencias fijadas con versiones mínimas y auditables.

---

## 8. Qué **no** hace este sistema (limitaciones conscientes)

Decirlo por adelantado evita sorpresas caras:

- No predice el mercado. Implementa reglas conocidas y públicas cuyo *edge*
  histórico es pequeño, inestable y puede haber desaparecido.
- No hace market making, arbitraje ni HFT: opera a cierre de vela.
- No modela profundidad de libro ni impacto de mercado. Con tamaño grande o pares
  ilíquidos, los resultados reales serán peores que el backtest.
- No gestiona la fiscalidad ni genera informes fiscales.
- No es asesoramiento financiero. **Puedes perder todo el capital.**

---

## 9. Decisiones de diseño y alternativas descartadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| ccxt como capa de exchange | SDK nativo de cada exchange | Un solo interfaz para 100+ exchanges; el coste es no tener las últimas features de cada uno |
| SQLite | PostgreSQL / TimescaleDB | Cero operaciones, transaccional, suficiente para un bot mono-proceso. La interfaz `Repository` permite cambiarlo si hace falta |
| REST a cierre de vela | WebSocket en tiempo real | Simplicidad y recuperación trivial ante desconexión. WS previsto tras la misma interfaz |
| Backtest dirigido por eventos | Backtest vectorizado | El vectorizado es más rápido pero no comparte código con el live → mentiras sutiles. La paridad vale más que la velocidad |
| numpy, sin pandas | pandas | Menos dependencias y menos memoria; los indicadores no necesitan un DataFrame |
| Un proceso asyncio | Microservicios / colas | El volumen no lo justifica. Menos piezas, menos fallos |
| Spot y solo largos por defecto | Futuros con apalancamiento | El apalancamiento multiplica el daño de cualquier bug. Se habilita a conciencia, no por defecto |
