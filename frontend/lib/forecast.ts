import type { Bundle, EnterpriseDetail, ForecastMonth } from "./types";

const DRIVER_LABELS: Record<string, string> = {
  d_output_price: "Output price",
  d_input_cost: "Input cost",
  d_demand: "Market demand",
  d_weather: "Weather / climate",
  d_productivity: "Productivity / yield",
  d_upi_activity: "Digital (UPI) activity",
};

export function riskBandFromScore(score: number): "Low" | "Watch" | "High" {
  if (score >= 55) return "High";
  if (score >= 25) return "Watch";
  return "Low";
}

export interface WhatIfResult {
  forecast: ForecastMonth[];
  riskScore: number;
  riskBand: "Low" | "Watch" | "High";
  baselineRiskScore: number;
  netCashflowSum: number;
}

/**
 * Recompute the forecast (and a forecast-consistent scenario risk) under driver
 * shocks entirely in the browser — mirroring the backend's forecast_enterprise
 * and _assess_risk so online and offline agree.
 *
 * `shocks` maps a driver column (e.g. "d_input_cost") to an additive delta.
 */
export function computeWhatIf(
  bundle: Bundle,
  detail: EnterpriseDetail,
  shocks: Record<string, number>,
): WhatIfResult {
  const fp = bundle.forecast_params;
  const id = detail.profile.id;
  const ep = fp.enterprises[id];
  const sp = fp.sectors[ep.sector];
  const cols = fp.driver_cols;
  const base = detail.forecast;

  const forecast: ForecastMonth[] = [];
  for (let h = 0; h < sp.months.length; h++) {
    const drivers = sp.expected_path[h].slice();
    for (const [key, delta] of Object.entries(shocks)) {
      const idx = cols.indexOf(key);
      if (idx >= 0) drivers[idx] += delta;
    }
    let frac = sp.intercept;
    for (let i = 0; i < drivers.length; i++) frac += drivers[i] * sp.coef[i];
    const adj = ep.scale * sp.seasonal_mult[h] * frac;
    const ncf = Math.round(ep.baseline_vals[h] + adj);

    const contributions = cols.map((c, i) => ({
      key: c,
      driver: DRIVER_LABELS[c] ?? c,
      value: Math.round(sp.coef[i] * (drivers[i] - sp.driver_means[i]) * ep.scale * sp.seasonal_mult[h]),
    }));
    contributions.sort((a, b) => a.value - b.value);

    const halfBand = base[h] ? (base[h].upper - base[h].lower) / 2 : Math.abs(ncf) * 0.4;
    const active: Record<string, number> = {};
    for (const [k, v] of Object.entries(shocks)) if (Math.abs(v) > 1e-6) active[k] = v;

    forecast.push({
      month: sp.months[h],
      predicted_net_cashflow: ncf,
      baseline: Math.round(ep.baseline_vals[h]),
      driver_adjustment: Math.round(adj),
      lower: Math.round(ncf - halfBand),
      upper: Math.round(ncf + halfBand),
      contributions,
      active_shocks: active,
    });
  }

  // Forecast-consistent scenario risk (mirrors backend _assess_risk).
  const baselineRiskScore = detail.risk.score;
  const hasShock = Object.values(shocks).some((v) => Math.abs(v) > 1e-6);
  let riskScore = baselineRiskScore;
  if (hasShock) {
    const baseSum = base.reduce((s, m) => s + m.predicted_net_cashflow, 0);
    const shkSum = forecast.reduce((s, m) => s + m.predicted_net_cashflow, 0);
    const baseNeg = base.filter((m) => m.predicted_net_cashflow < 0).length;
    const shkNeg = forecast.filter((m) => m.predicted_net_cashflow < 0).length;
    const deterioration = Math.max(0, baseSum - shkSum) / (Math.abs(baseSum) + ep.scale);
    const penalty = Math.min(60, deterioration * 120) + 6 * Math.max(0, shkNeg - baseNeg);
    riskScore = Math.min(99, baselineRiskScore + penalty);
  }

  return {
    forecast,
    riskScore: Math.round(riskScore * 10) / 10,
    riskBand: riskBandFromScore(riskScore),
    baselineRiskScore,
    netCashflowSum: forecast.reduce((s, m) => s + m.predicted_net_cashflow, 0),
  };
}
