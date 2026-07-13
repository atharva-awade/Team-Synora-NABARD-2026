"use client";

import type { Bundle, HistoryPoint } from "./types";

/**
 * On-device early-warning inference. The gradient-boosting ensemble is shipped
 * as compact JSON (risk_trees.json) and evaluated here in ~20 lines — the exact
 * same model that runs on the server, now running in the browser with zero
 * network and zero runtime dependencies. This is real edge AI for the last mile.
 */

interface Tree {
  feature: number[];
  threshold: number[];
  left: number[];
  right: number[];
  value: number[];
}
interface RiskTrees {
  features: string[];
  init: number;
  learning_rate: number;
  trees: Tree[];
}

let modelPromise: Promise<RiskTrees> | null = null;

export function loadRiskModel(): Promise<RiskTrees> {
  if (!modelPromise) {
    modelPromise = fetch("/models/risk_trees.json", { cache: "force-cache" }).then((r) => r.json());
  }
  return modelPromise;
}

/** Evaluate the ensemble on an ordered feature vector -> probability (0-1). */
export function evaluateRisk(model: RiskTrees, x: number[]): number {
  let raw = model.init;
  for (const t of model.trees) {
    let node = 0;
    while (t.feature[node] >= 0) {
      node = x[t.feature[node]] <= t.threshold[node] ? t.left[node] : t.right[node];
    }
    raw += model.learning_rate * t.value[node];
  }
  return 1 / (1 + Math.exp(-raw));
}

function slope(y: number[]): number {
  const n = y.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xm) * (y[i] - ym); den += (i - xm) ** 2; }
  return den ? num / den : 0;
}

/**
 * Recompute the financial risk features from an (extended) history and merge
 * with the external-pressure features from the current snapshot — so an owner's
 * freshly entered figures move the on-device risk score sensibly.
 */
export function riskFeaturesFrom(
  history: HistoryPoint[],
  baseFeatures: Record<string, number>,
  order: string[],
): number[] {
  const inc = history.map((h) => h.income);
  const ncf = history.map((h) => h.net_cashflow);
  const upi = history.map((h) => h.upi_txn_count);
  const scale = Math.max(1, inc.reduce((a, b) => a + b, 0) / inc.length);
  const last = (arr: number[], n: number) => arr.slice(-n);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const std = (arr: number[]) => {
    const m = mean(arr);
    return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
  };

  const exp3 = mean(last(history.map((h) => h.expenses), 3));
  const cash = history[history.length - 1].cash_balance;
  const repDue = mean(last(history.map((h) => h.repayment_due), 3));
  const upiPrev = mean(upi.slice(-6, -3));

  const financial: Record<string, number> = {
    ncf_mean_3: mean(last(ncf, 3)) / scale,
    ncf_trend_6: slope(last(ncf, 6)) / scale,
    ncf_volatility_6: std(last(ncf, 6)) / scale,
    runway_months: cash / Math.max(1, exp3),
    repayment_coverage: mean(last(ncf, 3)) / Math.max(1, repDue),
    savings_ratio: history[history.length - 1].savings / scale,
    upi_trend_3: upi.length >= 6 ? (mean(upi.slice(-3)) - upiPrev) / Math.max(1, upiPrev) : 0,
  };

  return order.map((k) => (k in financial ? financial[k] : baseFeatures[k] ?? 0));
}

export function riskBand(score: number): "Low" | "Watch" | "High" {
  if (score >= 55) return "High";
  if (score >= 25) return "Watch";
  return "Low";
}

export async function scoreOnDevice(bundle: Bundle, id: string, history: HistoryPoint[]) {
  const model = await loadRiskModel();
  const base = bundle.current_risk_features[id] ?? {};
  const x = riskFeaturesFrom(history, base, model.features);
  const score = evaluateRisk(model, x) * 100;
  return { score: Math.round(score * 10) / 10, band: riskBand(score) };
}
