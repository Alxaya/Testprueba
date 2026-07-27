# Plan de desarrollo por fases

Cada fase tiene un **criterio de salida** verificable. No se pasa a la siguiente
sin cumplirlo. Las fases 0–7 están implementadas en este repositorio; las 8–10
son la hoja de ruta de ampliación.

---

## Fase 0 — Cimientos ✅

**Objetivo:** que exista un esqueleto sobre el que todo lo demás encaje.

- Estructura de paquetes, `pyproject.toml`, dependencias fijadas.
- Modelos del dominio (`Candle`, `Signal`, `Order`, `Fill`, `Position`, `Trade`).
- Configuración YAML validada con pydantic + carga de secretos desde entorno.
- Logging estructurado con enmascarado de secretos.
- CLI con subcomandos.

**Criterio de salida:** `python -m bot doctor` valida la configuración y reporta
el entorno sin tocar la red.

---

## Fase 1 — Datos históricos ✅

**Objetivo:** tener datos fiables; sin esto, todo lo demás es ficción.

- `DataProvider` + implementación ccxt con paginación y reintentos.
- Caché SQLite de OHLCV con descarga incremental.
- Validación de integridad: timestamps monótonos, huecos, duplicados, coherencia
  OHLC.
- Generador de datos sintéticos para tests (GBM con volatilidad ajustable),
  para poder probar sin red.

**Criterio de salida:** `python -m bot download` deja en disco un histórico
verificado y reutilizable; los tests pasan sin conexión.

---

## Fase 2 — Backtesting ✅

**Objetivo:** poder medir antes de arriesgar.

- Motor dirigido por eventos, sin look-ahead (señal en el cierre de `t`,
  ejecución al open de `t+1`).
- `PaperBroker` con comisiones, slippage y rechazos realistas.
- Métricas completas + curva de equity y drawdown.
- Baseline `buy_and_hold` en todos los informes.

**Criterio de salida:** `python -m bot backtest` produce un informe con métricas
y comparación honesta contra comprar y mantener.

---

## Fase 3 — Estrategias ✅

**Objetivo:** un catálogo pequeño de estrategias clásicas, bien documentadas.

- Registro por decorador y parámetros validados.
- Seguimiento de tendencia: EMA crossover, Donchian breakout, MACD.
- Reversión a la media: RSI, Bandas de Bollinger.
- Cada una con `describe()`: ventajas, limitaciones y riesgos reales.

**Criterio de salida:** todas las estrategias corren en backtest sobre el mismo
histórico y su documentación aparece en el CLI y en el panel.

---

## Fase 4 — Gestión de riesgo ✅

**Objetivo:** que ningún fallo pueda arruinar la cuenta.

- Tamaño por fracción fija sobre la distancia al stop.
- Stop obligatorio (ATR si la estrategia no da uno), take profit y trailing.
- Topes de posición, de exposición total y de posiciones simultáneas.
- Cortacircuitos: pérdida diaria, drawdown máximo, rachas de pérdidas, cooldown.
- Kill switch por fichero y por API.

**Criterio de salida:** tests que demuestran que el `RiskManager` **rechaza** cada
uno de los casos límite, incluido "estrategia pide 100× el capital".

---

## Fase 5 — Persistencia y trazabilidad ✅

**Objetivo:** poder auditar cualquier decisión meses después.

- Esquema SQLite (WAL) con `runs`, `orders`, `fills`, `trades`, `equity`,
  `signals`, `events`.
- Se registran también las **señales rechazadas** con su motivo.
- Exportación a CSV.

**Criterio de salida:** tras un backtest o una sesión de paper, la base de datos
permite reconstruir la historia completa operación a operación.

---

## Fase 6 — Paper trading en vivo ✅

**Objetivo:** ejecutar 24/7 contra precios reales, con dinero simulado.

- `TradingEngine` asyncio: alineación con cierres de vela, watchdog, backoff,
  heartbeat y apagado limpio.
- Reconciliación de estado al arrancar.
- Alertas de Telegram.

**Criterio de salida:** el bot corre **≥ 2 semanas ininterrumpidas** en paper
sobre datos reales sin intervención, y sus resultados son coherentes con el
backtest del mismo periodo.

---

## Fase 7 — Panel web ✅

**Objetivo:** ver qué está pasando sin leer logs.

- API REST + dashboard autocontenido (sin CDN).
- Equity, drawdown, posiciones, operaciones, métricas, eventos, estrategias.
- Autenticación por token y kill switch desde el panel.

**Criterio de salida:** el panel refleja el estado real del bot y el kill switch
detiene la operativa en menos de un ciclo.

---

## Fase 8 — Live con capital mínimo 🔜

**Objetivo:** el salto a dinero real, hecho con cobardía deliberada.

Requisitos **previos e innegociables**:
1. Fase 6 superada (≥ 2 semanas de paper estable).
2. Backtest **y** walk-forward out-of-sample con resultados aceptables.
3. Claves de API sin permiso de retirada y restringidas por IP.
4. `i_understand_live_trading_risk: true` puesto a mano en la configuración.

Trabajo de la fase:
- Testnet del exchange primero (Binance testnet).
- Capital real inicial simbólico (lo que puedas perder sin que te afecte).
- Comparación diaria automática entre fills esperados y reales (medición del
  slippage real frente al modelado).
- Escalado gradual del capital solo tras varias semanas de coherencia.

**Criterio de salida:** el slippage real medido está dentro de lo modelado y no
hay discrepancias de reconciliación durante un mes.

---

## Fase 9 — Optimización y robustez 🔜

- WebSocket para datos y órdenes (misma interfaz `DataProvider`/`Broker`).
- Optimización walk-forward paralelizada (multiprocessing).
- Análisis de sensibilidad de parámetros y tests de robustez (Monte Carlo sobre
  el orden de las operaciones, aleatorización de costes).
- Métricas de latencia y presupuesto de errores.
- Migración opcional a PostgreSQL/TimescaleDB si el volumen lo pide.

## Fase 10 — Ampliación 🔜

- Multi-exchange simultáneo y enrutado por mejor precio.
- Cartera multi-activo con asignación por volatilidad y correlación.
- Derivados con apalancamiento (solo tras auditoría específica de riesgo).
- Backtesting con datos de libro de órdenes (tick data) para medir impacto.
- Modo *ensemble*: combinación de señales de varias estrategias con pesos.

---

## Cómo trabajar en cada fase

1. Escribe el test primero para el caso de riesgo (qué **no** debe pasar).
2. Implementa lo mínimo para que pase.
3. Corre el backtest completo y compara con el baseline `buy_and_hold`.
4. Documenta la limitación que acabas de introducir.

Regla permanente: **cualquier cambio que toque `bot/risk` o `bot/execution`
requiere tests nuevos.** Es el código que mueve dinero.
