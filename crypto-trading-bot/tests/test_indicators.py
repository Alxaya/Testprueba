"""Tests de indicadores.

Lo que de verdad se valida aquí no son los valores (que también), sino la
propiedad crítica: **ningún indicador puede mirar al futuro**. Un solo indicador
con look-ahead invalida todos los backtests del sistema.
"""

from __future__ import annotations

import numpy as np
import pytest

from bot.core import indicators as ind


@pytest.fixture
def prices() -> np.ndarray:
    rng = np.random.default_rng(42)
    return np.cumprod(1 + rng.normal(0.0005, 0.02, 300)) * 100


def test_sma_matches_manual_mean(prices: np.ndarray) -> None:
    result = ind.sma(prices, 10)
    assert np.isnan(result[:9]).all(), "las primeras 9 posiciones no tienen datos suficientes"
    assert result[9] == pytest.approx(prices[:10].mean())
    assert result[-1] == pytest.approx(prices[-10:].mean())


def test_ema_seeded_with_sma(prices: np.ndarray) -> None:
    period = 12
    result = ind.ema(prices, period)
    assert np.isnan(result[: period - 1]).all()
    assert result[period - 1] == pytest.approx(prices[:period].mean())

    alpha = 2 / (period + 1)
    expected = alpha * prices[period] + (1 - alpha) * result[period - 1]
    assert result[period] == pytest.approx(expected)


def test_rsi_bounds_and_extremes() -> None:
    rising = np.arange(1, 101, dtype=np.float64)
    result = ind.rsi(rising, 14)
    valid = result[~np.isnan(result)]
    assert (valid >= 0).all() and (valid <= 100).all()
    # Serie estrictamente creciente: sin pérdidas, el RSI debe ser 100.
    assert valid[-1] == pytest.approx(100.0)

    falling = rising[::-1].copy()
    assert ind.rsi(falling, 14)[-1] == pytest.approx(0.0, abs=1e-6)


def test_atr_is_positive_and_tracks_range() -> None:
    high = np.array([10.0, 11, 12, 11, 13, 14, 15, 14, 16, 17, 18, 17, 19, 20, 21, 22])
    low = high - 2.0
    close = high - 1.0
    result = ind.atr(high, low, close, 5)
    valid = result[~np.isnan(result)]
    assert (valid > 0).all()
    assert valid[-1] == pytest.approx(2.0, abs=1.0)


def test_donchian_excludes_current_bar() -> None:
    """El canal debe usar velas anteriores, nunca la actual.

    Comparar el precio de una vela con un máximo que la incluye es look-ahead:
    la ruptura se detectaría en la misma vela que la crea y toda estrategia de
    ruptura parecería infalible.
    """
    high = np.array([10.0, 12, 11, 13, 20, 14])
    low = np.array([9.0, 10, 10, 11, 12, 13])
    _, _, upper = ind.donchian(high, low, 3)
    # En el índice 4 (high=20), el canal debe reflejar el máximo de 1..3 = 13.
    assert upper[4] == pytest.approx(13.0)
    assert upper[4] < high[4], "el canal no puede incluir la vela actual"


def test_bollinger_bands_ordered(prices: np.ndarray) -> None:
    lower, middle, upper = ind.bollinger(prices, 20, 2.0)
    valid = ~np.isnan(middle)
    assert (lower[valid] <= middle[valid]).all()
    assert (middle[valid] <= upper[valid]).all()


def test_macd_histogram_is_difference(prices: np.ndarray) -> None:
    macd_line, signal_line, histogram = ind.macd(prices)
    valid = ~np.isnan(histogram)
    assert np.allclose(histogram[valid], (macd_line - signal_line)[valid])


def test_crossings_detected_exactly_once() -> None:
    fast = np.array([1.0, 2, 3, 4, 3, 2])
    slow = np.array([2.0, 2, 2, 2, 4, 4])
    assert ind.crossed_above(fast, slow, index=2)
    assert not ind.crossed_above(fast, slow, index=3)
    assert ind.crossed_below(fast, slow, index=4)


@pytest.mark.parametrize(
    "func",
    [
        lambda x: ind.sma(x, 20),
        lambda x: ind.ema(x, 20),
        lambda x: ind.rsi(x, 14),
        lambda x: ind.rolling_max(x, 20),
        lambda x: ind.rolling_min(x, 20),
        lambda x: ind.rolling_std(x, 20),
    ],
)
def test_no_lookahead(prices: np.ndarray, func) -> None:
    """Truncar la serie no puede cambiar los valores ya calculados.

    Es la definición operativa de "no mirar al futuro": si el valor en la
    posición 150 cambia al añadir la vela 151, el indicador está haciendo trampa.
    """
    cut = 200
    full = func(prices)
    partial = func(prices[:cut].copy())

    valid = ~np.isnan(full[:cut]) & ~np.isnan(partial)
    assert valid.any(), "el test necesita al menos algún valor válido"
    assert np.allclose(full[:cut][valid], partial[valid]), "el indicador mira al futuro"


def test_indicators_handle_short_series() -> None:
    """Con menos datos que el periodo, se devuelven NaN en vez de reventar."""
    short = np.array([1.0, 2.0, 3.0])
    for result in (ind.sma(short, 20), ind.ema(short, 20), ind.rsi(short, 14)):
        assert result.size == short.size
        assert np.isnan(result).all()
