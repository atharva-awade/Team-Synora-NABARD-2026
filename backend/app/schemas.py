"""Pydantic request/response models for the Pravah API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WhatIfRequest(BaseModel):
    """Driver shock deltas for the what-if scenario simulator.

    Keys are driver columns (e.g. "d_input_cost", "d_weather") and values are
    additive deltas on the normalised driver index (e.g. +0.30 = input costs
    30% above the seasonal norm across the horizon).
    """
    shocks: dict[str, float] = Field(default_factory=dict)
    horizon: int = Field(default=6, ge=1, le=6)


class MonthlyEntry(BaseModel):
    """A month of self-reported data from a micro-enterprise owner."""
    income: float = Field(ge=0)
    expenses: float = Field(ge=0)
    savings: float = Field(default=0, ge=0)
    repayment_made: float = Field(default=0, ge=0)
    upi_txn_count: int = Field(default=0, ge=0)


class SimulateRequest(BaseModel):
    """Append recent self-reported months and recompute the outlook."""
    entries: list[MonthlyEntry] = Field(default_factory=list)
    horizon: int = Field(default=6, ge=1, le=6)
