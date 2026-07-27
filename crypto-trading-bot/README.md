# Bot de trading de criptomonedas

Bot modular para operar criptomonedas 24/7, con backtesting honesto, gestión
estricta del riesgo, panel web y alertas por Telegram.

> ## ⚠️ Léelo antes de tocar nada
>
> - **Esto no es asesoramiento financiero.** Puedes perder todo el capital.
> - **Aquí no hay estrategias milagrosas.** Solo técnicas públicas y conocidas
>   (cruce de medias, rupturas de canal, RSI, Bollinger), documentadas con sus
>   ventajas, sus limitaciones y sus riesgos reales. Su ventaja histórica es
>   pequeña, inestable y puede haber desaparecido.
> - **El modo por defecto es paper trading.** Operar con dinero real exige
>   activar a mano un interruptor y escribir una confirmación por teclado.
> - **Rentabilidad pasada no predice la futura.** Un backtest es la mejor versión
>   posible de la historia, no una previsión.

---

## Índice de documentación

| Documento | Contenido |
|---|---|
| [`docs/01-arquitectura.md`](docs/01-arquitectura.md) | Diseño completo del sistema, capas, decisiones y alternativas descartadas |
| [`docs/02-plan-fases.md`](docs/02-plan-fases.md) | Plan de desarrollo por fases con criterios de salida |
| [`docs/03-estrategias.md`](docs/03-estrategias.md) | Cada estrategia: qué hace, por qué podría funcionar, cuándo falla |
| [`docs/04-operacion.md`](docs/04-operacion.md) | Seguridad de claves, despliegue 24/7, kill switch, monitorización |

---

## Qué incluye

- **Arquitectura modular** en capas, con el dominio (estrategias, riesgo,
  cartera) aislado de la infraestructura (exchange, base de datos, red).
- **Paridad backtest / paper / live**: los mismos objetos de estrategia, riesgo y
  cartera en los tres modos. Solo cambia el broker.
- **Backtesting dirigido por eventos** sin look-ahead, con comisiones, slippage y
  comparación obligatoria contra comprar y mantener.
- **Optimización walk-forward** con validación out-of-sample y detección de
  sobreajuste.
- **Gestión de riesgo** con dimensionado por fracción fija, stops obligatorios,
  topes de exposición y cortacircuitos (pérdida diaria, drawdown, rachas).
- **Kill switch** por fichero, por API y automático.
- **Registro completo** en SQLite, incluidas las señales rechazadas y su motivo.
- **Panel web** autocontenido (sin CDN) con equity, posiciones, operaciones y
  métricas.
- **Alertas por Telegram** con cola en segundo plano, deduplicación y heartbeat.
- **Varias estrategias simultáneas**, cada una con su presupuesto de riesgo.
- **Integración con 100+ exchanges** vía ccxt, con testnet por defecto.

---

## Instalación rápida

```bash
cd crypto-trading-bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp config/config.example.yaml config/config.yaml
cp .env.example .env          # rellena solo si vas a usar exchange real o Telegram

python -m bot doctor          # comprueba configuración y entorno (sin red)
```

## Primeros pasos, en orden

```bash
# 1. Ver el catálogo de estrategias con su documentación honesta
python -m bot strategies

# 2. Descargar histórico (se cachea en disco; la segunda vez es instantáneo)
python -m bot download --days 365

# 3. Backtest con informe completo
python -m bot backtest --days 365 -o backtest_output

# 4. ¿Aguanta fuera de muestra? (detección de sobreajuste)
python -m bot optimize --strategy-id ema_btc \
  --grid '{"fast_period":[10,21,34],"slow_period":[50,55,89]}' \
  --train-bars 3000 --test-bars 1000

# 5. Paper trading 24/7 con precios reales + panel en http://127.0.0.1:8000
python -m bot paper
```

**No pases al paso 5 sin haber hecho los pasos 3 y 4.** Y no pases a `live` sin
al menos dos semanas de paper estable: ver [`docs/04-operacion.md`](docs/04-operacion.md).

Si tu exchange está geobloqueado en tu servidor (HTTP 451), cambia `exchange.id`
en el YAML. ccxt soporta más de cien.

---

## Estructura

```
bot/
├── core/          Modelos, indicadores (numpy), ventanas, tiempos. Sin I/O.
├── config/        Esquema pydantic + carga YAML/entorno.
├── data/          Proveedores de velas, caché SQLite, validación de integridad.
├── broker/        PaperBroker (simulador) y CCXTBroker (exchange real).
├── strategies/    Catálogo con registro por decorador.
├── risk/          Dimensionado, límites y cortacircuitos.
├── execution/     Enrutado idempotente de órdenes y contabilidad de cartera.
├── backtest/      Motor, métricas, informes y walk-forward.
├── persistence/   Registro completo en SQLite (WAL).
├── notifications/ Telegram y notificadores base.
├── web/           API FastAPI + dashboard autocontenido.
├── engine.py      Orquestador asyncio del modo en vivo.
└── cli.py         Interfaz de línea de comandos.
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `python -m bot doctor` | Valida configuración, dependencias, rutas y credenciales (sin red) |
| `python -m bot strategies [nombre]` | Catálogo con ventajas, limitaciones y riesgos |
| `python -m bot download --days N` | Descarga incremental de histórico a la caché |
| `python -m bot backtest` | Backtest + informe + exportación CSV |
| `python -m bot optimize` | Optimización walk-forward out-of-sample |
| `python -m bot paper` | Paper trading 24/7 con precios reales |
| `python -m bot live` | Dinero real (exige confirmación explícita) |
| `python -m bot web` | Solo el panel, sobre una base de datos existente |

Cualquier valor del YAML se sobrescribe por entorno:

```bash
BOT__RISK__RISK_PER_TRADE_PCT=0.25 python -m bot backtest
```

---

## Gestión de riesgo

El `RiskManager` puede **vetar cualquier orden** y es el único que decide
tamaños. Ninguna estrategia puede saltárselo, porque ninguna estrategia sabe
cuánto dinero hay.

El tamaño se calcula por **fracción fija sobre la distancia al stop**:

```
cantidad = (equity × riesgo_por_operación) / |precio_entrada − stop|
```

Así, todas las operaciones arriesgan lo mismo y una racha de pérdidas es
predecible: diez pérdidas seguidas al 0,5 % son un −5 %, no una sorpresa.

Controles activos por defecto:

| Control | Valor | Efecto |
|---|---|---|
| Riesgo por operación | 0,5 % | Sobre la distancia al stop |
| Máximo por posición | 20 % | Del equity |
| Exposición total | 60 % | Del equity |
| Posiciones simultáneas | 3 | |
| Pérdida diaria máxima | 3 % | Deja de abrir el resto del día |
| Drawdown máximo | 15 % | **Kill switch**: cierra todo y para |
| Pérdidas consecutivas | 5 | Enfriamiento de 3 velas |
| Stop obligatorio | ATR × 2 | Sin stop no se entra, nunca |

Parar todo de inmediato:

```bash
touch data/KILL      # o el botón del panel web
```

---

## Desarrollo

```bash
pip install -r requirements-dev.txt
make test            # suite completa, sin red
make lint            # ruff + mypy
```

La suite no toca la red: usa datos sintéticos deterministas. Un test que depende
de internet es un test que falla solo.

**Regla del repositorio:** cualquier cambio en `bot/risk/` o `bot/execution/`
requiere tests nuevos. Es el código que mueve dinero.

---

## Despliegue 24/7

```bash
# systemd
sudo cp deploy/trading-bot.service /etc/systemd/system/
sudo systemctl enable --now trading-bot

# Docker
docker compose -f deploy/docker-compose.yml up -d
```

Detalles, endurecimiento y monitorización en
[`docs/04-operacion.md`](docs/04-operacion.md).

---

## Limitaciones conocidas

Decirlas por adelantado evita sorpresas caras:

- No predice el mercado. Implementa reglas públicas cuyo *edge* es pequeño e
  inestable.
- No hace market making, arbitraje ni HFT: opera a cierre de vela.
- No modela profundidad de libro ni impacto de mercado. Con tamaño grande o pares
  ilíquidos, los resultados reales serán **peores** que el backtest.
- Spot y solo largos por defecto. Los cortos y el apalancamiento exigen
  habilitación explícita y una revisión de riesgo propia.
- No genera informes fiscales.

---

## Licencia

MIT. Se proporciona **sin garantía de ningún tipo**. El uso, y sus consecuencias
económicas, son responsabilidad exclusiva de quien lo ejecuta.
