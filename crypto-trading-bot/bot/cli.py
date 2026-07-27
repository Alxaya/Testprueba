"""Interfaz de línea de comandos.

    python -m bot doctor        # comprueba configuración y entorno (sin red)
    python -m bot strategies    # catálogo de estrategias con su documentación
    python -m bot download      # descarga histórico a la caché local
    python -m bot backtest      # backtest + informe
    python -m bot optimize      # optimización walk-forward
    python -m bot paper         # paper trading 24/7 con precios reales
    python -m bot live          # dinero real (exige confirmación explícita)
    python -m bot web           # solo el panel, sobre una base de datos existente

El orden de los subcomandos no es casual: es el orden en el que deberías usarlos.
No pases a `paper` sin un backtest, ni a `live` sin semanas de `paper`.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from bot.config.loader import load_config
from bot.config.schema import BotConfig
from bot.core.enums import RunMode
from bot.core.errors import BotError, ConfigError
from bot.core.logging_setup import get_logger, setup_logging
from bot.core.models import Candle, dt_to_ms
from bot.persistence.repository import Repository

log = get_logger("cli")

DEFAULT_CONFIG = "config/config.yaml"


# ---------------------------------------------------------------- utilidades


def _load(args: argparse.Namespace, **overrides: Any) -> BotConfig:
    """Carga la configuración aplicando los overrides del CLI."""
    config_path = Path(args.config)
    if not config_path.is_file() and args.config == DEFAULT_CONFIG:
        example = Path("config/config.example.yaml")
        if example.is_file():
            raise ConfigError(
                f"No existe {config_path}. Copia la plantilla:\n"
                f"    cp {example} {config_path}"
            )
    config = load_config(config_path if config_path.is_file() else None, overrides=overrides or None)
    setup_logging(config.logging, run_name=config.mode.value)
    return config


def _parse_date(value: str) -> int:
    """Convierte `YYYY-MM-DD` a milisegundos epoch UTC."""
    try:
        return dt_to_ms(datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=UTC))
    except ValueError as exc:
        raise ConfigError(f"Fecha no válida: {value!r}. Formato esperado: YYYY-MM-DD") from exc


def _load_history(config: BotConfig, args: argparse.Namespace) -> dict[str, list[Candle]]:
    """Obtiene el histórico para backtest: sintético, caché o descarga."""
    if getattr(args, "synthetic", False):
        from bot.data.synthetic import generate_candles

        log.warning(
            "Usando datos SINTÉTICOS. Sirven para comprobar que el código funciona, "
            "NUNCA para evaluar rentabilidad."
        )
        return {
            symbol: generate_candles(
                count=args.bars, timeframe=config.market.timeframe,
                drift_per_bar=0.0005, volatility_per_bar=0.015, seed=hash(symbol) % 10_000,
            )
            for symbol in config.market.symbols
        }

    from bot.data.store import OHLCVStore

    since = _parse_date(args.start) if args.start else dt_to_ms(
        datetime.now(tz=UTC) - timedelta(days=args.days)
    )
    until = _parse_date(args.end) if args.end else None

    data: dict[str, list[Candle]] = {}
    with OHLCVStore(config.storage.ohlcv_path) as store:
        for symbol in config.market.symbols:
            candles = store.load(symbol, config.market.timeframe, since=since, until=until)
            if not candles:
                raise BotError(
                    f"No hay datos de {symbol} {config.market.timeframe} en la caché.\n"
                    f"Descárgalos primero:  python -m bot download --days {args.days}"
                )
            data[symbol] = candles
            log.info(
                "%s: %d velas (%s → %s)",
                symbol, len(candles),
                candles[0].dt.strftime("%Y-%m-%d"), candles[-1].dt.strftime("%Y-%m-%d"),
            )
    return data


# ----------------------------------------------------------------- comandos


def cmd_doctor(args: argparse.Namespace) -> int:
    """Comprueba configuración y entorno sin tocar la red."""
    config = _load(args)
    print("═" * 70)
    print("DIAGNÓSTICO".center(70))
    print("═" * 70)

    problems: list[str] = []
    warnings: list[str] = []

    print(f"Modo               : {config.mode.value}")
    print(f"Exchange           : {config.exchange.id} (testnet={config.exchange.testnet})")
    print(f"Símbolos           : {', '.join(config.market.symbols)}")
    print(f"Timeframe          : {config.market.timeframe}")
    print(f"Capital inicial    : {config.portfolio.initial_balance:,.2f} {config.portfolio.base_currency}")
    print(f"Estrategias activas: {len(config.enabled_strategies())}")
    print()

    print("Riesgo:")
    print(f"  Riesgo por operación   : {config.risk.risk_per_trade_pct} %")
    print(f"  Máximo por posición    : {config.risk.max_position_pct} %")
    print(f"  Exposición máxima      : {config.risk.max_total_exposure_pct} %")
    print(f"  Pérdida diaria máxima  : {config.risk.max_daily_loss_pct} %")
    print(f"  Drawdown máximo        : {config.risk.max_drawdown_pct} %")
    print()

    # Dependencias
    print("Dependencias:")
    for module, needed_for in [
        ("numpy", "indicadores"), ("ccxt", "exchange"), ("fastapi", "panel web"),
        ("uvicorn", "panel web"), ("httpx", "Telegram"), ("yaml", "configuración"),
    ]:
        try:
            __import__(module)
            print(f"  ✓ {module:<10} ({needed_for})")
        except ImportError:
            print(f"  ✗ {module:<10} ({needed_for}) — FALTA")
            problems.append(f"Falta la dependencia {module}: pip install -r requirements.txt")
    print()

    # Credenciales
    print("Credenciales:")
    if config.exchange.has_credentials:
        print(f"  ✓ {config.exchange.api_key_env} y {config.exchange.api_secret_env} definidos")
    else:
        print(f"  · Sin credenciales ({config.exchange.api_key_env})")
        if config.mode is RunMode.LIVE:
            problems.append("Modo LIVE sin credenciales de exchange")
        else:
            warnings.append("Sin credenciales: solo backtest y paper con datos públicos")

    telegram = config.notifications.telegram
    if telegram.enabled:
        if telegram.bot_token and telegram.chat_id:
            print("  ✓ Telegram configurado")
        else:
            warnings.append(
                f"Telegram activado pero faltan {telegram.bot_token_env}/{telegram.chat_id_env}"
            )
    if config.web.enabled and not config.web.auth_token:
        if config.web.host in ("127.0.0.1", "localhost"):
            warnings.append("Panel sin token (aceptable: solo escucha en localhost)")
        else:
            problems.append(f"Panel expuesto en {config.web.host} sin token")
    print()

    # Rutas
    print("Almacenamiento:")
    for label, path in [
        ("Base de datos", config.storage.db_path),
        ("Caché OHLCV", config.storage.ohlcv_path),
        ("Logs", config.logging.directory),
    ]:
        target = Path(path)
        parent = target if target.suffix == "" else target.parent
        try:
            parent.mkdir(parents=True, exist_ok=True)
            print(f"  ✓ {label:<14} {path}")
        except OSError as exc:
            print(f"  ✗ {label:<14} {path} — {exc}")
            problems.append(f"No se puede escribir en {path}: {exc}")
    print()

    # Estrategias
    print("Estrategias configuradas:")
    from bot.strategies import build_strategy

    for strategy_config in config.strategies:
        mark = "✓" if strategy_config.enabled else "·"
        try:
            for symbol in config.symbols_for(strategy_config):
                strategy = build_strategy(
                    strategy_config.strategy, strategy_config.id, symbol,
                    config.timeframe_for(strategy_config), strategy_config.params,
                )
            print(
                f"  {mark} {strategy_config.id:<20} {strategy_config.strategy:<22} "
                f"warmup={strategy.warmup} velas"
            )
        except Exception as exc:
            print(f"  ✗ {strategy_config.id:<20} {exc}")
            problems.append(f"Estrategia {strategy_config.id}: {exc}")
    print()

    if config.mode is RunMode.LIVE:
        print("⚠️  MODO REAL CONFIGURADO")
        print("   Verifica antes de arrancar:")
        print("   · La API key NO tiene permiso de retirada.")
        print("   · La API key está restringida por IP en el exchange.")
        print("   · Has hecho al menos dos semanas de paper trading estable.")
        print("   · El capital comprometido es dinero que puedes permitirte perder.")
        print()

    print("═" * 70)
    for warning in warnings:
        print(f"⚠️  {warning}")
    for problem in problems:
        print(f"❌ {problem}")
    if not problems:
        print("✅ Configuración válida" + (" (con avisos)" if warnings else ""))
    print("═" * 70)
    return 1 if problems else 0


def cmd_strategies(args: argparse.Namespace) -> int:
    """Muestra el catálogo de estrategias con su documentación honesta."""
    from bot.strategies import available_strategies

    catalog = available_strategies()
    if args.name:
        if args.name not in catalog:
            print(f"Estrategia desconocida: {args.name}")
            print(f"Disponibles: {', '.join(sorted(catalog))}")
            return 1
        catalog = {args.name: catalog[args.name]}

    for name, cls in sorted(catalog.items()):
        doc = cls.describe()
        print("═" * 78)
        print(f"{name}  ·  {doc.family}")
        print("═" * 78)
        print(f"\n{doc.summary}\n")
        print("VENTAJA TEÓRICA")
        print(f"  {doc.edge}\n")
        print("LIMITACIONES")
        for item in doc.limitations:
            print(f"  · {item}")
        print("\nRIESGOS")
        for item in doc.risks:
            print(f"  · {item}")
        print("\nPARÁMETROS POR DEFECTO")
        for key, value in doc.params.items():
            print(f"  {key:<26} {value}")
        print()
    return 0


def cmd_download(args: argparse.Namespace) -> int:
    """Descarga histórico a la caché local."""
    from bot.data.ccxt_provider import CCXTDataProvider
    from bot.data.downloader import HistoricalDownloader
    from bot.data.store import OHLCVStore

    config = _load(args)
    since = _parse_date(args.start) if args.start else dt_to_ms(
        datetime.now(tz=UTC) - timedelta(days=args.days)
    )
    until = _parse_date(args.end) if args.end else None

    provider = CCXTDataProvider(config.exchange)
    with OHLCVStore(config.storage.ohlcv_path) as store:
        downloader = HistoricalDownloader(provider, store)
        for symbol in config.market.symbols:
            result = downloader.download(
                symbol, config.market.timeframe, since=since, until=until, force=args.force
            )
            print(
                f"{result.symbol} {result.timeframe}: {result.downloaded} nuevas, "
                f"{result.total_in_store} en total, {result.gaps} huecos"
            )
        print("\nInventario de la caché:")
        for symbol, timeframe, count, first, last in store.inventory():
            first_str = datetime.fromtimestamp(first / 1000, tz=UTC).strftime("%Y-%m-%d")
            last_str = datetime.fromtimestamp(last / 1000, tz=UTC).strftime("%Y-%m-%d")
            print(f"  {symbol:<12} {timeframe:<5} {count:>7} velas  {first_str} → {last_str}")
    provider.close()
    return 0


def cmd_backtest(args: argparse.Namespace) -> int:
    """Ejecuta un backtest y muestra el informe."""
    from bot.backtest.engine import BacktestEngine
    from bot.backtest.report import export_equity_csv, export_trades_csv, render_console

    config = _load(args, mode="backtest")
    data = _load_history(config, args)
    result = BacktestEngine(config, data).run()
    print()
    print(render_console(result))

    if args.output:
        output = Path(args.output)
        output.mkdir(parents=True, exist_ok=True)
        trades_path = export_trades_csv(result.trades, output / "trades.csv")
        equity_path = export_equity_csv(result.equity_curve, output / "equity.csv")
        print(f"\nExportado: {trades_path}  y  {equity_path}")

    if args.save_db:
        with Repository(config.storage.db_path) as repo:
            repo.start_run(RunMode.BACKTEST, config=result.to_dict())
            repo.save_backtest(result.trades, result.equity_curve)
            repo.end_run()
        print(f"Guardado en la base de datos: {config.storage.db_path}")

    return 0


def cmd_optimize(args: argparse.Namespace) -> int:
    """Optimización walk-forward con validación out-of-sample."""
    import json

    from bot.backtest.walkforward import ParameterGrid, WalkForwardOptimizer

    config = _load(args, mode="backtest")
    data = _load_history(config, args)

    try:
        grid_values = json.loads(args.grid)
    except json.JSONDecodeError as exc:
        raise ConfigError(
            f"--grid debe ser JSON válido. Ejemplo:\n"
            f'  --grid \'{{"fast_period": [10, 21, 34], "slow_period": [50, 55, 89]}}\'\n'
            f"Error: {exc}"
        ) from exc

    grid = ParameterGrid(grid_values)
    print(f"Explorando {grid.size} combinaciones por tramo…\n")

    optimizer = WalkForwardOptimizer(
        config, data, strategy_id=args.strategy_id, grid=grid, metric=args.metric
    )
    result = optimizer.run(train_bars=args.train_bars, test_bars=args.test_bars)
    print()
    print(result.render())
    return 0


def cmd_paper(args: argparse.Namespace) -> int:
    """Paper trading 24/7 con precios reales."""
    return _run_live(args, RunMode.PAPER)


def cmd_live(args: argparse.Namespace) -> int:
    """Operativa con dinero real."""
    config_preview = _load(args, mode="live")
    if not args.yes:
        print("═" * 70)
        print("⚠️  ESTÁS A PUNTO DE OPERAR CON DINERO REAL")
        print("═" * 70)
        print(f"Exchange : {config_preview.exchange.id} (testnet={config_preview.exchange.testnet})")
        print(f"Símbolos : {', '.join(config_preview.market.symbols)}")
        print(f"Riesgo   : {config_preview.risk.risk_per_trade_pct} % del capital por operación")
        print(f"Drawdown máximo antes del kill switch: {config_preview.risk.max_drawdown_pct} %")
        print()
        answer = input("Escribe 'SI ACEPTO EL RIESGO' para continuar: ").strip()
        if answer != "SI ACEPTO EL RIESGO":
            print("Cancelado.")
            return 1
    return _run_live(args, RunMode.LIVE)


def _run_live(args: argparse.Namespace, mode: RunMode) -> int:
    """Arranca el motor (paper o live) junto con el panel web."""
    from bot.broker.paper import PaperBroker
    from bot.data.ccxt_provider import CCXTDataProvider
    from bot.engine import TradingEngine
    from bot.notifications.telegram import build_notifier

    config = _load(args, mode=mode.value)
    repo = Repository(config.storage.db_path)
    repo.start_run(mode, config={"symbols": config.market.symbols, "timeframe": config.market.timeframe})
    notifier = build_notifier(config.notifications)

    provider = CCXTDataProvider(config.exchange)

    if mode is RunMode.LIVE:
        from bot.broker.ccxt_broker import CCXTBroker

        broker: Any = CCXTBroker(config.exchange)
        broker.load_markets()
        for warning in broker.check_permissions():
            log.warning(warning)
            notifier.warning(warning, title="Seguridad de la API key")
    else:
        broker = PaperBroker(
            initial_balance=config.portfolio.initial_balance,
            quote_currency=config.portfolio.base_currency,
            fees=config.exchange.fees,
            execution=config.execution,
        )
        # El simulador aprende las reglas reales del mercado para que los
        # rechazos por mínimos y precisión sean los mismos que en producción.
        try:
            markets = provider.load_markets()
            from bot.broker.ccxt_broker import CCXTBroker, _as_decimals
            from bot.core.models import MarketInfo

            for symbol in config.market.symbols:
                market = markets.get(symbol)
                if not market:
                    continue
                precision = market.get("precision") or {}
                limits = market.get("limits") or {}
                broker.register_market(
                    MarketInfo(
                        symbol=symbol,
                        base=market.get("base", symbol.split("/")[0]),
                        quote=market.get("quote", symbol.split("/")[-1]),
                        price_precision=_as_decimals(precision.get("price")),
                        amount_precision=_as_decimals(precision.get("amount")),
                        min_amount=float((limits.get("amount") or {}).get("min") or 0.0),
                        min_notional=float((limits.get("cost") or {}).get("min") or 0.0),
                        maker_fee=config.exchange.fees.maker_rate,
                        taker_fee=config.exchange.fees.taker_rate,
                    )
                )
            log.info("Reglas de mercado reales cargadas en el simulador")
        except Exception as exc:
            log.warning("No se pudieron cargar las reglas de mercado: %s", exc)

    engine = TradingEngine(
        config, broker=broker, provider=provider, repository=repo, notifier=notifier
    )

    try:
        asyncio.run(_serve(engine, config, repo))
    except KeyboardInterrupt:  # pragma: no cover - interacción manual
        log.warning("Interrumpido por el usuario")
    finally:
        repo.close()
    return 0


async def _serve(engine: Any, config: BotConfig, repo: Repository) -> None:
    """Ejecuta motor y panel web en el mismo bucle de eventos.

    Cuando uno de los dos termina, el otro se cierra de forma **ordenada**: a
    uvicorn se le pide `should_exit` en lugar de cancelarle la tarea, porque
    cancelarlo en bruto deja conexiones a medias y ensucia el log con trazas de
    `CancelledError` que parecen un fallo y no lo son.
    """
    engine_task = asyncio.create_task(engine.start(), name="engine")
    tasks = [engine_task]
    server = None

    if config.web.enabled:
        import uvicorn

        from bot.web.app import create_app

        app = create_app(config, engine=engine, repository=repo)
        server = uvicorn.Server(
            uvicorn.Config(
                app, host=config.web.host, port=config.web.port,
                log_level="warning", access_log=False,
            )
        )
        # uvicorn instala sus propios manejadores de señales y se quedaría con
        # SIGINT/SIGTERM: los queremos en el motor, que es quien sabe apagar.
        server.install_signal_handlers = lambda: None  # type: ignore[method-assign]
        tasks.append(asyncio.create_task(server.serve(), name="web"))
        log.info("Panel disponible en http://%s:%d", config.web.host, config.web.port)

    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

    if server is not None:
        server.should_exit = True
    if not engine_task.done():
        engine.request_shutdown()

    if pending:
        _, still_running = await asyncio.wait(pending, timeout=15)
        for task in still_running:
            log.warning("La tarea %s no terminó a tiempo; se cancela", task.get_name())
            task.cancel()
        await asyncio.gather(*still_running, return_exceptions=True)

    for task in done:
        exc = task.exception()
        if exc:
            raise exc


def cmd_web(args: argparse.Namespace) -> int:
    """Arranca solo el panel sobre una base de datos existente."""
    from bot.web.app import run_web

    config = _load(args)
    with Repository(config.storage.db_path) as repo:
        last = repo.last_run()
        if last:
            repo.run_id = int(last["id"])
            log.info("Mostrando el run #%s (%s)", last["id"], last["mode"])
        else:
            log.warning("No hay runs en la base de datos todavía")
        run_web(config, engine=None, repository=repo)
    return 0


# -------------------------------------------------------------------- parser


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bot",
        description="Bot de trading de criptomonedas. Empieza siempre por 'doctor' y 'backtest'.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("-c", "--config", default=DEFAULT_CONFIG, help="ruta del YAML de configuración")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_history_args(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--days", type=int, default=365, help="días de histórico hacia atrás")
        sub.add_argument("--start", help="fecha inicial YYYY-MM-DD (tiene prioridad sobre --days)")
        sub.add_argument("--end", help="fecha final YYYY-MM-DD")

    doctor = subparsers.add_parser("doctor", help="comprueba configuración y entorno")
    doctor.set_defaults(func=cmd_doctor)

    strategies = subparsers.add_parser("strategies", help="catálogo de estrategias")
    strategies.add_argument("name", nargs="?", help="ver solo una estrategia")
    strategies.set_defaults(func=cmd_strategies)

    download = subparsers.add_parser("download", help="descarga histórico a la caché")
    add_history_args(download)
    download.add_argument("--force", action="store_true", help="re-descarga aunque ya esté en caché")
    download.set_defaults(func=cmd_download)

    backtest = subparsers.add_parser("backtest", help="ejecuta un backtest")
    add_history_args(backtest)
    backtest.add_argument("--synthetic", action="store_true", help="datos sintéticos (solo para probar el código)")
    backtest.add_argument("--bars", type=int, default=2000, help="velas sintéticas a generar")
    backtest.add_argument("-o", "--output", help="directorio donde exportar los CSV")
    backtest.add_argument("--save-db", action="store_true", help="guarda el resultado en SQLite")
    backtest.set_defaults(func=cmd_backtest)

    optimize = subparsers.add_parser("optimize", help="optimización walk-forward")
    add_history_args(optimize)
    optimize.add_argument("--synthetic", action="store_true")
    optimize.add_argument("--bars", type=int, default=3000)
    optimize.add_argument("--strategy-id", required=True, help="id de la estrategia a optimizar")
    optimize.add_argument(
        "--grid", required=True,
        help='rejilla JSON, p. ej. \'{"fast_period":[10,21],"slow_period":[50,89]}\'',
    )
    optimize.add_argument("--train-bars", type=int, default=1500, help="velas in-sample por tramo")
    optimize.add_argument("--test-bars", type=int, default=500, help="velas out-of-sample por tramo")
    optimize.add_argument("--metric", default="sharpe_ratio", help="métrica a maximizar")
    optimize.set_defaults(func=cmd_optimize)

    paper = subparsers.add_parser("paper", help="paper trading 24/7 con precios reales")
    paper.set_defaults(func=cmd_paper)

    live = subparsers.add_parser("live", help="operativa con DINERO REAL")
    live.add_argument("--yes", action="store_true", help="salta la confirmación interactiva")
    live.set_defaults(func=cmd_live)

    web = subparsers.add_parser("web", help="solo el panel web")
    web.set_defaults(func=cmd_web)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except ConfigError as exc:
        print(f"\n❌ Error de configuración:\n{exc}\n", file=sys.stderr)
        return 2
    except BotError as exc:
        print(f"\n❌ {exc}\n", file=sys.stderr)
        return 1
    except KeyboardInterrupt:  # pragma: no cover
        print("\nInterrumpido.", file=sys.stderr)
        return 130


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
