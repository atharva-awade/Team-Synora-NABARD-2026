/** Static content + headline model metrics for the marketing surfaces. */

export const METRICS = {
  forecastR2: 0.65,
  directional: 77,
  riskAUC: 0.96,
  sectors: 5,
  enterprises: 25,
  riskFeatures: 12,
  horizonMonths: 6,
};

export const SIGNALS = [
  { key: "financial", label: "Financial records", detail: "Savings, loans, repayments, balances", icon: "💰" },
  { key: "upi", label: "UPI transaction proxies", detail: "Velocity & seasonality — never personal data", icon: "📲" },
  { key: "market", label: "Market intelligence", detail: "Commodity & input prices, demand trends", icon: "📈" },
  { key: "climate", label: "Climate & seasonality", detail: "Monsoon, heat, crop calendars", icon: "🌦️" },
];

export const STEPS = [
  {
    n: "01",
    title: "Ingest multi-source signals",
    body: "Pravah blends self-reported financials with anonymised UPI proxies, mandi/commodity prices, demand and climate signals — a rich picture of real rural economic activity, with zero personal data.",
  },
  {
    n: "02",
    title: "Forecast & flag, explainably",
    body: "Sector-aware models project cash flow 3–6 months ahead and a gradient-boosted classifier flags financial stress early — every number carries a plain-language 'why'.",
  },
  {
    n: "03",
    title: "Turn insight into action",
    body: "Owners get simple alerts and concrete next steps; field officers get a portfolio risk board and a grant-to-credit readiness pipeline. Works offline, in any language.",
  },
];

export const NOVELTIES = [
  {
    icon: "🛡️",
    title: "Alternative-data scoring, no PII",
    body: "Forecasts built from proxy signals — UPI velocity, mandi prices, weather — not personal or account data. Solves the thin-file problem at the heart of rural credit.",
    tag: "Financial inclusion",
  },
  {
    icon: "🔍",
    title: "Explainable by default",
    body: "Every forecast decomposes into exact factor contributions and every risk flag names its drivers. Field officers trust what explains itself.",
    tag: "Trust",
  },
  {
    icon: "🧬",
    title: "Sector digital twins",
    body: "Purpose-built cash-flow models for dairy, poultry, food processing, handicrafts and rural retail — each with its own seasonality and shock sensitivities.",
    tag: "Precision",
  },
  {
    icon: "🌪️",
    title: "Climate & market what-if simulator",
    body: "Drag a slider — 'monsoon delayed 3 weeks', 'feed +15%' — and watch the forecast and risk re-rate live. Proactive, not reactive.",
    tag: "Foresight",
  },
  {
    icon: "📶",
    title: "Offline-first, on-device AI",
    body: "The early-warning model runs in the browser via ONNX with zero network, syncing when connectivity returns. Built for villages, not just data centres.",
    tag: "Last mile",
  },
  {
    icon: "🪜",
    title: "Grant-to-credit pipeline",
    body: "A transparent credit-readiness scorecard plus concrete action playbooks graduate enterprises from grants toward formal credit — exactly NABARD's mission.",
    tag: "Impact",
  },
];

export const VALUE_CREATION = [
  {
    title: "Enhanced credit flow",
    body: "Reliable cash-flow forecasts and risk profiles strengthen banks' appraisal of thin-file rural enterprises, unlocking formal credit.",
  },
  {
    title: "Credit-led rural development",
    body: "A readiness pipeline helps enterprises demonstrate repayment capacity and graduate from grants to institutional finance.",
  },
  {
    title: "A digital public good",
    body: "An open, API-first layer for enterprise profiling, cash-flow assessment and risk monitoring — common infrastructure for the ecosystem.",
  },
  {
    title: "Better beneficiary outcomes",
    body: "Owners receive actionable insight into performance and market risk, enabling informed decisions and resilience.",
  },
];
