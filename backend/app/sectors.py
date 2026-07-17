"""
Sector "digital twins" for rural micro-enterprises.

Each sector carries its own economic signature: baseline turnover, cost
structure, seasonal rhythm, sensitivity to external driver signals, and the
shocks it is most exposed to. These parameters are grounded in well-known
patterns of the Indian rural economy (e.g. dairy yields dip in peak summer,
handicraft demand peaks across the Oct-Feb festival/wedding season, poultry is
highly exposed to feed-grain price swings and heat stress).

The values are deliberately expressed as interpretable coefficients so that a
forecast can always be decomposed back into "why", the core of Pravah's
explainable-by-default design.

Months are 1-12 (Jan-Dec). Seasonal phase is expressed as the peak month.
All monetary values are in INR and represent a *typical* micro-enterprise;
the data generator scales them per enterprise.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DriverSensitivity:
    """How strongly a unit change in a normalised driver index moves monthly
    net cash flow, expressed as a fraction of baseline monthly revenue.

    A driver index is normalised so that 0.0 == long-run average. A value of
    +0.10 on ``output_price`` means output prices are 10% above their norm.
    ``coef`` is the rupee impact per +1.0 (i.e. +100%) move, so the realised
    impact is ``coef * baseline_revenue * index``.
    """

    output_price: float = 0.0   # selling price of what the enterprise produces
    input_cost: float = 0.0     # cost of feed / raw material (negative effect)
    demand: float = 0.0         # market demand / offtake
    weather: float = 0.0        # favourable-weather index (rain/temperature fit)
    productivity: float = 0.0   # yield / output per unit (crop, milk, birds)
    upi_activity: float = 0.0   # digital transaction velocity proxy for sales


@dataclass(frozen=True)
class Sector:
    key: str
    label: str
    emoji: str
    # Typical monthly turnover band for a micro-enterprise in this sector (INR)
    base_revenue: float
    # Operating cost as a fraction of revenue (structural margin signature)
    cost_ratio: float
    # Seasonal amplitude as a fraction of baseline revenue (0.15 => +/-15%)
    seasonal_amplitude: float
    # Month (1-12) at which demand/turnover naturally peaks
    peak_month: int
    # A secondary seasonal peak, if the sector has a bimodal cycle (else None)
    secondary_peak_month: int | None
    # Month-to-month volatility of net cash flow (fraction of baseline)
    volatility: float
    driver_sensitivity: DriverSensitivity
    # Named shocks this sector is most vulnerable to, with a 0-1 exposure weight
    shock_exposure: dict[str, float] = field(default_factory=dict)
    # Plain-language corrective playbook keyed by the dominant risk factor
    playbook: dict[str, str] = field(default_factory=dict)


SECTORS: dict[str, Sector] = {
    "dairy": Sector(
        key="dairy",
        label="Dairy",
        emoji="🐄",
        base_revenue=42000,
        cost_ratio=0.68,
        seasonal_amplitude=0.18,
        peak_month=12,               # winter flush: higher yield & fat content
        secondary_peak_month=1,
        volatility=0.12,
        driver_sensitivity=DriverSensitivity(
            output_price=0.55,       # procurement price is the biggest lever
            input_cost=-0.42,        # cattle feed / fodder cost
            demand=0.20,
            weather=0.25,            # heat stress cuts yield sharply
            productivity=0.35,       # milk yield per animal
            upi_activity=0.15,
        ),
        shock_exposure={
            "feed_price_spike": 0.80,
            "monsoon_delay": 0.55,
            "heat_wave": 0.65,
            "milk_price_crash": 0.70,
        },
        playbook={
            "feed_price_spike": "Book 4-6 weeks of fodder now via the FPO bulk-purchase rate before prices climb further; shift 10-15% ration to cheaper agro by-products.",
            "monsoon_delay": "Arrange green-fodder alternatives and water storage early; a delayed monsoon typically raises feed cost 2-3 months out.",
            "milk_price_crash": "Divert surplus to value-added (paneer/ghee) via the local cooperative to protect margin during the price dip.",
            "liquidity": "Request a short working-capital top-up now while cash-flow score is healthy, rather than during the lean months ahead.",
        },
    ),
    "poultry": Sector(
        key="poultry",
        label="Poultry",
        emoji="🐔",
        base_revenue=58000,
        cost_ratio=0.74,             # feed is ~70% of cost -> thin margins
        seasonal_amplitude=0.22,
        peak_month=11,               # festive + winter demand for eggs/broiler
        secondary_peak_month=1,
        volatility=0.18,
        driver_sensitivity=DriverSensitivity(
            output_price=0.50,
            input_cost=-0.60,        # maize/soy feed dominates cost
            demand=0.35,
            weather=0.30,            # summer heat mortality
            productivity=0.30,
            upi_activity=0.18,
        ),
        shock_exposure={
            "feed_price_spike": 0.90,
            "heat_wave": 0.70,
            "disease_outbreak": 0.60,
            "demand_slump": 0.55,
        },
        playbook={
            "feed_price_spike": "Lock a bulk maize/soy contract through the producer group; feed is ~70% of your cost, so a small hedge protects the whole month.",
            "heat_wave": "Invest early in shed cooling/ventilation before peak summer to cut bird mortality and protect projected income.",
            "demand_slump": "Pre-book festival orders with local retailers to smooth the demand dip; consider staggered batch placement.",
            "liquidity": "Stagger new chick placement to match the cash runway; avoid a full batch when the buffer is under one month.",
        },
    ),
    "food_processing": Sector(
        key="food_processing",
        label="Food Processing",
        emoji="🫙",
        base_revenue=75000,
        cost_ratio=0.66,
        seasonal_amplitude=0.20,
        peak_month=10,               # festival season packaged-food demand
        secondary_peak_month=3,
        volatility=0.14,
        driver_sensitivity=DriverSensitivity(
            output_price=0.35,
            input_cost=-0.50,        # agri raw-material commodity prices
            demand=0.45,             # highly demand-led
            weather=0.10,
            productivity=0.20,
            upi_activity=0.25,
        ),
        shock_exposure={
            "commodity_price_spike": 0.75,
            "demand_slump": 0.60,
            "market_disruption": 0.55,
        },
        playbook={
            "commodity_price_spike": "Procure and store shelf-stable raw material at current rates ahead of the festival run-up; renegotiate MRP with buyers.",
            "demand_slump": "Push pre-festival institutional/bulk orders and diversify SKUs to steady offtake.",
            "market_disruption": "Line up an alternate mandi/aggregator channel to avoid a single-market dependency.",
            "liquidity": "Time raw-material purchases to the demand peak so working capital is not locked in slow months.",
        },
    ),
    "handicrafts": Sector(
        key="handicrafts",
        label="Handicrafts",
        emoji="🧶",
        base_revenue=31000,
        cost_ratio=0.55,             # labour-heavy, lower material margin
        seasonal_amplitude=0.35,     # strongly festival/wedding driven
        peak_month=10,               # Oct-Feb festive & wedding season
        secondary_peak_month=12,
        volatility=0.20,
        driver_sensitivity=DriverSensitivity(
            output_price=0.30,
            input_cost=-0.30,
            demand=0.60,             # demand is everything for artisans
            weather=0.05,
            productivity=0.15,
            upi_activity=0.35,       # online/tourist sales proxy
        ),
        shock_exposure={
            "demand_slump": 0.80,
            "market_disruption": 0.65,
            "raw_material_spike": 0.45,
        },
        playbook={
            "demand_slump": "Open a digital storefront / ONDC listing ahead of the festive window; artisan demand swings hardest, so widen the channel early.",
            "market_disruption": "Build inventory during lean months to fulfil the Oct-Feb peak without a cash crunch.",
            "raw_material_spike": "Pool raw-material purchases through the SHG cluster to hold input costs down.",
            "liquidity": "Use lean-season working capital to pre-build festive stock; the peak repays it within the cycle.",
        },
    ),
    "rural_retail": Sector(
        key="rural_retail",
        label="Rural Retail (Kirana)",
        emoji="🏪",
        base_revenue=90000,
        cost_ratio=0.82,             # retail: high turnover, thin margin
        seasonal_amplitude=0.15,
        peak_month=10,               # festival + post-harvest rural spending
        secondary_peak_month=4,      # post-rabi harvest liquidity
        volatility=0.10,
        driver_sensitivity=DriverSensitivity(
            output_price=0.20,
            input_cost=-0.35,        # wholesale purchase price
            demand=0.40,
            weather=0.15,            # harvest quality drives rural purchasing power
            productivity=0.10,
            upi_activity=0.45,       # UPI velocity is the strongest sales proxy
        ),
        shock_exposure={
            "market_disruption": 0.60,
            "demand_slump": 0.55,
            "commodity_price_spike": 0.50,
            "monsoon_delay": 0.45,   # weak harvest -> weak rural demand
        },
        playbook={
            "market_disruption": "Diversify suppliers and keep 2-3 weeks of fast-moving stock to ride out supply gaps.",
            "demand_slump": "Extend small trusted credit lines around harvest to retain customers; lean on UPI-based offers.",
            "monsoon_delay": "A weak monsoon cuts local purchasing power 1-2 months out, trim slow inventory and protect cash now.",
            "liquidity": "Keep working capital light in lean months; concentrate stock-up ahead of the post-harvest and festival peaks.",
        },
    ),
}


# Human-readable labels + descriptions for every named shock, used across the
# early-warning UI and the what-if scenario simulator.
SHOCKS: dict[str, dict[str, str]] = {
    "feed_price_spike": {"label": "Feed price spike", "driver": "input_cost", "icon": "🌾"},
    "commodity_price_spike": {"label": "Commodity price spike", "driver": "input_cost", "icon": "📈"},
    "raw_material_spike": {"label": "Raw material price spike", "driver": "input_cost", "icon": "📦"},
    "milk_price_crash": {"label": "Output price crash", "driver": "output_price", "icon": "📉"},
    "monsoon_delay": {"label": "Monsoon delay", "driver": "weather", "icon": "🌧️"},
    "heat_wave": {"label": "Heat wave", "driver": "weather", "icon": "🔥"},
    "disease_outbreak": {"label": "Disease outbreak", "driver": "productivity", "icon": "🦠"},
    "demand_slump": {"label": "Demand slump", "driver": "demand", "icon": "🛒"},
    "market_disruption": {"label": "Local market disruption", "driver": "demand", "icon": "🚧"},
}


def get_sector(key: str) -> Sector:
    if key not in SECTORS:
        raise KeyError(f"Unknown sector '{key}'. Known: {list(SECTORS)}")
    return SECTORS[key]


def sector_keys() -> list[str]:
    return list(SECTORS.keys())
