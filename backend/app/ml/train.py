"""
Training pipeline for Pravah's models.

Generates the simulated portfolio, fits per-enterprise baselines, trains the
per-sector driver-response models and the early-warning risk classifier,
runs honest walk-forward backtests, and persists all artifacts + metrics.

Run:  python -m app.ml.train
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ..sectors import SECTORS
from .data_generator import generate_portfolio, profiles_to_frame
from .forecast_model import (
    Baseline, fit_baseline, fit_sector_driver_model, backtest,
)
from .risk_model import train_risk_model

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _serialise_baseline(b: Baseline) -> dict:
    return {"coefs": b.coefs.tolist(), "history_len": b.history_len, "scale": b.scale}


def main(seed: int = 123) -> dict:
    print("Generating simulated portfolio ...")
    profiles, histories, drivers = generate_portfolio(seed=seed)
    prof_frame = profiles_to_frame(profiles)

    print("Fitting per-enterprise baselines ...")
    baselines: dict[str, Baseline] = {p.id: fit_baseline(histories[p.id]) for p in profiles}

    print("Training per-sector driver-response models ...")
    sector_models = {}
    for sector_key in SECTORS:
        sector_ids = prof_frame[prof_frame["sector"] == sector_key]["id"].tolist()
        sector_hist = pd.concat([histories[i] for i in sector_ids], ignore_index=True)
        sector_models[sector_key] = fit_sector_driver_model(sector_key, sector_hist, baselines)

    print("Backtesting forecasts (walk-forward hold-out) ...")
    all_actual: list[float] = []
    all_pred: list[float] = []
    for p in profiles:
        bt = backtest(histories[p.id], baselines[p.id], sector_models[p.sector])
        if bt:
            all_actual.extend(bt["actual"])
            all_pred.extend(bt["pred"])
    actual = np.array(all_actual)
    pred = np.array(all_pred)
    mae = float(np.mean(np.abs(actual - pred)))
    typ_ncf = float(np.mean([abs(histories[p.id]["net_cashflow"]).mean() for p in profiles]))
    # Directional accuracy: does the forecast get the up/down move right?
    d_actual = np.sign(np.diff(actual))
    d_pred = np.sign(np.diff(pred))
    directional = float(np.mean(d_actual == d_pred))
    from sklearn.metrics import r2_score as _r2
    forecast_metrics = {
        "mae": round(mae, 0),
        "mae_pct_of_typical_ncf": round(mae / typ_ncf * 100, 1),
        "r2": round(float(_r2(actual, pred)), 3),
        "directional_accuracy": round(directional, 3),
        "horizon_months": 6,
        "n_enterprises": len(profiles),
        "n_holdout_points": int(len(actual)),
    }
    print(f"  forecast: MAE=Rs {forecast_metrics['mae']:.0f} "
          f"({forecast_metrics['mae_pct_of_typical_ncf']}% of typical), "
          f"R2={forecast_metrics['r2']}, directional={forecast_metrics['directional_accuracy']}")

    print("Training early-warning risk model ...")
    risk = train_risk_model(histories, seed=seed)
    print(f"  risk: AUC={risk.metrics['auc']:.3f}, "
          f"accuracy={risk.metrics['accuracy']:.3f}, "
          f"n={risk.metrics['n_samples']}, base_rate={risk.metrics['positive_rate']:.2f}")

    print("Persisting artifacts ...")
    joblib.dump({
        "baselines": {k: v for k, v in baselines.items()},
        "sector_models": sector_models,
        "risk_model": risk,
    }, MODELS_DIR / "artifacts.joblib")

    # Persist portfolio (profiles + histories) for the service layer.
    hist_records = {}
    for p in profiles:
        h = histories[p.id].copy()
        h["month"] = h["month"].dt.strftime("%Y-%m-%d")
        hist_records[p.id] = h.to_dict(orient="records")
    (MODELS_DIR / "portfolio.json").write_text(json.dumps({
        "profiles": prof_frame.to_dict(orient="records"),
        "histories": hist_records,
    }), encoding="utf-8")

    metrics = {
        "forecast": forecast_metrics,
        "risk": {k: round(v, 3) if isinstance(v, float) else v for k, v in risk.metrics.items()},
        "sector_driver_r2": {k: round(v.metrics["r2_fraction"], 3) for k, v in sector_models.items()},
    }
    (MODELS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print("Done. Metrics written to models/metrics.json")
    return metrics


if __name__ == "__main__":
    main()
