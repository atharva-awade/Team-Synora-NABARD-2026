"""
Synthetic, privacy-safe data generator for rural micro-enterprises.

Per the problem statement, Pravah must work on mock/simulated datasets that
represent financials *and* proxy indicators, and must never rely on sensitive
personal information. This module produces three aligned data layers:

  1. External driver signals  (sector + region level, not personal):
        output price, input cost, demand, weather-fit, productivity, UPI activity
     -- all expressed as normalised indices around 0.0 (== long-run average).

  2. Enterprise financial history (per enterprise, monthly):
        income, expenses, savings, loan balance, repayment due/made, cash balance
     plus UPI transaction *proxies* (counts and a normalised value index --
     never actual account values, keeping the data non-sensitive).

  3. Training tables for the forecasting and early-warning models.

Everything is deterministic given a seed so results are reproducible and the
demo is stable offline.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd

from ..sectors import SECTORS, SHOCKS, Sector


# --------------------------------------------------------------------------- #
# Enterprise roster (realistic, non-personal handles)
# --------------------------------------------------------------------------- #

_ENTERPRISE_NAMES = {
    "dairy": [
        "Godavari Dairy SHG", "Amrit Milk Producers", "Krishna Valley Dairy",
        "Sahyadri Doodh Sangh", "Gokul Dairy Collective",
    ],
    "poultry": [
        "Surya Poultry Farm", "Green Egg Producers", "Annapurna Layer Unit",
        "Vindhya Broiler Group", "Sunrise Poultry SHG",
    ],
    "food_processing": [
        "Maa Annapurna Foods", "Sahyadri Spice Works", "Gramin Masala Udyog",
        "Konkan Pickle Collective", "Ganga Millet Foods",
    ],
    "handicrafts": [
        "Kala Kendra Weavers", "Terracotta Artisan SHG", "Warli Craft Collective",
        "Banaras Handloom Group", "Bamboo Craft Cluster",
    ],
    "rural_retail": [
        "Jai Kisan Stores", "Grameen Bazaar", "Shivam General Store",
        "Nandini Kirana Mart", "Ekta Retail SHG",
    ],
}

_DISTRICTS = [
    ("Ahmednagar", "Maharashtra"), ("Kolhapur", "Maharashtra"),
    ("Nashik", "Maharashtra"), ("Warangal", "Telangana"),
    ("Mysuru", "Karnataka"), ("Nadia", "West Bengal"),
    ("Barabanki", "Uttar Pradesh"), ("Rajkot", "Gujarat"),
    ("Bhilwara", "Rajasthan"), ("Krishna", "Andhra Pradesh"),
]

_ORG_TYPES = ["SHG", "FPO", "Individual"]


@dataclass
class EnterpriseProfile:
    id: str
    name: str
    sector: str
    district: str
    state: str
    org_type: str
    size_factor: float          # scales the sector baseline turnover
    established_year: int
    has_loan: bool
    loan_amount: float
    emi: float


# --------------------------------------------------------------------------- #
# Signal construction helpers
# --------------------------------------------------------------------------- #

def _month_index(start: str, n: int) -> pd.DatetimeIndex:
    return pd.date_range(start=start, periods=n, freq="MS")


def _seasonal(months: np.ndarray, peak_month: int, amplitude: float,
              secondary_peak: int | None) -> np.ndarray:
    """Smooth seasonal multiplier deviation (mean 0) using a cosine peaking at
    ``peak_month``, optionally blended with a secondary peak."""
    phase = 2 * np.pi * (months - peak_month) / 12.0
    wave = np.cos(phase)
    if secondary_peak is not None:
        phase2 = 2 * np.pi * (months - secondary_peak) / 12.0
        wave = 0.7 * wave + 0.3 * np.cos(phase2)
    return amplitude * wave


def _ar1(n: int, rho: float, sigma: float, rng: np.random.Generator) -> np.ndarray:
    """Auto-correlated noise so signals drift realistically rather than jump."""
    out = np.zeros(n)
    eps = rng.normal(0, sigma, n)
    for t in range(1, n):
        out[t] = rho * out[t - 1] + eps[t]
    return out


def generate_driver_signals(sector: Sector, n_months: int, start: str,
                            rng: np.random.Generator,
                            inject_shocks: bool = True) -> pd.DataFrame:
    """Sector/region-level driver indices, normalised around 0.0.

    Returns a DataFrame indexed by month with columns:
    output_price, input_cost, demand, weather, productivity, upi_activity,
    plus a per-month ``active_shock`` label ("" when none).
    """
    idx = _month_index(start, n_months)
    months = idx.month.to_numpy()

    df = pd.DataFrame(index=idx)
    # Each driver = mild seasonal tilt + auto-correlated drift.
    df["output_price"] = _seasonal(months, sector.peak_month, 0.05, None) + _ar1(n_months, 0.80, 0.05, rng)
    df["input_cost"] = _seasonal(months, 6, 0.06, None) + _ar1(n_months, 0.85, 0.05, rng)  # inputs costlier mid-year
    df["demand"] = _seasonal(months, sector.peak_month, 0.10, sector.secondary_peak_month) + _ar1(n_months, 0.75, 0.05, rng)
    df["weather"] = _seasonal(months, 8, 0.08, 1) + _ar1(n_months, 0.70, 0.06, rng)         # monsoon-centred fit
    df["productivity"] = _seasonal(months, sector.peak_month, 0.05, None) + _ar1(n_months, 0.80, 0.04, rng)
    df["upi_activity"] = _seasonal(months, sector.peak_month, 0.08, sector.secondary_peak_month) + _ar1(n_months, 0.78, 0.05, rng)
    # UPI adoption grows over time -> gentle upward trend (digital rural economy)
    df["upi_activity"] = df["upi_activity"] + np.linspace(0, 0.20, n_months)

    df["active_shock"] = ""

    if inject_shocks and n_months >= 12:
        eligible = list(sector.shock_exposure.keys())
        n_shocks = rng.integers(2, 4)  # 2-3 shock episodes across the horizon
        for j in range(int(n_shocks)):
            shock = eligible[rng.integers(0, len(eligible))]
            driver = SHOCKS[shock]["driver"]
            severity = float(sector.shock_exposure[shock]) * rng.uniform(0.5, 0.85)
            duration = int(rng.integers(2, 5))
            # Bias the final shock toward the recent tail so the current-month
            # risk snapshot has a realistic mix of stressed enterprises.
            if j == n_shocks - 1 and rng.random() < 0.6:
                start_t = int(rng.integers(max(6, n_months - 7), max(7, n_months - duration)))
            else:
                start_t = int(rng.integers(6, max(7, n_months - duration - 3)))
            # A cost/negative-demand shock pushes the relevant driver adversely.
            sign = 1.0 if driver == "input_cost" else -1.0
            for k in range(duration):
                t = start_t + k
                if t < n_months:
                    df.iloc[t, df.columns.get_loc(driver)] += sign * severity
                    df.iloc[t, df.columns.get_loc("active_shock")] = shock

    # Keep indices in a sane band.
    for col in ["output_price", "input_cost", "demand", "weather", "productivity", "upi_activity"]:
        df[col] = df[col].clip(-0.5, 0.7)
    return df


# --------------------------------------------------------------------------- #
# Enterprise history
# --------------------------------------------------------------------------- #

def generate_enterprise_history(profile: EnterpriseProfile, drivers: pd.DataFrame,
                                rng: np.random.Generator) -> pd.DataFrame:
    """Monthly financial + proxy history for one enterprise, driven by the
    sector signals so the relationships are learnable by the models."""
    sector = SECTORS[profile.sector]
    s = sector.driver_sensitivity
    n = len(drivers)
    months = drivers.index.month.to_numpy()
    R = sector.base_revenue * profile.size_factor

    seasonal = 1.0 + _seasonal(months, sector.peak_month, sector.seasonal_amplitude,
                               sector.secondary_peak_month)

    # Favourable revenue deviation from driver signals.
    rev_dev = (drivers["output_price"] * s.output_price
               + drivers["demand"] * s.demand
               + drivers["productivity"] * s.productivity
               + drivers["upi_activity"] * s.upi_activity
               + drivers["weather"] * s.weather).to_numpy()
    # Idiosyncratic noise is kept modest: in rural micro-enterprises the bulk of
    # cash-flow variation beyond seasonality genuinely comes from the observable
    # driver signals (prices, demand, weather, digital activity). Keeping the
    # signal dominant is both realistic and what makes the forecast learnable.
    rev_noise = rng.normal(0, 0.035, n)
    income = R * seasonal * (1.0 + rev_dev + rev_noise)
    income = np.clip(income, 0.15 * R, None)

    # Cost rises with input-cost index; better productivity trims unit cost.
    cost_dev = (drivers["input_cost"] * abs(s.input_cost)
                - drivers["productivity"] * 0.3 * s.productivity).to_numpy()
    cost_noise = rng.normal(0, 0.025, n)
    fixed_cost = 0.08 * R
    expenses = R * seasonal * sector.cost_ratio * (1.0 + cost_dev + cost_noise) + fixed_cost
    expenses = np.clip(expenses, 0.1 * R, None)

    net_operating = income - expenses

    # Loan / repayment behaviour.
    emi = profile.emi
    repayment_due = np.full(n, emi if profile.has_loan else 0.0)
    loan_out = np.zeros(n)
    repayment_made = np.zeros(n)
    outstanding = profile.loan_amount if profile.has_loan else 0.0

    # Savings + running cash balance.
    savings = np.zeros(n)
    balance = np.zeros(n)
    cash = 0.25 * R  # opening buffer
    acc_savings = 0.5 * R

    for t in range(n):
        cash += net_operating[t]
        pay = 0.0
        if profile.has_loan and outstanding > 0:
            pay = min(emi, max(0.0, cash))          # pay EMI if cash allows
            cash -= pay
            outstanding = max(0.0, outstanding - pay * 0.75)  # part interest
        repayment_made[t] = pay
        loan_out[t] = outstanding
        # Sweep a slice of positive cash into savings; draw down when short.
        if cash > 0.3 * R:
            moved = 0.3 * (cash - 0.3 * R)
            acc_savings += moved
            cash -= moved
        elif cash < 0.05 * R and acc_savings > 0:
            drawn = min(acc_savings, 0.1 * R)
            acc_savings -= drawn
            cash += drawn
        savings[t] = acc_savings
        balance[t] = cash

    # UPI proxies (anonymised indices + counts, never actual values).
    base_txn = 60 + 220 * profile.size_factor
    upi_count = (base_txn * seasonal * (1 + 0.6 * drivers["upi_activity"].to_numpy())
                 + rng.normal(0, 8, n)).clip(5, None).round().astype(int)
    upi_value_index = (1.0 + drivers["upi_activity"].to_numpy()
                       + 0.5 * (seasonal - 1.0) + rng.normal(0, 0.05, n)).clip(0.2, None)

    hist = pd.DataFrame({
        "month": drivers.index,
        "income": income.round(0),
        "expenses": expenses.round(0),
        "net_cashflow": net_operating.round(0),
        "savings": savings.round(0),
        "loan_outstanding": loan_out.round(0),
        "repayment_due": repayment_due.round(0),
        "repayment_made": repayment_made.round(0),
        "cash_balance": balance.round(0),
        "upi_txn_count": upi_count,
        "upi_value_index": upi_value_index.round(3),
        # carry the driver context so the model + explanations can use it
        "d_output_price": drivers["output_price"].to_numpy().round(3),
        "d_input_cost": drivers["input_cost"].to_numpy().round(3),
        "d_demand": drivers["demand"].to_numpy().round(3),
        "d_weather": drivers["weather"].to_numpy().round(3),
        "d_productivity": drivers["productivity"].to_numpy().round(3),
        "d_upi_activity": drivers["upi_activity"].to_numpy().round(3),
        "active_shock": drivers["active_shock"].to_numpy(),
    })
    hist["enterprise_id"] = profile.id
    hist["sector"] = profile.sector
    return hist


# --------------------------------------------------------------------------- #
# Portfolio generation
# --------------------------------------------------------------------------- #

def _make_profiles(rng: np.random.Generator) -> list[EnterpriseProfile]:
    profiles: list[EnterpriseProfile] = []
    counter = 1
    for sector_key, names in _ENTERPRISE_NAMES.items():
        for name in names:
            district, state = _DISTRICTS[rng.integers(0, len(_DISTRICTS))]
            org_type = _ORG_TYPES[rng.integers(0, len(_ORG_TYPES))]
            size_factor = float(np.round(rng.uniform(0.6, 1.8), 2))
            has_loan = bool(rng.random() < 0.7)
            loan_amount = float(np.round(rng.uniform(40000, 250000), -3)) if has_loan else 0.0
            emi = float(np.round(loan_amount / rng.integers(18, 36), -2)) if has_loan else 0.0
            profiles.append(EnterpriseProfile(
                id=f"ENT{counter:03d}",
                name=name,
                sector=sector_key,
                district=district,
                state=state,
                org_type=org_type,
                size_factor=size_factor,
                established_year=int(rng.integers(2012, 2023)),
                has_loan=has_loan,
                loan_amount=loan_amount,
                emi=emi,
            ))
            counter += 1
    return profiles


def generate_portfolio(history_months: int = 36, start: str = "2023-07-01",
                       seed: int = 123):
    """Generate the full demo portfolio.

    Returns (profiles, histories, drivers_by_sector) where:
      - profiles: list[EnterpriseProfile]
      - histories: dict[enterprise_id -> monthly DataFrame]
      - drivers_by_sector: dict[sector_key -> driver DataFrame]
    """
    rng = np.random.default_rng(seed)
    profiles = _make_profiles(rng)

    # One shared driver realisation per sector (region-level signal).
    drivers_by_sector: dict[str, pd.DataFrame] = {}
    for sector_key, sector in SECTORS.items():
        drivers_by_sector[sector_key] = generate_driver_signals(
            sector, history_months, start, rng, inject_shocks=True)

    histories: dict[str, pd.DataFrame] = {}
    for p in profiles:
        # Give each enterprise a slightly idiosyncratic driver view.
        base = drivers_by_sector[p.sector].copy()
        jitter = generate_driver_signals(SECTORS[p.sector], history_months, start,
                                         rng, inject_shocks=False)
        for col in ["output_price", "input_cost", "demand", "weather",
                    "productivity", "upi_activity"]:
            base[col] = 0.7 * base[col] + 0.3 * jitter[col]
        histories[p.id] = generate_enterprise_history(p, base, rng)

    return profiles, histories, drivers_by_sector


def profiles_to_frame(profiles: list[EnterpriseProfile]) -> pd.DataFrame:
    return pd.DataFrame([asdict(p) for p in profiles])


if __name__ == "__main__":
    profiles, histories, drivers = generate_portfolio()
    print(f"Generated {len(profiles)} enterprises across {len(drivers)} sectors")
    sample = histories[profiles[0].id]
    print(f"\nSample history for {profiles[0].name} ({profiles[0].sector}):")
    print(sample[["month", "income", "expenses", "net_cashflow",
                  "cash_balance", "upi_txn_count", "active_shock"]].tail(6).to_string(index=False))
