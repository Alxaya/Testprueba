"""Bot de trading de criptomonedas.

Paquetes:

* `core`          — modelos, indicadores y utilidades del dominio (sin I/O).
* `config`        — esquema y carga de configuración.
* `data`          — proveedores de velas y caché histórica.
* `broker`        — acceso al exchange (simulado y real).
* `strategies`    — catálogo de estrategias.
* `risk`          — gestión de riesgo y dimensionado.
* `execution`     — enrutado de órdenes y cartera.
* `backtest`      — motor de backtesting, métricas y walk-forward.
* `persistence`   — registro en SQLite.
* `notifications` — alertas (Telegram).
* `web`           — panel de visualización.
* `engine`        — orquestador en vivo.
"""

__version__ = "1.0.0"
