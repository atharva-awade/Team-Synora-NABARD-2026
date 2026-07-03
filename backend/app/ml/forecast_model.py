"""
Cash-flow forecasting model (3-6 month horizon) for Pravah.

Design goal: accurate *and* explainable by construction. We decompose each
enterprise's monthly net cash flow into an additive structure:

    net_cashflow(t) = baseline(t) + driver_response(t) + noise

  * baseline(t)         -- level + damped trend + seasonal harmonics, fitted
                           per enterprise from its own history (statsmodels-free
                           OLS via least squares). Captures the enterprise's
                           intrinsic rhythm when external signals sit at norm.

  * driver_response(t)  -- a per-SECTOR ridge regression mapping the six
                           normalised driver signals (output price, input cost,
                           demand, weather, productivity, UPI activity) onto the
                           residual, expressed as a fraction of enterprise scale.
                           Because it is linear, each driver's contribution is an
                           EXACT Shapley value: coef_i * (x_i - mean_i) * scale.

This gives us: a real trained ML model, honest error metrics, offline-friendly
tiny models (ridge -> ONNX), and a plain-language "why" for every forecast.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score

from ..sectors import SECTORS

DRIVER_COLS = [
    "d_output_price", "d_input_cost", "d_demand",
    "d_weather", "d_productivity", "d_upi_activity",
]

DRIVER_LABELS = {
    "d_output_price": "Output price",
    "d_input_cost": "Input cost",
    "d_demand": "Market demand",
    "d_weather": "Weather / climate",
    "d_productivity": "Productivity / yield",
    "d_upi_activity": "Digital (UPI) activity",
}


# --------------------------------------------------------------------------- #
# Baseline (level + trend + seasonal) per enterprise
# --------------------------------------------------------------------------- #

def _design_matrix(t_norm: np.ndarray, month: np.ndarray) -> np.ndarray:
    """[intercept, trend, sin1, cos1, sin2, cos2] seasonal-trend basis."""
    ang = 2 * np.pi * month / 12.0
    return np.column_stack([
        np.ones_like(t_norm),
        t_norm,
        np.sin(ang), np.cos(ang),
        np.sin(2 * ang), np.cos(2 * ang),
    ])


@dataclass
class Baseline:
    coefs: np.ndarray          # 6 OLS coefficients
    history_len: int
    scale: float               # enterprise scale (mean income) for driver model

    def predict(self, t_index: np.ndarray, month: np.ndarray,
                trend_damping: float = 0.5) -> np.ndarray:
        """Evaluate baseline at (absolute month index, calendar month).

        For future points (t_index >= history_len) the trend term is damped so
        short-horizon extrapolation stays conservative rather than runaway."""
        t_norm = t_index / max(1, self.history_len)
        X = _design_matrix(t_norm, month)
        # Damp only the trend column's extrapolation beyond history.
        future = t_index >= self.history_len
        if future.any():
            excess = (t_norm - 1.0).clip(min=0)
            X[:, 1] = np.where(future, 1.0 + trend_damping * excess, t_norm)
        return X @ self.coefs


def fit_baseline(hist: pd.DataFrame) -> Baseline:
    y = hist["net_cashflow"].to_numpy(dtype=float)
    n = len(y)
    t_index = np.arange(n)
    month = hist["month"].dt.month.to_numpy()
    X = _design_matrix(t_index / n, month)
    coefs, *_ = np.linalg.lstsq(X, y, rcond=None)
    scale = float(max(1.0, hist["income"].mean()))
    return Baseline(coefs=coefs, history_len=n, scale=scale)


# --------------------------------------------------------------------------- #
# Per-sector driver-response model
# --------------------------------------------------------------------------- #

@dataclass
class SectorDriverModel:
    sector: str
    model: Ridge
    driver_means: np.ndarray
    metrics: dict = field(default_factory=dict)

    def predict_fraction(self, drivers: np.ndarray) -> np.ndarray:
        return self.model.predict(drivers)

    def contributions(self, drivers: np.ndarray, scale: float,
                      seasonal: float = 1.0) -> dict[str, float]:
        """Exact per-driver rupee contribution (Shapley for a linear model)."""
        coef = self.model.coef_
        contrib = {}
        for i, col in enumerate(DRIVER_COLS):
            contrib[col] = float(coef[i] * (drivers[i] - self.driver_means[i]) * scale * seasonal)
        return contrib


def sector_seasonal_multiplier(sector_key: str, month: np.ndarray) -> np.ndarray:
    """Turnover seasonal multiplier (mean ~1.0) for a sector at given months.

    Driver effects scale with turnover, so normalising the driver response by
    this multiplier makes the relationship linear -- which both fits better and
    keeps the exact-attribution property intact."""
    from .data_generator import _seasonal
    sector = SECTORS[sector_key]
    return 1.0 + _seasonal(month, sector.peak_month, sector.seasonal_amplitude,
                           sector.secondary_peak_month)


def fit_sector_driver_model(sector_key: str, sector_hist: pd.DataFrame,
                            baselines: dict[str, Baseline]) -> SectorDriverModel:
    """Fit ridge on seasonally-normalised residual-fraction ~ drivers."""
    rows_X, rows_y = [], []
    for ent_id, g in sector_hist.groupby("enterprise_id"):
        g = g.sort_values("month")
        bl = baselines[ent_id]
        t_index = np.arange(len(g))
        month = g["month"].dt.month.to_numpy()
        baseline = bl.predict(t_index, month)
        seas = np.clip(sector_seasonal_multiplier(sector_key, month), 0.4, None)
        resid_fraction = (g["net_cashflow"].to_numpy() - baseline) / bl.scale / seas
        rows_X.append(g[DRIVER_COLS].to_numpy(dtype=float))
        rows_y.append(resid_fraction)
    X = np.vstack(rows_X)
    y = np.concatenate(rows_y)

    model = Ridge(alpha=1.0)
    model.fit(X, y)
    pred = model.predict(X)
    metrics = {
        "r2_fraction": float(r2_score(y, pred)),
        "n_samples": int(len(y)),
    }
    return SectorDriverModel(
        sector=sector_key,
        model=model,
        driver_means=X.mean(axis=0),
        metrics=metrics,
    )


# --------------------------------------------------------------------------- #
# Expected future driver path (baseline scenario = signals revert to norm)
# --------------------------------------------------------------------------- #

def expected_driver_path(sector_key: str, last_month: pd.Timestamp,
                         horizon: int) -> pd.DataFrame:
    """Deterministic seasonal expectation for each driver over the horizon.

    The baseline scenario assumes no shocks: drivers follow their seasonal
    norm. The what-if simulator layers user shocks on top of this path.
    """
    from .data_generator import _seasonal  # local import to avoid cycle
    sector = SECTORS[sector_key]
    months_ahead = pd.date_range(last_month, periods=horizon + 1, freq="MS")[1:]
    m = months_ahead.month.to_numpy()
    path = pd.DataFrame(index=months_ahead)
    path["d_output_price"] = _seasonal(m, sector.peak_month, 0.05, None)
    path["d_input_cost"] = _seasonal(m, 6, 0.06, None)
    path["d_demand"] = _seasonal(m, sector.peak_month, 0.10, sector.secondary_peak_month)
    path["d_weather"] = _seasonal(m, 8, 0.08, 1)
    path["d_productivity"] = _seasonal(m, sector.peak_month, 0.05, None)
    path["d_upi_activity"] = _seasonal(m, sector.peak_month, 0.08, sector.secondary_peak_month) + 0.15
    return path


# --------------------------------------------------------------------------- #
# Forecast API used by the service layer
# --------------------------------------------------------------------------- #

@dataclass
class MonthForecast:
    month: str
    predicted_net_cashflow: float
    baseline: float
    driver_adjustment: float
    lower: float               # simple prediction band
    upper: float
    contributions: dict[str, float]
    active_shocks: dict[str, float] = field(default_factory=dict)


def forecast_enterprise(hist: pd.DataFrame, baseline: Baseline,
                        sector_model: SectorDriverModel, horizon: int = 6,
                        shocks: dict[str, float] | None = None,
                        band_sigma: float | None = None) -> list[MonthForecast]:
    """Produce a horizon-month forecast with exact factor attribution.

    ``shocks`` maps a driver column (e.g. "d_input_cost") to an additive delta
    applied across the horizon -- this powers the what-if scenario simulator.
    """
    hist = hist.sort_values("month")
    last_month = hist["month"].iloc[-1]
    hlen = baseline.history_len

    path = expected_driver_path(sector_model.sector, last_month, horizon)
    if shocks:
        for col, delta in shocks.items():
            if col in path.columns:
                path[col] = path[col] + float(delta)

    # Prediction band from in-sample residual spread.
    if band_sigma is None:
        t_index = np.arange(hlen)
        month = hist["month"].dt.month.to_numpy()
        in_baseline = baseline.predict(t_index, month)
        in_seas = sector_seasonal_multiplier(sector_model.sector, month)
        in_adj = baseline.scale * in_seas * sector_model.predict_fraction(
            hist[DRIVER_COLS].to_numpy(dtype=float))
        resid = hist["net_cashflow"].to_numpy() - (in_baseline + in_adj)
        band_sigma = float(np.std(resid))

    out: list[MonthForecast] = []
    for h in range(horizon):
        t_index = np.array([hlen + h])
        m = np.array([path.index[h].month])
        base_val = float(baseline.predict(t_index, m)[0])
        seas = float(sector_seasonal_multiplier(sector_model.sector, m)[0])
        drivers = path.iloc[h][DRIVER_COLS].to_numpy(dtype=float)
        frac = float(sector_model.predict_fraction(drivers.reshape(1, -1))[0])
        adj = baseline.scale * seas * frac
        contrib = sector_model.contributions(drivers, baseline.scale, seas)
        active = {}
        if shocks:
            active = {k: v for k, v in shocks.items() if abs(v) > 1e-6}
        out.append(MonthForecast(
            month=path.index[h].strftime("%Y-%m"),
            predicted_net_cashflow=round(base_val + adj, 0),
            baseline=round(base_val, 0),
            driver_adjustment=round(adj, 0),
            lower=round(base_val + adj - 1.28 * band_sigma, 0),
            upper=round(base_val + adj + 1.28 * band_sigma, 0),
            contributions={k: round(v, 0) for k, v in contrib.items()},
            active_shocks=active,
        ))
    return out


def backtest(hist: pd.DataFrame, baseline: Baseline,
             sector_model: SectorDriverModel, holdout: int = 6) -> dict:
    """Honest walk-forward evaluation on a held-out tail of the history.

    Returns the raw (actual, pred) pairs so the caller can pool them across the
    whole portfolio for a stable R2 -- a 6-point per-enterprise R2 is far too
    noisy to be meaningful on its own.
    """
    if len(hist) <= holdout + 6:
        return {}
    train = hist.iloc[:-holdout]
    test = hist.iloc[-holdout:]
    bl = fit_baseline(train)
    t_index = np.arange(len(train), len(train) + holdout)
    month = test["month"].dt.month.to_numpy()
    base = bl.predict(t_index, month)
    seas = sector_seasonal_multiplier(sector_model.sector, month)
    adj = bl.scale * seas * sector_model.predict_fraction(test[DRIVER_COLS].to_numpy(dtype=float))
    pred = base + adj
    actual = test["net_cashflow"].to_numpy()
    return {"actual": actual.tolist(), "pred": pred.tolist()}
