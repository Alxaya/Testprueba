"""Panel web: API REST + dashboard.

## Postura de seguridad

* **Solo lectura**, con una única excepción: activar/desactivar el kill switch.
  El panel no puede abrir ni cerrar posiciones, ni cambiar parámetros de riesgo.
  Un panel que puede operar es una superficie de ataque con acceso a tu dinero.
* **Escucha en `127.0.0.1` por defecto.** Para exponerlo fuera hace falta definir
  un token (la propia configuración lo exige) y, muy recomendable, un proxy
  inverso con TLS delante.
* **Nunca expone claves de API** ni valores de secretos: la configuración se
  sirve filtrada.
* El dashboard es **autocontenido**: sin CDN, sin fuentes externas, sin peticiones
  a terceros. Funciona en un servidor sin salida a internet y no filtra a nadie
  cuándo miras tu bot.
"""

from __future__ import annotations

import secrets
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from bot.config.loader import redacted_dump
from bot.config.schema import BotConfig
from bot.core.logging_setup import get_logger
from bot.engine import TradingEngine
from bot.persistence.repository import Repository
from bot.strategies.base import available_strategies

log = get_logger("web")

STATIC_DIR = Path(__file__).parent / "static"


def create_app(
    config: BotConfig,
    *,
    engine: TradingEngine | None = None,
    repository: Repository | None = None,
) -> FastAPI:
    """Crea la aplicación FastAPI del panel."""
    app = FastAPI(
        title="Panel del bot de trading",
        description="Visualización de resultados. Solo lectura salvo el kill switch.",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url=None,
    )

    token = config.web.auth_token

    def require_auth(request: Request) -> None:
        """Autenticación por token Bearer.

        Si no hay token configurado y el panel escucha en localhost, se permite el
        acceso: obligar a un token para mirar tu propio bot en tu propia máquina
        solo consigue que la gente desactive la seguridad entera.

        Ojo: esto **no** protege de un túnel (Cloudflare Tunnel, ngrok, SSH
        inverso). El bot sigue escuchando en 127.0.0.1, así que la validación de
        configuración no salta, pero el túnel publica el panel en internet. Por
        eso los endpoints de escritura fallan en cerrado sin token — ver
        `require_write_auth`.
        """
        if not token:
            return
        header = request.headers.get("authorization", "")
        provided = header[7:] if header.lower().startswith("bearer ") else request.query_params.get("token", "")
        # Comparación en tiempo constante: evita distinguir tokens por latencia.
        if not provided or not secrets.compare_digest(provided, token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token no válido o ausente",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def require_write_auth(request: Request) -> None:
        """Autenticación para los endpoints que **cambian el estado del bot**.

        A diferencia de la lectura, aquí no hay excepción por localhost: sin token
        configurado, la escritura se deniega.

        El motivo es concreto. Basta un `cloudflared tunnel --url
        http://localhost:8000` para que el panel quede publicado en internet sin
        que el bot se entere: sigue escuchando en 127.0.0.1 y la validación de
        configuración no tiene forma de saberlo. Si la escritura estuviese abierta
        "porque es localhost", cualquiera con la URL podría accionar el kill
        switch y cerrar tus posiciones.

        Fallar en cerrado cuesta un mensaje de error claro; fallar en abierto
        cuesta dinero.
        """
        if not token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Los controles de escritura están desactivados porque no hay token. "
                    f"Define {config.web.auth_token_env} y reinicia para habilitarlos. "
                    "Mientras tanto, el kill switch sigue disponible creando el fichero "
                    f"{config.storage.kill_switch_file}"
                ),
            )
        require_auth(request)

    # ------------------------------------------------------------- endpoints

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, Any]:
        """Sonda de vida para supervisores y contenedores. Sin autenticación."""
        return {
            "status": "ok" if (engine is None or engine.status.running) else "stopped",
            "mode": config.mode.value,
        }

    @app.get("/api/status", dependencies=[Depends(require_auth)])
    def get_status() -> dict[str, Any]:
        """Estado general del motor."""
        if engine is None:
            return {"running": False, "mode": config.mode.value, "message": "Motor no adjunto"}
        return engine.status.to_dict()

    @app.get("/api/positions", dependencies=[Depends(require_auth)])
    def get_positions() -> list[dict[str, Any]]:
        """Posiciones abiertas ahora mismo."""
        return engine.status.open_positions if engine else []

    @app.get("/api/trades", dependencies=[Depends(require_auth)])
    def get_trades(limit: int = 100) -> list[dict[str, Any]]:
        """Últimas operaciones cerradas."""
        if repository is None:
            return []
        return repository.recent_trades(limit=min(limit, 1000))

    @app.get("/api/equity", dependencies=[Depends(require_auth)])
    def get_equity(limit: int = 1000) -> list[dict[str, Any]]:
        """Curva de equity."""
        if repository is None:
            return []
        return repository.equity_series(limit=min(limit, 5000))

    @app.get("/api/orders", dependencies=[Depends(require_auth)])
    def get_orders(limit: int = 100) -> list[dict[str, Any]]:
        """Últimas órdenes enviadas, incluidas las rechazadas."""
        if repository is None:
            return []
        return repository.recent_orders(limit=min(limit, 1000))

    @app.get("/api/signals", dependencies=[Depends(require_auth)])
    def get_signals(limit: int = 100) -> dict[str, Any]:
        """Señales recientes y estadística de rechazos por motivo."""
        if repository is None:
            return {"signals": [], "rejections": {}}
        return {
            "signals": repository.recent_signals(limit=min(limit, 1000)),
            "rejections": repository.rejection_stats(),
        }

    @app.get("/api/events", dependencies=[Depends(require_auth)])
    def get_events(limit: int = 100) -> list[dict[str, Any]]:
        """Registro de eventos del motor."""
        if repository is None:
            return []
        return repository.recent_events(limit=min(limit, 1000))

    @app.get("/api/strategies", dependencies=[Depends(require_auth)])
    def get_strategies() -> dict[str, Any]:
        """Estrategias activas y catálogo completo con su documentación."""
        catalog = {
            name: cls.describe().to_dict() for name, cls in available_strategies().items()
        }
        return {
            "active": engine.status.strategies if engine else [],
            "catalog": catalog,
        }

    @app.get("/api/config", dependencies=[Depends(require_auth)])
    def get_config() -> dict[str, Any]:
        """Configuración efectiva, con los campos sensibles filtrados."""
        return redacted_dump(config)

    @app.get("/api/risk", dependencies=[Depends(require_auth)])
    def get_risk() -> dict[str, Any]:
        """Estado del gestor de riesgo y sus límites."""
        return engine.risk.snapshot() if engine else {}

    @app.post("/api/killswitch", dependencies=[Depends(require_write_auth)])
    def set_killswitch(payload: dict[str, Any]) -> dict[str, Any]:
        """Activa o desactiva el kill switch.

        Único endpoint de escritura del panel. Activarlo impide abrir posiciones
        nuevas de inmediato; el vigilante de stops cerrará las abiertas en el
        siguiente ciclo.
        """
        if engine is None:
            raise HTTPException(status_code=503, detail="Motor no adjunto")

        engage = bool(payload.get("engage", True))
        reason = str(payload.get("reason", "Activado desde el panel web"))[:200]

        if engage:
            engine.risk.engage_kill_switch(reason)
            log.critical("Kill switch activado desde el panel: %s", reason)
        else:
            engine.risk.release_kill_switch()
            log.warning("Kill switch desactivado desde el panel")

        if repository is not None:
            repository.log_event(
                "critical" if engage else "warning",
                "killswitch",
                f"Kill switch {'activado' if engage else 'desactivado'} desde el panel",
                {"reason": reason},
            )
        return {
            "kill_switch": engine.risk.state.kill_switch_engaged,
            "reason": engine.risk.state.kill_switch_reason,
        }

    # -------------------------------------------------------------- estáticos

    if STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

        @app.get("/", include_in_schema=False)
        def index() -> FileResponse:
            return FileResponse(STATIC_DIR / "index.html")

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
        """Nunca se filtran trazas al cliente: podrían revelar rutas y estructura."""
        log.exception("Error no controlado en %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Error interno"})

    return app


def run_web(
    config: BotConfig,
    *,
    engine: TradingEngine | None = None,
    repository: Repository | None = None,
) -> None:
    """Arranca el servidor web de forma síncrona (solo panel, sin motor)."""
    import uvicorn

    app = create_app(config, engine=engine, repository=repository)
    log.info("Panel disponible en http://%s:%d", config.web.host, config.web.port)
    warn_if_unprotected(config)
    uvicorn.run(app, host=config.web.host, port=config.web.port, log_level="warning")


def warn_if_unprotected(config: BotConfig) -> None:
    """Avisa cuando el panel no tiene token.

    Se avisa aunque escuche en localhost, porque un túnel (Cloudflare Tunnel,
    ngrok, SSH inverso) publica en internet un panel que sigue estando bindeado a
    127.0.0.1. Es el caso en el que la gente se expone sin darse cuenta.
    """
    if config.web.auth_token:
        return
    log.warning(
        "El panel funciona SIN token: los datos son visibles para quien alcance "
        "http://%s:%d y los controles de escritura están desactivados. "
        "Si vas a exponerlo con un túnel, define %s antes.",
        config.web.host, config.web.port, config.web.auth_token_env,
    )
