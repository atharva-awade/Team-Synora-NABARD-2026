"""
Export trained models + an offline data bundle for the frontend.

Produces two things under the frontend's public/ folder:

  1. models/risk.onnx  -- the GradientBoosting early-warning classifier, so the
     browser can run genuine on-device inference (via onnxruntime-web) when an
     owner enters new figures, with zero network.

  2. data/pravah_bundle.json -- everything needed to browse and simulate fully
     offline: sector/driver metadata, model metrics, the portfolio summary, a
     full per-enterprise detail snapshot, and compact linear forecast params so
     the what-if simulator recomputes forecasts instantly in JavaScript.

Run:  python -m app.ml.export_onnx
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnxruntime as ort

from ..services.store import get_store
from ..services import analysis
from ..ml.forecast_model import (
    DRIVER_COLS, DRIVER_SIGNS, sector_seasonal_multiplier, expected_driver_path,
)
from ..ml.risk_model import RISK_FEATURES, risk_features_at
from ..sectors import SECTORS

FRONTEND_PUBLIC = Path(__file__).resolve().parents[3] / "frontend" / "public"


def export_risk_onnx(store) -> Path:
    gbc = store.risk_model.model
    onx = convert_sklearn(
        gbc,
        initial_types=[("input", FloatTensorType([None, len(RISK_FEATURES)]))],
        options={id(gbc): {"zipmap": False}},
        target_opset=17,
    )
    out_dir = FRONTEND_PUBLIC / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "risk.onnx"
    path.write_bytes(onx.SerializeToString())

    # Verify ONNX output matches sklearn on a few samples.
    hist0 = store.history(store.profiles[0]["id"])
    feats = np.array([[risk_features_at(hist0, len(hist0) - 1)[c] for c in RISK_FEATURES]],
                     dtype=np.float32)
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    onnx_proba = sess.run(None, {"input": feats})[1][0][1]
    skl_proba = gbc.predict_proba(feats.astype(float))[0, 1]
    assert abs(onnx_proba - skl_proba) < 1e-4, (onnx_proba, skl_proba)
    print(f"  risk.onnx OK (onnx={onnx_proba:.4f} vs sklearn={skl_proba:.4f}), "
          f"{path.stat().st_size/1024:.0f} KB")
    return path


def export_risk_trees(store) -> Path:
    """Export the GradientBoosting ensemble as compact JSON so the browser can
    run the exact same early-warning model on-device with a ~40-line evaluator
    and zero runtime dependencies. Verified against sklearn's decision_function.
    """
    gbc = store.risk_model.model
    n_feat = len(RISK_FEATURES)
    init_raw = float(gbc._raw_predict_init(np.zeros((1, n_feat), dtype=float))[0, 0])

    trees = []
    for est in gbc.estimators_[:, 0]:
        t = est.tree_
        trees.append({
            "feature": [int(f) for f in t.feature],
            "threshold": [float(round(x, 6)) for x in t.threshold],
            "left": [int(x) for x in t.children_left],
            "right": [int(x) for x in t.children_right],
            "value": [float(round(v[0][0], 6)) for v in t.value],
        })

    payload = {
        "features": RISK_FEATURES,
        "init": init_raw,
        "learning_rate": float(gbc.learning_rate),
        "trees": trees,
    }

    # Verify a pure-python (== JS) evaluator matches sklearn.
    def evaluate(x):
        raw = init_raw
        for tr in trees:
            node = 0
            while tr["feature"][node] >= 0:
                node = tr["left"][node] if x[tr["feature"][node]] <= tr["threshold"][node] else tr["right"][node]
            raw += payload["learning_rate"] * tr["value"][node]
        return 1.0 / (1.0 + np.exp(-raw))

    hist0 = store.history(store.profiles[3]["id"])
    feats = [risk_features_at(hist0, len(hist0) - 1)[c] for c in RISK_FEATURES]
    mine = evaluate(feats)
    skl = gbc.predict_proba(np.array([feats]))[0, 1]
    assert abs(mine - skl) < 1e-4, (mine, skl)

    out_dir = FRONTEND_PUBLIC / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "risk_trees.json"
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"  risk_trees.json OK (js={mine:.4f} vs sklearn={skl:.4f}), "
          f"{path.stat().st_size/1024:.0f} KB, {len(trees)} trees")
    return path


def build_forecast_params(store) -> dict:
    """Compact params so the what-if simulator can recompute forecasts in JS,
    exactly mirroring forecast_model.forecast_enterprise()."""
    any_hist = store.history(store.profiles[0]["id"])
    last_month = any_hist["month"].iloc[-1]
    horizon = 6

    sectors_params = {}
    for key in SECTORS:
        sm = store.sector_models[key]
        path = expected_driver_path(key, last_month, horizon)
        months = [m.strftime("%Y-%m") for m in path.index]
        seas = [float(sector_seasonal_multiplier(key, np.array([m.month]))[0])
                for m in path.index]
        sectors_params[key] = {
            "coef": [float(c) for c in sm.coef],
            "intercept": float(sm.intercept),
            "driver_means": [float(m) for m in sm.driver_means],
            "seasonal_mult": seas,
            "expected_path": path[DRIVER_COLS].to_numpy().tolist(),
            "months": months,
        }

    enterprises_params = {}
    for p in store.profiles:
        bl = store.baselines[p["id"]]
        hlen = bl.history_len
        t_index = np.arange(hlen, hlen + horizon)
        month_nums = np.array([int(m.split("-")[1]) for m in sectors_params[p["sector"]]["months"]])
        base_vals = bl.predict(t_index, month_nums)
        enterprises_params[p["id"]] = {
            "scale": float(bl.scale),
            "sector": p["sector"],
            "baseline_vals": [float(v) for v in base_vals],
        }

    return {
        "driver_cols": DRIVER_COLS,
        "driver_signs": [float(s) for s in DRIVER_SIGNS],
        "horizon": horizon,
        "sectors": sectors_params,
        "enterprises": enterprises_params,
    }


def _load_metrics() -> dict:
    path = Path(__file__).resolve().parents[2] / "models" / "metrics.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def build_bundle(store) -> dict:
    portfolio = analysis.portfolio_summary(store)
    enterprises = {}
    risk_features = {}
    for p in store.profiles:
        enterprises[p["id"]] = analysis.enterprise_detail(store, p["id"], horizon=6)
        hist = store.history(p["id"])
        risk_features[p["id"]] = risk_features_at(hist, len(hist) - 1)

    return {
        "generated_for": "NABARD Hackathon @ GFF 2026",
        "meta": {
            "sectors": analysis.sector_options(),
            "drivers": analysis.driver_catalog(),
            "metrics": analysis.portfolio_summary.__doc__ and json.loads(
                (Path(__file__).resolve().parents[2] / "models" / "metrics.json").read_text(encoding="utf-8")),
        },
        "portfolio": portfolio,
        "enterprises": enterprises,
        "forecast_params": build_forecast_params(store),
        "risk_meta": {
            "features": RISK_FEATURES,
            "feature_importances": [float(x) for x in store.risk_model.model.feature_importances_],
            "bands": {"high": 55, "watch": 25},
        },
        "current_risk_features": risk_features,
    }


def main() -> None:
    import warnings
    warnings.filterwarnings("ignore")
    print("Loading store ...")
    store = get_store()
    print("Exporting risk model to ONNX ...")
    export_risk_onnx(store)
    print("Exporting risk trees to JSON (on-device evaluator) ...")
    export_risk_trees(store)
    print("Building offline data bundle ...")
    bundle = build_bundle(store)
    out_dir = FRONTEND_PUBLIC / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "pravah_bundle.json"
    path.write_text(json.dumps(bundle, separators=(",", ":")), encoding="utf-8")
    print(f"  bundle OK: {path.stat().st_size/1024:.0f} KB, "
          f"{len(bundle['enterprises'])} enterprises")
    print("Done.")


if __name__ == "__main__":
    main()
