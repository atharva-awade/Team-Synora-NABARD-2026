"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, TrendingUp, Users, Wallet, Search, ArrowRight } from "lucide-react";
import { loadBundle } from "@/lib/data";
import type { Bundle, PortfolioCard } from "@/lib/types";
import { RiskBadge } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts/primitives";
import { formatINR, riskColorVar, cn } from "@/lib/utils";

const BANDS = ["All", "High", "Watch", "Low"] as const;

export function PortfolioView() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [band, setBand] = useState<(typeof BANDS)[number]>("All");
  const [sector, setSector] = useState("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    loadBundle().then(setBundle).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    if (!bundle) return [];
    return bundle.portfolio.enterprises.filter((e) => {
      if (band !== "All" && e.risk_band !== band) return false;
      if (sector !== "All" && e.sector_label !== sector) return false;
      if (q && !e.name.toLowerCase().includes(q.toLowerCase()) && !e.district.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [bundle, band, sector, q]);

  if (!bundle) return <LoadingState />;

  const s = bundle.portfolio.summary;
  const sectors = ["All", ...Object.keys(s.sector_counts)];
  const total = s.total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Portfolio risk board</h1>
        <p className="mt-1 text-ink-muted">
          {total} enterprises monitored · {s.at_risk_count} need attention · early warnings updated to this month
        </p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Enterprises" value={`${total}`} sub={`${Object.keys(s.sector_counts).length} sectors`} />
        <Stat icon={AlertTriangle} label="Need attention" value={`${s.at_risk_count}`} sub={`${s.band_counts.High} high · ${s.band_counts.Watch} watch`} tone="risk" />
        <Stat icon={TrendingUp} label="Credit-ready" value={`${s.credit_ready_count}`} sub="ready to graduate" tone="good" />
        <Stat icon={Wallet} label="Avg readiness" value={`${s.avg_credit_readiness}`} sub="portfolio score / 100" />
      </div>

      {/* distribution bar */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">Risk distribution</span>
          <span className="text-ink-faint">{total} enterprises</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full">
          {(["High", "Watch", "Low"] as const).map((b) => {
            const w = (s.band_counts[b] / total) * 100;
            return <div key={b} style={{ width: `${w}%`, background: riskColorVar(b) }} title={`${b}: ${s.band_counts[b]}`} />;
          })}
        </div>
        <div className="mt-3 flex gap-5 text-xs text-ink-muted">
          {(["High", "Watch", "Low"] as const).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: riskColorVar(b) }} /> {b} · {s.band_counts[b]}
            </span>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
          {BANDS.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                band === b ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-muted hover:text-ink",
              )}
            >
              {b}
            </button>
          ))}
        </div>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="ring-focus rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink"
        >
          {sectors.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
        </select>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or district"
            className="ring-focus w-56 rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink-faint"
          />
        </div>
      </div>

      {/* enterprise rows */}
      <div className="grid gap-3">
        {filtered.map((e, i) => (
          <EnterpriseRow key={e.id} card={e} history={bundle.enterprises[e.id]?.history.map((h) => h.net_cashflow) ?? []} index={i} />
        ))}
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-ink-muted">No enterprises match these filters.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: string; sub: string; tone?: "risk" | "good";
}) {
  const color = tone === "risk" ? "var(--risk-high)" : tone === "good" ? "var(--risk-low)" : "var(--brand)";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>
    </div>
  );
}

function EnterpriseRow({ card, history, index }: { card: PortfolioCard; history: number[]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.4 }}
    >
      <Link
        href={`/enterprise/${card.id}`}
        className="card group flex flex-col gap-4 p-4 transition-all hover:border-border-strong hover:shadow-[var(--shadow-md)] sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{card.sector_emoji}</span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{card.name}</div>
            <div className="truncate text-xs text-ink-muted">{card.sector_label} · {card.district}, {card.state} · {card.org_type}</div>
          </div>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          <div className="text-right">
            <div className="text-[11px] text-ink-faint">Next month</div>
            <div className={cn("font-mono text-sm font-medium", card.next_month_net_cashflow < 0 ? "text-risk-high" : "text-ink")}>
              {formatINR(card.next_month_net_cashflow)}
            </div>
          </div>
          <Sparkline data={history} color={riskColorVar(card.risk_band)} />
          <div className="text-right">
            <div className="text-[11px] text-ink-faint">Readiness</div>
            <div className="text-sm font-medium text-ink">{card.credit_readiness}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-24">
            <div className="mb-1 flex justify-between text-[11px] text-ink-faint">
              <span>Risk</span><span>{card.risk_score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${card.risk_score}%`, background: riskColorVar(card.risk_band) }} />
            </div>
          </div>
          <RiskBadge band={card.risk_band} pulse />
          <ArrowRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />)}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />)}
      </div>
    </div>
  );
}
