"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cpu, Plus, WifiOff, RotateCcw } from "lucide-react";
import type { Bundle, EnterpriseDetail, HistoryPoint } from "@/lib/types";
import { scoreOnDevice } from "@/lib/risk-model";
import { RiskBadge } from "@/components/ui/badge";
import { formatINR, riskColorVar, cn } from "@/lib/utils";

const FIELDS = [
  { key: "income", label: "Income this month", placeholder: "e.g. 45000" },
  { key: "expenses", label: "Expenses", placeholder: "e.g. 32000" },
  { key: "savings", label: "Savings balance", placeholder: "e.g. 60000" },
  { key: "repayment_made", label: "Loan repayment paid", placeholder: "e.g. 8000" },
  { key: "upi_txn_count", label: "UPI transactions", placeholder: "e.g. 320" },
] as const;

export function DataEntry({ bundle, detail }: { bundle: Bundle; detail: EnterpriseDetail }) {
  const last = detail.history[detail.history.length - 1];
  const [form, setForm] = useState<Record<string, string>>({
    income: String(last.income),
    expenses: String(last.expenses),
    savings: String(last.savings),
    repayment_made: String(last.repayment_due),
    upi_txn_count: String(last.upi_txn_count),
  });
  const [result, setResult] = useState<{ score: number; band: string; runway: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const income = +form.income || 0;
    const expenses = +form.expenses || 0;
    const savings = +form.savings || last.savings;
    const repaid = +form.repayment_made || 0;
    const upi = +form.upi_txn_count || last.upi_txn_count;

    const next: HistoryPoint = {
      ...last,
      month: nextMonth(last.month),
      income, expenses,
      net_cashflow: income - expenses,
      cash_balance: last.cash_balance + (income - expenses) - repaid,
      savings,
      repayment_made: repaid,
      upi_txn_count: upi,
      active_shock: "",
    };
    const extended = [...detail.history, next];
    const { score, band } = await scoreOnDevice(bundle, detail.profile.id, extended);
    const exp3 = extended.slice(-3).reduce((s, h) => s + h.expenses, 0) / 3;
    const runway = Math.round((next.cash_balance / Math.max(1, exp3)) * 10) / 10;
    setResult({ score, band, runway });
    setBusy(false);
  };

  const baseline = detail.risk.score;

  return (
    <div className="card-lg p-6">
      <div className="mb-1 flex items-center gap-2">
        <Cpu className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold text-ink">Record this month</h2>
      </div>
      <p className="mb-5 flex items-center gap-1.5 text-sm text-ink-muted">
        <WifiOff className="h-3.5 w-3.5" /> Runs the AI model on your device — no network needed.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs text-ink-muted">{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="ring-focus w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="ring-focus inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {busy ? "Computing…" : "Update my outlook"}
        </button>
        {result && (
          <button onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
                Updated on-device · early-warning re-evaluated
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-xs text-ink-faint">New risk score</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-semibold" style={{ color: riskColorVar(result.band) }}>
                        {result.score}
                      </span>
                      <RiskBadge band={result.band} />
                    </div>
                  </div>
                  <DeltaChip label="vs before" value={result.score - baseline} good={result.score - baseline <= 0} />
                </div>
                <div>
                  <div className="text-xs text-ink-faint">Projected runway</div>
                  <div className={cn("font-display text-2xl font-semibold", result.runway < 1.5 ? "text-risk-high" : "text-ink")}>
                    {result.runway} <span className="text-sm font-normal text-ink-faint">months</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeltaChip({ label, value, good }: { label: string; value: number; good: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: good ? "var(--risk-low-soft)" : "var(--risk-high-soft)", color: good ? "var(--risk-low)" : "var(--risk-high)" }}>
      {value > 0 ? "+" : ""}{value.toFixed(1)} {label}
    </span>
  );
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // m is 1-indexed -> Date month m gives next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
