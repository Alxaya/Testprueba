"""Tests de configuración, datos, persistencia y panel web.

Cubren la frontera del sistema: lo que entra (configuración, velas) y lo que sale
(base de datos, API). Todo se ejecuta **sin red**.
"""

from __future__ import annotations

import pytest

from bot.config.loader import env_overrides, load_config, redacted_dump
from bot.config.schema import BotConfig, RiskConfig, WebConfig
from bot.core.enums import RunMode
from bot.core.errors import ConfigError, DataIntegrityError
from bot.core.models import Candle
from bot.core.timeframe import (
    floor_to_timeframe,
    last_closed_open_ms,
    next_close_ms,
    periods_per_year,
    timeframe_to_ms,
)
from bot.data.base import check_integrity, require_clean, sanitize
from bot.data.store import OHLCVStore
from bot.data.synthetic import generate_candles

# ------------------------------------------------------------ configuración


def test_unknown_field_is_rejected(tmp_path) -> None:
    """Una clave mal escrita debe reventar al arrancar, no en producción."""
    config_file = tmp_path / "config.yaml"
    config_file.write_text("mode: paper\nrisk:\n  risk_per_trad_pct: 1.0\n")

    with pytest.raises(ConfigError, match="risk_per_trad_pct"):
        load_config(config_file, use_env=False, dotenv=None)


def test_live_mode_requires_explicit_acknowledgement() -> None:
    with pytest.raises(Exception, match="i_understand_live_trading_risk"):
        BotConfig(mode=RunMode.LIVE)


def test_position_cap_cannot_exceed_total_exposure() -> None:
    with pytest.raises(Exception, match="max_position_pct"):
        RiskConfig(max_position_pct=80, max_total_exposure_pct=50)


def test_trailing_multiplier_must_not_tighten_risk() -> None:
    with pytest.raises(Exception, match="trailing_stop_atr_multiplier"):
        RiskConfig(stop_atr_multiplier=3.0, trailing_stop_atr_multiplier=1.0)


def test_duplicate_strategy_ids_rejected() -> None:
    from bot.config.schema import StrategyConfig

    with pytest.raises(Exception, match="duplicados"):
        BotConfig(strategies=[
            StrategyConfig(id="a", strategy="ema_crossover"),
            StrategyConfig(id="a", strategy="macd_trend"),
        ])


def test_strategy_symbols_must_exist_in_market() -> None:
    from bot.config.schema import MarketConfig, StrategyConfig

    with pytest.raises(Exception, match="símbolos que no están"):
        BotConfig(
            market=MarketConfig(symbols=["BTC/USDT"]),
            strategies=[StrategyConfig(id="a", strategy="ema_crossover", symbols=["DOGE/USDT"])],
        )


def test_public_web_bind_requires_token(monkeypatch) -> None:
    monkeypatch.delenv("WEB_AUTH_TOKEN", raising=False)
    with pytest.raises(Exception, match="WEB_AUTH_TOKEN"):
        WebConfig(host="0.0.0.0")


def test_env_overrides_are_nested_and_typed() -> None:
    overrides = env_overrides({"BOT__RISK__MAX_DRAWDOWN_PCT": "12.5", "BOT__MODE": "paper"})

    assert overrides == {"risk": {"max_drawdown_pct": 12.5}, "mode": "paper"}


def test_redacted_dump_keeps_env_names_not_values() -> None:
    dump = redacted_dump(BotConfig())

    assert dump["exchange"]["api_key_env"] == "EXCHANGE_API_KEY"
    assert "api_key" not in dump["exchange"]


def test_invalid_symbol_format_rejected() -> None:
    from bot.config.schema import MarketConfig

    with pytest.raises(Exception, match="BASE/QUOTE"):
        MarketConfig(symbols=["BTCUSDT"])


# ------------------------------------------------------------------ tiempos


@pytest.mark.parametrize(
    ("timeframe", "expected_ms"),
    [("1m", 60_000), ("5m", 300_000), ("1h", 3_600_000), ("4h", 14_400_000), ("1d", 86_400_000)],
)
def test_timeframe_conversion(timeframe: str, expected_ms: int) -> None:
    assert timeframe_to_ms(timeframe) == expected_ms


def test_invalid_timeframe_raises() -> None:
    with pytest.raises(ValueError, match="no válido"):
        timeframe_to_ms("1año")


def test_periods_per_year_for_crypto() -> None:
    # Cripto opera 24/7: 365 días × 24 horas.
    assert periods_per_year("1h") == pytest.approx(8_760)
    assert periods_per_year("1d") == pytest.approx(365)


def test_bar_alignment() -> None:
    ts = 1_700_000_123_456  # instante arbitrario dentro de una vela
    floor = floor_to_timeframe(ts, "1h")

    assert floor % 3_600_000 == 0
    assert floor <= ts < floor + 3_600_000
    assert next_close_ms(ts, "1h") == floor + 3_600_000
    assert last_closed_open_ms(ts, "1h") == floor - 3_600_000


# -------------------------------------------------------------------- datos


def test_integrity_detects_gaps() -> None:
    candles = generate_candles(count=20, timeframe="1h")
    with_gap = candles[:10] + candles[13:]  # faltan 3 velas

    report = check_integrity(with_gap, "BTC/USDT", "1h")

    assert report.gaps == 3
    assert not report.is_clean


def test_integrity_detects_duplicates() -> None:
    candles = generate_candles(count=10, timeframe="1h")
    report = check_integrity([*candles, candles[-1]], "BTC/USDT", "1h")

    assert report.duplicates == 1


def test_sanitize_removes_duplicates_and_sorts() -> None:
    candles = generate_candles(count=10, timeframe="1h")
    messy = [*reversed(candles), candles[3]]

    cleaned = sanitize(messy, "BTC/USDT", "1h")

    assert len(cleaned) == 10
    assert all(cleaned[i].ts < cleaned[i + 1].ts for i in range(len(cleaned) - 1))


def test_require_clean_aborts_on_too_many_gaps() -> None:
    candles = generate_candles(count=100, timeframe="1h")
    broken = candles[:10] + candles[60:]  # 50 velas ausentes

    with pytest.raises(DataIntegrityError, match="ausentes"):
        require_clean(broken, "BTC/USDT", "1h")


def test_invalid_candle_detected() -> None:
    bad = Candle(ts=0, open=100, high=90, low=110, close=100, volume=1)  # high < low
    assert not bad.is_valid()

    good = Candle(ts=0, open=100, high=110, low=95, close=105, volume=1)
    assert good.is_valid()


def test_store_roundtrip_is_idempotent(tmp_path) -> None:
    candles = generate_candles(count=100, timeframe="1h")
    with OHLCVStore(tmp_path / "ohlcv.db") as store:
        store.save("BTC/USDT", "1h", candles)
        store.save("BTC/USDT", "1h", candles)  # re-guardar no duplica

        assert store.count("BTC/USDT", "1h") == 100
        loaded = store.load("BTC/USDT", "1h")
        assert len(loaded) == 100
        assert loaded[0].ts == candles[0].ts
        assert loaded[-1].close == pytest.approx(candles[-1].close)

        assert len(store.load("BTC/USDT", "1h", limit=10)) == 10
        first, last = store.range("BTC/USDT", "1h")
        assert (first, last) == (candles[0].ts, candles[-1].ts)


# -------------------------------------------------------------- persistencia


def test_repository_records_full_history(tmp_path) -> None:
    from bot.core.enums import ExitReason, PositionSide, SignalAction
    from bot.core.models import EquityPoint, Signal, Trade
    from bot.persistence.repository import Repository

    with Repository(tmp_path / "bot.db") as repo:
        run_id = repo.start_run(RunMode.BACKTEST, {"test": True})
        assert run_id > 0

        repo.save_trade(Trade(
            symbol="BTC/USDT", strategy_id="s", side=PositionSide.LONG, quantity=0.1,
            entry_price=30_000, exit_price=31_000, entry_ts=1, exit_ts=2,
            pnl=100.0, fees=3.0, exit_reason=ExitReason.TAKE_PROFIT,
        ))
        repo.save_equity_batch([
            EquityPoint(ts=i, equity=10_000 + i, cash=0, positions_value=0) for i in range(10)
        ])
        # Lo más útil para depurar: las señales RECHAZADAS y su motivo.
        repo.save_signal(
            Signal(action=SignalAction.ENTER_LONG, symbol="BTC/USDT", strategy_id="s",
                   ts=1, price=30_000),
            accepted=False, reject_reason="max_positions", detail="ya hay 3 abiertas",
        )
        repo.log_event("warning", "risk", "Límite alcanzado")

        assert len(repo.recent_trades()) == 1
        assert len(repo.equity_series()) == 10
        assert repo.rejection_stats() == {"max_positions": 1}
        assert len(repo.recent_events()) == 1
        repo.end_run()


# ---------------------------------------------------------------- panel web


def test_web_api_is_read_only_and_authenticated(tmp_path, monkeypatch) -> None:
    from fastapi.testclient import TestClient

    from bot.config.schema import StorageConfig
    from bot.persistence.repository import Repository
    from bot.web.app import create_app

    monkeypatch.setenv("WEB_AUTH_TOKEN", "secreto-de-prueba")
    config = BotConfig(
        web=WebConfig(host="127.0.0.1", auth_token_env="WEB_AUTH_TOKEN"),
        storage=StorageConfig(db_path=str(tmp_path / "bot.db")),
    )
    with Repository(tmp_path / "bot.db") as repo:
        repo.start_run(RunMode.PAPER)
        client = TestClient(create_app(config, engine=None, repository=repo))

        # /health nunca pide token: lo usan los supervisores.
        assert client.get("/health").status_code == 200

        assert client.get("/api/status").status_code == 401
        assert client.get("/api/status", headers={"Authorization": "Bearer malo"}).status_code == 401

        headers = {"Authorization": "Bearer secreto-de-prueba"}
        assert client.get("/api/status", headers=headers).status_code == 200
        assert client.get("/api/trades", headers=headers).json() == []

        # El catálogo de estrategias expone su documentación honesta.
        catalog = client.get("/api/strategies", headers=headers).json()["catalog"]
        assert "ema_crossover" in catalog
        assert catalog["ema_crossover"]["limitations"]

        # La configuración servida no filtra secretos.
        served = client.get("/api/config", headers=headers).json()
        assert "api_key" not in served["exchange"]


def test_write_endpoints_fail_closed_without_token(tmp_path, monkeypatch) -> None:
    """Sin token configurado, el kill switch se deniega aunque escuche en localhost.

    Escenario que motiva la regla: `cloudflared tunnel --url http://localhost:8000`
    publica el panel en internet mientras el bot sigue bindeado a 127.0.0.1, así
    que la validación de configuración no se entera. Si la escritura estuviese
    abierta "porque es localhost", cualquiera con la URL podría accionar el kill
    switch y cerrar posiciones ajenas.
    """
    from fastapi.testclient import TestClient

    from bot.config.schema import StorageConfig
    from bot.persistence.repository import Repository
    from bot.web.app import create_app

    monkeypatch.delenv("WEB_AUTH_TOKEN", raising=False)
    config = BotConfig(
        web=WebConfig(host="127.0.0.1", auth_token_env="WEB_AUTH_TOKEN"),
        storage=StorageConfig(db_path=str(tmp_path / "bot.db")),
    )
    with Repository(tmp_path / "bot.db") as repo:
        repo.start_run(RunMode.PAPER)
        client = TestClient(create_app(config, engine=None, repository=repo))

        # La lectura sigue permitida en localhost: es la comodidad que justifica
        # no exigir token para mirar tu propio bot en tu propia máquina.
        assert client.get("/api/status").status_code == 200

        # La escritura, no.
        response = client.post("/api/killswitch", json={"engage": True})
        assert response.status_code == 403
        detail = response.json()["detail"]
        assert "WEB_AUTH_TOKEN" in detail, "el error debe decir cómo habilitarlo"
        assert "KILL" in detail, "y ofrecer la alternativa por fichero"


def test_write_endpoints_work_with_token(tmp_path, monkeypatch) -> None:
    """Con token, la escritura funciona y sigue exigiendo credencial válida."""
    from fastapi.testclient import TestClient

    from bot.config.schema import StorageConfig
    from bot.persistence.repository import Repository
    from bot.web.app import create_app

    monkeypatch.setenv("WEB_AUTH_TOKEN", "token-de-prueba")
    config = BotConfig(
        web=WebConfig(host="127.0.0.1", auth_token_env="WEB_AUTH_TOKEN"),
        storage=StorageConfig(db_path=str(tmp_path / "bot.db")),
    )
    with Repository(tmp_path / "bot.db") as repo:
        repo.start_run(RunMode.PAPER)
        client = TestClient(create_app(config, engine=None, repository=repo))

        assert client.post("/api/killswitch", json={"engage": True}).status_code == 401
        assert client.post(
            "/api/killswitch", json={"engage": True},
            headers={"Authorization": "Bearer malo"},
        ).status_code == 401

        # Sin motor adjunto responde 503, pero ya ha pasado la autenticación:
        # es la prueba de que el token abre la puerta.
        ok = client.post(
            "/api/killswitch", json={"engage": True},
            headers={"Authorization": "Bearer token-de-prueba"},
        )
        assert ok.status_code == 503
