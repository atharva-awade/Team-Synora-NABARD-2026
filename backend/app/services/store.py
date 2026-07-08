"""
In-memory store for trained artifacts and the simulated portfolio.

Loads once on first access. If the artifacts are missing (e.g. a fresh clone),
the training pipeline is run automatically so the API works out of the box.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"


class Store:
    def __init__(self, artifacts: dict, profiles: list[dict],
                 histories: dict[str, pd.DataFrame]):
        self.baselines = artifacts["baselines"]
        self.sector_models = artifacts["sector_models"]
        self.risk_model = artifacts["risk_model"]
        self.profiles = profiles
        self.profiles_by_id = {p["id"]: p for p in profiles}
        self.histories = histories

    def profile(self, ent_id: str) -> dict:
        if ent_id not in self.profiles_by_id:
            raise KeyError(ent_id)
        return self.profiles_by_id[ent_id]

    def history(self, ent_id: str) -> pd.DataFrame:
        return self.histories[ent_id]


def _ensure_artifacts() -> None:
    if not (MODELS_DIR / "artifacts.joblib").exists() or not (MODELS_DIR / "portfolio.json").exists():
        from ..ml.train import main as train_main
        train_main()


@lru_cache(maxsize=1)
def get_store() -> Store:
    _ensure_artifacts()
    artifacts = joblib.load(MODELS_DIR / "artifacts.joblib")
    payload = json.loads((MODELS_DIR / "portfolio.json").read_text(encoding="utf-8"))
    histories: dict[str, pd.DataFrame] = {}
    for ent_id, records in payload["histories"].items():
        df = pd.DataFrame(records)
        df["month"] = pd.to_datetime(df["month"])
        histories[ent_id] = df.sort_values("month").reset_index(drop=True)
    return Store(artifacts, payload["profiles"], histories)
