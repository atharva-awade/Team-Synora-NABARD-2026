"""API routes for Pravah."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException

from ..schemas import WhatIfRequest, SimulateRequest
from ..services.store import get_store
from ..services import analysis

router = APIRouter(prefix="/api")

_METRICS_PATH = Path(__file__).resolve().parents[2] / "models" / "metrics.json"


@router.get("/health")
def health():
    return {"status": "ok", "service": "pravah-api"}


@router.get("/metrics")
def metrics():
    if _METRICS_PATH.exists():
        return json.loads(_METRICS_PATH.read_text(encoding="utf-8"))
    return {}


@router.get("/meta")
def meta():
    """Config for the frontend: sectors, drivers, model metrics."""
    payload = {
        "sectors": analysis.sector_options(),
        "drivers": analysis.driver_catalog(),
        "metrics": metrics(),
    }
    return payload


@router.get("/portfolio")
def portfolio():
    return analysis.portfolio_summary(get_store())


@router.get("/enterprises/{ent_id}")
def enterprise(ent_id: str, horizon: int = 6):
    try:
        return analysis.enterprise_detail(get_store(), ent_id, horizon=horizon)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Enterprise {ent_id} not found")


@router.post("/enterprises/{ent_id}/whatif")
def whatif(ent_id: str, req: WhatIfRequest):
    try:
        return analysis.enterprise_detail(
            get_store(), ent_id, shocks=req.shocks, horizon=req.horizon)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Enterprise {ent_id} not found")


@router.post("/enterprises/{ent_id}/simulate")
def simulate(ent_id: str, req: SimulateRequest):
    """Append self-reported months to the history and recompute the outlook.

    Stateless: the appended data lives only for the duration of the request, so
    an enterprise owner can preview how new figures move their forecast/risk.
    """
    store = get_store()
    try:
        profile = store.profile(ent_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Enterprise {ent_id} not found")

    if not req.entries:
        return analysis.enterprise_detail(store, ent_id, horizon=req.horizon)

    hist = store.history(ent_id).copy()
    last_month = hist["month"].iloc[-1]
    new_rows = []
    for i, e in enumerate(req.entries, start=1):
        month = last_month + pd.DateOffset(months=i)
        template = hist.iloc[-1].copy()
        template["month"] = month
        template["income"] = e.income
        template["expenses"] = e.expenses
        template["net_cashflow"] = e.income - e.expenses
        template["savings"] = e.savings or template["savings"]
        template["repayment_made"] = e.repayment_made
        template["cash_balance"] = float(hist["cash_balance"].iloc[-1]) + (e.income - e.expenses) - e.repayment_made
        template["upi_txn_count"] = e.upi_txn_count or template["upi_txn_count"]
        new_rows.append(template)
        hist = pd.concat([hist, pd.DataFrame([template])], ignore_index=True)

    # Temporarily swap in the extended history for the computation.
    original = store.histories[ent_id]
    store.histories[ent_id] = hist
    from ..ml.forecast_model import fit_baseline
    original_baseline = store.baselines[ent_id]
    store.baselines[ent_id] = fit_baseline(hist)
    try:
        detail = analysis.enterprise_detail(store, ent_id, horizon=req.horizon)
    finally:
        store.histories[ent_id] = original
        store.baselines[ent_id] = original_baseline
    return detail
