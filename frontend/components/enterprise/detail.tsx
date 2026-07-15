"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft, Gauge, Activity, ShieldAlert, Wallet, Droplets, RotateCcw, Sparkles, TrendingDown, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { loadBundle } from "@/lib/data";
import { computeWhatIf } from "@/lib/forecast";
import type { Bundle, EnterpriseDetail } from "@/lib/types";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { DataEntry } from "@/components/enterprise/data-entry";
import { ContributionBars, RadialGauge } from "@/components/charts/primitives";
import { RiskBadge, Pill } from "@/components/ui/badge";
import { formatINR, formatINRFull, riskColorVar, cn } from "@/lib/utils";
import { useI18n, speak } from "@/lib/i18n";
import { Volume2 } from "lucide-react";

const SLIDERS = [
  { key: "d_input_cost", label: "Input / feed cost", icon: "🌾", min: -0.3, max: 0.6 },
  { key: "d_demand", label: "Market demand", icon: "🛒", min: -0.5, max: 0.4 },
  { key: "d_weather", label: "Weather / monsoon", icon: "🌧️", min: -0.5, max: 0.3 },
  { key: "d_output_price", label: "Output price", icon: "📈", min: -0.4, max: 0.4 },
];

function adverseDelta(driver: string): number {
  return driver === "d_input_cost" ? 0.4 : -0.35;
}

export function EnterpriseDetailView({ id, owner = false }: { id: string; owner?: boolean }) {
  const { t, lang } = useI18n();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [shocks, setShocks] = useState<Record<string, number>>({});

  useEffect(() => {
    loadBundle().then(setBundle).catch(console.error);
  }, []);

  const detail: EnterpriseDetail | null = bundle?.enterprises[id] ?? null;

  const scenario = useMemo(() => {
    if (!bundle || !detail) return null;
    return computeWhatIf(bundle, detail, shocks);
  }, [bundle, detail, shocks]);

  if (!bundle || !detail || !scenario) return <DetailSkeleton />;

  const hasShock = Object.values(shocks).some((v) => Math.abs(v) > 1e-6);
  const p = detail.profile;
  const v = detail.vitals;

  // Aggregate factor contributions across the forecast horizon (plain compute,
  // kept below the early-return guard so no hook runs conditionally).
  const contribMap = new Map<string, { key: string; driver: string; value: number }>();
  for (const m of scenario.forecast) {
    for (const c of m.contributions) {
      const cur = contribMap.get(c.key) ?? { key: c.key, driver: c.driver, value: 0 };
      cur.value += c.value;
      contribMap.set(c.key, cur);
    }
  }
  const summed = [...contribMap.values()].sort((a, b) => a.value - b.value);

  const baseSum = detail.forecast.reduce((s, m) => s + m.predicted_net_cashflow, 0);
  const scenSum = scenario.netCashflowSum;
  const deltaCash = scenSum - baseSum;
  const deltaRisk = scenario.riskScore - detail.risk.score;
  const sectorMeta = bundle.meta.sectors.find((s) => s.key === p.sector);

  return (
    <div className="space-y-6">
      {!owner && (
        <Link href="/officer" className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to portfolio
        </Link>
      )}

      {/* header */}
      <div className="card-lg flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-3xl">{p.sector_emoji}</span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Pill>{p.sector_label}</Pill>
              <Pill>{p.district}, {p.state}</Pill>
              <Pill>{p.org_type}</Pill>
              <Pill>Since {p.established_year}</Pill>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-ink-faint">Early-warning risk</div>
            <RiskBadge band={scenario.riskBand} pulse className="mt-1" />
          </div>
        </div>
      </div>

      {/* vitals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Vital icon={Droplets} label={t("vitals.runway")} value={`${v.liquidity_runway_months}`} unit="months"
          tone={v.liquidity_runway_months < 1.5 ? "risk" : v.liquidity_runway_months < 3 ? "watch" : "good"} />
        <Vital icon={Activity} label={t("vitals.volatility")} value={`${(v.income_volatility * 100).toFixed(0)}`} unit="%"
          tone={v.income_volatility > 1 ? "risk" : v.income_volatility > 0.5 ? "watch" : "good"} />
        <Vital icon={Gauge} label={t("vitals.repay")} value={v.repayment_capacity === null ? "—" : `${v.repayment_capacity.toFixed(1)}×`} unit="of EMI"
          tone={v.repayment_capacity !== null && v.repayment_capacity < 1 ? "risk" : "good"} />
        <Vital icon={Wallet} label={t("vitals.ncf")} value={formatINR(v.avg_monthly_net_cashflow)} unit="/ month"
          tone={v.avg_monthly_net_cashflow < 0 ? "risk" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* forecast + simulator */}
        <div className="space-y-6">
          {owner && <DataEntry bundle={bundle} detail={detail} />}
          <div className="card-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">{t("forecast.title")}</h2>
                <p className="text-sm text-ink-muted">24 months {t("forecast.sub")}</p>
              </div>
              {hasShock && <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep">What-if scenario</span>}
            </div>
            <CashflowChart history={detail.history} forecast={scenario.forecast} />
          </div>

          {/* what-if simulator */}
          <div className="card-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-semibold text-ink">{t("sim.title")}</h2>
              </div>
              {hasShock && (
                <button onClick={() => setShocks({})} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              )}
            </div>

            {sectorMeta && (
              <div className="mb-5 flex flex-wrap gap-2">
                {sectorMeta.shocks.map((sh) => {
                  const d = adverseDelta(sh.driver);
                  const active = Math.abs((shocks[sh.driver] ?? 0) - d) < 1e-6;
                  return (
                    <button
                      key={sh.key}
                      onClick={() => setShocks((s) => ({ ...s, [sh.driver]: active ? 0 : d }))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active ? "border-accent bg-accent-soft text-accent-deep" : "border-border text-ink-muted hover:text-ink",
                      )}
                    >
                      <span>{sh.icon}</span> {sh.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {SLIDERS.map((sl) => {
                const val = shocks[sl.key] ?? 0;
                return (
                  <div key={sl.key}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-ink-muted">{sl.icon} {sl.label}</span>
                      <span className={cn("font-mono font-medium", val > 0 ? "text-risk-high" : val < 0 ? "text-risk-watch" : "text-ink-faint")}>
                        {val > 0 ? "+" : ""}{Math.round(val * 100)}%
                      </span>
                    </div>
                    <input
                      type="range" min={sl.min} max={sl.max} step={0.05} value={val}
                      onChange={(e) => setShocks((s) => ({ ...s, [sl.key]: parseFloat(e.target.value) }))}
                      className="w-full accent-[var(--brand)]"
                    />
                  </div>
                );
              })}
            </div>

            {hasShock && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-5 flex flex-wrap gap-3 rounded-xl bg-surface-2 p-4 text-sm">
                <ScenarioDelta label="6-month cash flow" value={deltaCash} good={deltaCash >= 0} />
                <ScenarioDelta label="Risk score" value={deltaRisk} good={deltaRisk <= 0} isRisk />
              </motion.div>
            )}
          </div>
        </div>

        {/* right column: risk, explainability, readiness, actions */}
        <div className="space-y-6">
          {/* risk gauge */}
          <div className="card-lg p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" style={{ color: riskColorVar(scenario.riskBand) }} />
              <h2 className="text-lg font-semibold text-ink">{t("risk.title")}</h2>
            </div>
            <div className="mt-4 flex items-center gap-5">
              <RadialGauge value={scenario.riskScore} label={t(`band.${scenario.riskBand}`)} sublabel={t("risk.stress")} color={riskColorVar(scenario.riskBand)} />
              <div className="flex-1 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Top drivers</div>
                {detail.risk.top_factors.slice(0, 4).map((f) => (
                  <div key={f.label} className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, f.weight / (detail.risk.top_factors[0]?.weight || 1) * 100)}%` }} />
                    </div>
                    <span className="w-32 shrink-0 text-xs text-ink-muted">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* explainability */}
          <div className="card-lg p-6">
            <h2 className="text-lg font-semibold text-ink">{t("why.title")}</h2>
            <p className="mb-4 text-sm text-ink-muted">Exact factor contributions over the {detail.horizon_months}-month horizon.</p>
            <ContributionBars items={summed} />
          </div>

          {/* credit readiness */}
          <div className="card-lg p-6">
            <h2 className="text-lg font-semibold text-ink">{t("credit.title")}</h2>
            <div className="mt-3 flex items-center gap-5">
              <RadialGauge value={detail.credit_readiness.score} label={detail.credit_readiness.band}
                color={detail.credit_readiness.score >= 70 ? "var(--risk-low)" : detail.credit_readiness.score >= 45 ? "var(--accent)" : "var(--ink-faint)"} />
              <div className="flex-1 space-y-2 text-xs">
                {Object.entries(detail.credit_readiness.components).map(([k, val]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="capitalize text-ink-muted">{k.replace(/_/g, " ")}</span>
                    <span className="font-medium text-ink">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="card-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{t("actions.title")}</h2>
          <button
            onClick={() => speak(
              detail.actions.map((a) => `${a.title}. ${a.detail}`).join(" "), lang)}
            className="ring-focus inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            <Volume2 className="h-3.5 w-3.5" /> {t("listen")}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {detail.actions.map((a) => (
            <div key={a.title} className={cn(
              "rounded-xl border p-4",
              a.urgency === "high" ? "border-risk-high/30 bg-risk-high-soft" : a.urgency === "medium" ? "border-accent/30 bg-accent-soft" : "border-border bg-surface-2",
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{a.title}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                  a.urgency === "high" ? "text-risk-high" : a.urgency === "medium" ? "text-accent-deep" : "text-ink-faint")}>
                  {a.urgency}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{a.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-faint">
          Enterprise-level cash balance today: {formatINRFull(v.current_cash_balance)} · Savings: {formatINRFull(v.savings)} · Loan outstanding: {formatINRFull(v.loan_outstanding)}
        </p>
      </div>
    </div>
  );
}

function Vital({ icon: Icon, label, value, unit, tone }: {
  icon: LucideIcon; label: string; value: string; unit: string; tone: "risk" | "watch" | "good";
}) {
  const color = tone === "risk" ? "var(--risk-high)" : tone === "watch" ? "var(--risk-watch)" : "var(--risk-low)";
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-muted"><Icon className="h-4 w-4" style={{ color }} /><span className="text-xs">{label}</span></div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-2xl font-semibold text-ink">{value}</span>
        <span className="text-xs text-ink-faint">{unit}</span>
      </div>
    </div>
  );
}

function ScenarioDelta({ label, value, good, isRisk }: { label: string; value: number; good: boolean; isRisk?: boolean }) {
  const Icon = good ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: good ? "var(--risk-low)" : "var(--risk-high)" }} />
      <span className="text-ink-muted">{label}:</span>
      <span className="font-mono font-semibold" style={{ color: good ? "var(--risk-low)" : "var(--risk-high)" }}>
        {isRisk ? `${value > 0 ? "+" : ""}${value.toFixed(1)} pts` : formatINR(value, { sign: true })}
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 animate-pulse rounded bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />)}</div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
