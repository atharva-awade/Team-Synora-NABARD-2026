"""
Early-warning risk model + credit-readiness scorecard.

Risk (early warning)
--------------------
A GradientBoostingClassifier estimates the probability that an enterprise will
enter *financial stress within the next 3 months*, learned from engineered
features that combine financial behaviour, digital (UPI) proxies and recent
external-signal pressure. Output is a calibrated 0-100 risk score with
Low / Watch / High bands, plus the feature drivers behind the flag.

A "stress event" (the training label) is defined on the *actual future* of the
simulated data: cash balance falls below a thin buffer, or net cash flow turns
materially negative, within the next three months.

Credit readiness
----------------
A transparent scorecard (stability, repayment track record, surplus trend,
digital footprint) that maps an enterprise onto the grant -> formal-credit
graduation pathway central to NABARD's value-creation goals. It is rule-based
on purpose: a lender must be able to read exactly why a score is what it is.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, accuracy_score
from sklearn.model_selection import train_test_split

from ..sectors import SECTORS

RISK_FEATURES = [
    "ncf_mean_3", "ncf_trend_6", "ncf_volatility_6", "runway_months",
    "repayment_coverage", "savings_ratio", "upi_trend_3",
    "input_cost_recent", "demand_recent", "weather_recent",
    "seasonal_low_proximity", "sector_shock_exposure",
]

RISK_FEATURE_LABELS = {
    "ncf_mean_3": "Recent net cash flow",
    "ncf_trend_6": "Cash-flow trend",
    "ncf_volatility_6": "Income volatility",
    "runway_months": "Liquidity runway",
    "repayment_coverage": "Repayment capacity",
    "savings_ratio": "Savings buffer",
    "upi_trend_3": "Digital activity trend",
    "input_cost_recent": "Input-cost pressure",
    "demand_recent": "Demand conditions",
    "weather_recent": "Weather / climate",
    "seasonal_low_proximity": "Approaching lean season",
    "sector_shock_exposure": "Sector shock exposure",
}


def _slope(y: np.ndarray) -> float:
    if len(y) < 2:
        return 0.0
    x = np.arange(len(y))
    return float(np.polyfit(x, y, 1)[0])


def risk_features_at(hist: pd.DataFrame, t: int) -> dict:
    """Engineer risk features using only information available up to month ``t``
    (inclusive). ``t`` is a positional index into the sorted history."""
    h = hist.iloc[: t + 1]
    sector = SECTORS[h["sector"].iloc[0]]
    scale = float(max(1.0, h["income"].mean()))

    ncf = h["net_cashflow"].to_numpy(dtype=float)
    exp3 = float(h["expenses"].iloc[-3:].mean())
    cash = float(h["cash_balance"].iloc[-1])
    rep_due = float(h["repayment_due"].iloc[-3:].mean())
    upi = h["upi_txn_count"].to_numpy(dtype=float)

    cur_month = h["month"].iloc[-1].month
    trough_month = ((sector.peak_month + 6 - 1) % 12) + 1
    months_to_trough = (trough_month - cur_month) % 12

    return {
        "ncf_mean_3": float(ncf[-3:].mean()) / scale,
        "ncf_trend_6": _slope(ncf[-6:]) / scale,
        "ncf_volatility_6": float(ncf[-6:].std()) / scale,
        "runway_months": cash / max(1.0, exp3),
        "repayment_coverage": float(ncf[-3:].mean()) / max(1.0, rep_due),
        "savings_ratio": float(h["savings"].iloc[-1]) / scale,
        "upi_trend_3": (float(upi[-3:].mean()) - float(upi[-6:-3].mean())) / max(1.0, float(upi[-6:-3].mean())) if len(upi) >= 6 else 0.0,
        "input_cost_recent": float(h["d_input_cost"].iloc[-3:].mean()),
        "demand_recent": float(h["d_demand"].iloc[-3:].mean()),
        "weather_recent": float(h["d_weather"].iloc[-3:].mean()),
        "seasonal_low_proximity": 1.0 - months_to_trough / 6.0 if months_to_trough <= 6 else 0.0,
        "sector_shock_exposure": max(sector.shock_exposure.values()),
    }


def stress_label(hist: pd.DataFrame, t: int, look_ahead: int = 3) -> int | None:
    """1 if a financial-stress event occurs within the next ``look_ahead`` months.

    A stress event is any of: the cash buffer thinning below ~15% of monthly
    turnover, a month of negative net cash flow, or a loan-repayment shortfall.
    These are exactly the early-warning signals a field officer wants flagged
    *before* they turn into a default."""
    scale = float(max(1.0, hist["income"].iloc[: t + 1].mean()))
    fut = hist.iloc[t + 1: t + 1 + look_ahead]
    if len(fut) < look_ahead:
        return None
    thin_buffer = (fut["cash_balance"] < 0.15 * scale).any()
    negative_month = (fut["net_cashflow"] < 0).any()
    repay_short = ((fut["repayment_due"] > 0) &
                   (fut["repayment_made"] < 0.9 * fut["repayment_due"])).any()
    return int(bool(thin_buffer or negative_month or repay_short))


def build_training_table(histories: dict[str, pd.DataFrame],
                         min_history: int = 12) -> tuple[pd.DataFrame, np.ndarray]:
    rows, labels = [], []
    for ent_id, hist in histories.items():
        hist = hist.sort_values("month").reset_index(drop=True)
        for t in range(min_history, len(hist) - 3):
            label = stress_label(hist, t)
            if label is None:
                continue
            rows.append(risk_features_at(hist, t))
            labels.append(label)
    # Return a plain float matrix (column order == RISK_FEATURES) so training
    # and inference both operate on arrays -- no feature-name mismatch warnings.
    X = pd.DataFrame(rows)[RISK_FEATURES].to_numpy(dtype=float)
    return X, np.array(labels)


class RiskModel:
    def __init__(self, model: GradientBoostingClassifier, metrics: dict):
        self.model = model
        self.metrics = metrics

    def score(self, features: dict) -> float:
        x = np.array([[features[c] for c in RISK_FEATURES]])
        return float(self.model.predict_proba(x)[0, 1]) * 100.0

    def local_importance(self, features: dict) -> list[dict]:
        """Rank the features pushing this enterprise toward risk.

        Uses global feature importances weighted by how adverse each feature's
        current value is, to give a readable local explanation."""
        gi = self.model.feature_importances_
        adverse = {
            "ncf_mean_3": -1, "ncf_trend_6": -1, "ncf_volatility_6": +1,
            "runway_months": -1, "repayment_coverage": -1, "savings_ratio": -1,
            "upi_trend_3": -1, "input_cost_recent": +1, "demand_recent": -1,
            "weather_recent": -1, "seasonal_low_proximity": +1,
            "sector_shock_exposure": +1,
        }
        out = []
        for i, c in enumerate(RISK_FEATURES):
            val = features[c]
            # normalise adverse direction into a 0-1 "pressure"
            pressure = np.tanh(adverse[c] * val) if c not in ("runway_months", "repayment_coverage") else np.tanh(adverse[c] * (val - 1.5))
            score = float(gi[i]) * max(0.0, float(pressure))
            out.append({"feature": c, "label": RISK_FEATURE_LABELS[c], "weight": score})
        out.sort(key=lambda d: d["weight"], reverse=True)
        return out


def train_risk_model(histories: dict[str, pd.DataFrame], seed: int = 42) -> RiskModel:
    X, y = build_training_table(histories)
    if len(np.unique(y)) < 2:
        raise RuntimeError("Training labels are single-class; adjust generator.")
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=seed, stratify=y)
    model = GradientBoostingClassifier(
        n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.9,
        random_state=seed)
    model.fit(X_tr, y_tr)
    proba = model.predict_proba(X_te)[:, 1]
    metrics = {
        "auc": float(roc_auc_score(y_te, proba)),
        "accuracy": float(accuracy_score(y_te, (proba >= 0.5).astype(int))),
        "n_samples": int(len(y)),
        "positive_rate": float(y.mean()),
    }
    return RiskModel(model=model, metrics=metrics)


def risk_band(score: float) -> str:
    if score >= 55:
        return "High"
    if score >= 25:
        return "Watch"
    return "Low"


# --------------------------------------------------------------------------- #
# Credit-readiness scorecard (transparent, lender-readable)
# --------------------------------------------------------------------------- #

def credit_readiness(hist: pd.DataFrame) -> dict:
    hist = hist.sort_values("month")
    scale = float(max(1.0, hist["income"].mean()))
    ncf = hist["net_cashflow"].to_numpy(dtype=float)

    # 1) Cash-flow stability (lower volatility -> higher score) -- 25
    vol = float(ncf[-12:].std()) / scale
    stability = float(np.clip(1.0 - vol * 2.5, 0, 1) * 25)

    # 2) Repayment track record -- 30
    due = hist["repayment_due"].iloc[-12:].sum()
    made = hist["repayment_made"].iloc[-12:].sum()
    repayment = float((made / due if due > 0 else 0.85) * 30)
    repayment = min(repayment, 30.0)

    # 3) Surplus & growth trend -- 25
    surplus = float(np.clip(ncf[-6:].mean() / scale / 0.25, 0, 1) * 15)
    growth = float(np.clip(_slope(ncf[-12:]) / scale * 20 + 0.5, 0, 1) * 10)

    # 4) Digital footprint (UPI level + growth) -- 20
    upi = hist["upi_txn_count"].to_numpy(dtype=float)
    upi_level = float(np.clip(upi[-3:].mean() / 300.0, 0, 1) * 12)
    upi_growth = float(np.clip(_slope(upi[-12:]) / 5.0 + 0.5, 0, 1) * 8)

    components = {
        "cashflow_stability": round(stability, 1),
        "repayment_record": round(repayment, 1),
        "surplus_and_growth": round(surplus + growth, 1),
        "digital_footprint": round(upi_level + upi_growth, 1),
    }
    total = round(sum(components.values()), 1)
    band = "Credit-ready" if total >= 70 else ("Emerging" if total >= 45 else "Building")
    return {"score": total, "band": band, "components": components}
