"""
Analysis service: composes the trained models into the rich, explainable
responses the two personas (enterprise owner, field officer) consume.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..sectors import SECTORS, SHOCKS
from ..ml.forecast_model import (
    forecast_enterprise, DRIVER_COLS, DRIVER_LABELS,
)
from ..ml.risk_model import (
    risk_features_at, risk_band, credit_readiness,
)
from .store import Store


# --------------------------------------------------------------------------- #
# Financial vital signs
# --------------------------------------------------------------------------- #

def _vitals(hist: pd.DataFrame) -> dict:
    ncf = hist["net_cashflow"].to_numpy(dtype=float)
    exp3 = float(hist["expenses"].iloc[-3:].mean())
    cash = float(hist["cash_balance"].iloc[-1])
    emi = float(hist["repayment_due"].iloc[-1])
    runway = cash / max(1.0, exp3)
    vol = float(np.std(ncf[-6:]) / max(1.0, np.abs(np.mean(ncf[-6:])))) if len(ncf) >= 6 else 0.0
    repay_cap = float(np.mean(ncf[-3:]) / emi) if emi > 0 else None
    return {
        "liquidity_runway_months": round(runway, 1),
        "income_volatility": round(min(vol, 3.0), 2),
        "repayment_capacity": round(repay_cap, 2) if repay_cap is not None else None,
        "current_cash_balance": round(cash, 0),
        "avg_monthly_income": round(float(hist["income"].iloc[-6:].mean()), 0),
        "avg_monthly_net_cashflow": round(float(np.mean(ncf[-6:])), 0),
        "savings": round(float(hist["savings"].iloc[-1]), 0),
        "loan_outstanding": round(float(hist["loan_outstanding"].iloc[-1]), 0),
    }


# --------------------------------------------------------------------------- #
# Action playbook
# --------------------------------------------------------------------------- #

def _dominant_adverse_driver(forecast: list) -> str | None:
    totals: dict[str, float] = {c: 0.0 for c in DRIVER_COLS}
    for m in forecast:
        for c, v in m.contributions.items():
            totals[c] += v
    worst = min(totals, key=lambda c: totals[c])
    return worst if totals[worst] < 0 else None


def _recommend_actions(profile: dict, hist: pd.DataFrame, forecast: list,
                       vitals: dict, risk_score: float) -> list[dict]:
    sector = SECTORS[profile["sector"]]
    actions: list[dict] = []

    driver = _dominant_adverse_driver(forecast)
    if driver:
        # Find the sector shock whose driver matches, to pull its playbook line.
        for shock_key, meta in SHOCKS.items():
            if meta["driver"] == driver and shock_key in sector.playbook:
                actions.append({
                    "title": f"Act on {DRIVER_LABELS[driver].lower()} pressure",
                    "detail": sector.playbook[shock_key],
                    "urgency": "high" if risk_score >= 55 else "medium",
                    "factor": DRIVER_LABELS[driver],
                })
                break

    if vitals["liquidity_runway_months"] < 1.5 and "liquidity" in sector.playbook:
        actions.append({
            "title": "Protect your cash runway",
            "detail": sector.playbook["liquidity"],
            "urgency": "high",
            "factor": "Liquidity",
        })

    if not actions:
        actions.append({
            "title": "Stay the course",
            "detail": "Cash flow looks stable over the forecast horizon. Keep "
                      "recording income and expenses so early warnings stay accurate.",
            "urgency": "low",
            "factor": "Stable",
        })
    return actions


# --------------------------------------------------------------------------- #
# Risk assessment (with optional what-if driver shocks)
# --------------------------------------------------------------------------- #

def _assess_risk(store: Store, hist: pd.DataFrame,
                 forecast: list, base_forecast: list) -> dict:
    """Risk from the trained classifier on the enterprise's real features.

    Under a what-if scenario we do NOT nudge classifier inputs out of
    distribution (trees respond unreliably there). Instead we add a penalty
    derived from how much the *forecast itself* deteriorates versus the no-shock
    baseline -- so a worse shock always yields a worse, forecast-consistent
    risk, and an empty scenario reproduces the baseline score exactly.
    """
    features = risk_features_at(hist, len(hist) - 1)
    base_score = store.risk_model.score(features)
    score = base_score

    shocked = forecast is not base_forecast
    if shocked:
        scale = float(max(1.0, hist["income"].mean()))
        base_sum = sum(m.predicted_net_cashflow for m in base_forecast)
        shk_sum = sum(m.predicted_net_cashflow for m in forecast)
        base_neg = sum(1 for m in base_forecast if m.predicted_net_cashflow < 0)
        shk_neg = sum(1 for m in forecast if m.predicted_net_cashflow < 0)
        deterioration = max(0.0, base_sum - shk_sum) / (abs(base_sum) + scale)
        penalty = min(60.0, deterioration * 120.0) + 6.0 * max(0, shk_neg - base_neg)
        score = min(99.0, base_score + penalty)

    top = store.risk_model.local_importance(features)[:4]
    return {
        "score": round(score, 1),
        "band": risk_band(score),
        "baseline_score": round(base_score, 1),
        "top_factors": [
            {"label": t["label"], "weight": round(t["weight"], 3)}
            for t in top if t["weight"] > 0
        ],
    }


# --------------------------------------------------------------------------- #
# History serialisation for charts
# --------------------------------------------------------------------------- #

def _history_records(hist: pd.DataFrame, months: int = 24) -> list[dict]:
    cols = ["month", "income", "expenses", "net_cashflow", "cash_balance",
            "savings", "loan_outstanding", "upi_txn_count", "active_shock"]
    tail = hist[cols].tail(months).copy()
    tail["month"] = tail["month"].dt.strftime("%Y-%m")
    return tail.to_dict(orient="records")


def _forecast_records(forecast: list) -> list[dict]:
    out = []
    for m in forecast:
        out.append({
            "month": m.month,
            "predicted_net_cashflow": m.predicted_net_cashflow,
            "baseline": m.baseline,
            "driver_adjustment": m.driver_adjustment,
            "lower": m.lower,
            "upper": m.upper,
            "contributions": [
                {"driver": DRIVER_LABELS[c], "key": c, "value": v}
                for c, v in sorted(m.contributions.items(), key=lambda kv: kv[1])
            ],
            "active_shocks": m.active_shocks,
        })
    return out


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def enterprise_detail(store: Store, ent_id: str,
                      shocks: dict[str, float] | None = None,
                      horizon: int = 6) -> dict:
    profile = store.profile(ent_id)
    hist = store.history(ent_id)
    baseline = store.baselines[ent_id]
    sector_model = store.sector_models[profile["sector"]]

    forecast = forecast_enterprise(hist, baseline, sector_model,
                                   horizon=horizon, shocks=shocks)
    base_forecast = (forecast if not shocks else
                     forecast_enterprise(hist, baseline, sector_model, horizon=horizon))
    vitals = _vitals(hist)
    risk = _assess_risk(store, hist, forecast, base_forecast)
    credit = credit_readiness(hist)
    actions = _recommend_actions(profile, hist, forecast, vitals, risk["score"])

    sector = SECTORS[profile["sector"]]
    return {
        "profile": {
            **profile,
            "sector_label": sector.label,
            "sector_emoji": sector.emoji,
        },
        "vitals": vitals,
        "history": _history_records(hist),
        "forecast": _forecast_records(forecast),
        "risk": risk,
        "credit_readiness": credit,
        "actions": actions,
        "horizon_months": horizon,
        "what_if_applied": bool(shocks),
    }


def portfolio_summary(store: Store) -> dict:
    cards = []
    band_counts = {"Low": 0, "Watch": 0, "High": 0}
    sector_counts: dict[str, int] = {}
    readiness_vals = []

    for p in store.profiles:
        hist = store.history(p["id"])
        baseline = store.baselines[p["id"]]
        sector_model = store.sector_models[p["sector"]]
        forecast = forecast_enterprise(hist, baseline, sector_model, horizon=3)
        risk = _assess_risk(store, hist, forecast, forecast)
        credit = credit_readiness(hist)
        vitals = _vitals(hist)
        band_counts[risk["band"]] += 1
        sector_counts[p["sector"]] = sector_counts.get(p["sector"], 0) + 1
        readiness_vals.append(credit["score"])
        next_ncf = forecast[0].predicted_net_cashflow
        cards.append({
            "id": p["id"],
            "name": p["name"],
            "sector": p["sector"],
            "sector_label": SECTORS[p["sector"]].label,
            "sector_emoji": SECTORS[p["sector"]].emoji,
            "district": p["district"],
            "state": p["state"],
            "org_type": p["org_type"],
            "risk_score": risk["score"],
            "risk_band": risk["band"],
            "credit_readiness": credit["score"],
            "credit_band": credit["band"],
            "next_month_net_cashflow": next_ncf,
            "avg_net_cashflow": vitals["avg_monthly_net_cashflow"],
            "runway_months": vitals["liquidity_runway_months"],
            "top_factor": (risk["top_factors"][0]["label"] if risk["top_factors"] else None),
        })

    cards.sort(key=lambda c: c["risk_score"], reverse=True)
    return {
        "enterprises": cards,
        "summary": {
            "total": len(cards),
            "band_counts": band_counts,
            "sector_counts": {SECTORS[k].label: v for k, v in sector_counts.items()},
            "avg_credit_readiness": round(float(np.mean(readiness_vals)), 1),
            "credit_ready_count": int(sum(1 for v in readiness_vals if v >= 70)),
            "at_risk_count": band_counts["High"] + band_counts["Watch"],
        },
    }


def sector_options() -> list[dict]:
    return [
        {"key": s.key, "label": s.label, "emoji": s.emoji,
         "shocks": [{"key": k, "label": SHOCKS[k]["label"], "icon": SHOCKS[k]["icon"],
                     "driver": SHOCKS[k]["driver"]}
                    for k in s.shock_exposure]}
        for s in SECTORS.values()
    ]


def driver_catalog() -> list[dict]:
    return [{"key": c, "label": DRIVER_LABELS[c]} for c in DRIVER_COLS]
