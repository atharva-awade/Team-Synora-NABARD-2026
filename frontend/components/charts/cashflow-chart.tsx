"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useWidth } from "./use-width";
import { formatINR, formatMonth } from "@/lib/utils";
import type { ForecastMonth, HistoryPoint } from "@/lib/types";

interface Props {
  history: HistoryPoint[];
  forecast: ForecastMonth[];
  height?: number;
}

type Pt = { i: number; label: string; value: number; forecast: boolean; lower?: number; upper?: number; shock?: string };

export function CashflowChart({ history, forecast, height = 300 }: Props) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const pts: Pt[] = useMemo(() => {
    const h = history.map((d, i) => ({
      i, label: d.month, value: d.net_cashflow, forecast: false, shock: d.active_shock || undefined,
    }));
    const f = forecast.map((d, k) => ({
      i: history.length + k, label: d.month, value: d.predicted_net_cashflow,
      forecast: true, lower: d.lower, upper: d.upper,
    }));
    return [...h, ...f];
  }, [history, forecast]);

  const pad = { top: 18, right: 16, bottom: 26, left: 46 };
  const w = Math.max(width, 320);
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const values = pts.flatMap((p) => [p.value, p.lower ?? p.value, p.upper ?? p.value]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const x = (i: number) => pad.left + (i / Math.max(1, pts.length - 1)) * innerW;
  const y = (v: number) => pad.top + innerH - ((v - min) / range) * innerH;

  const histPts = pts.filter((p) => !p.forecast);
  const foreStart = histPts.length - 1;
  const forePts = pts.slice(foreStart); // include join point

  const linePath = (arr: Pt[]) =>
    arr.map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");

  const histLine = linePath(histPts);
  const histArea = `${histLine} L ${x(histPts[histPts.length - 1].i)} ${y(min)} L ${x(0)} ${y(min)} Z`;
  const foreLine = linePath(forePts);

  const bandPath = (() => {
    const up = forePts.filter((p) => p.upper !== undefined);
    if (up.length < 2) return "";
    const top = up.map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.upper!).toFixed(1)}`).join(" ");
    const bot = [...up].reverse().map((p) => `L ${x(p.i).toFixed(1)} ${y(p.lower!).toFixed(1)}`).join(" ");
    return `${top} ${bot} Z`;
  })();

  const zeroY = y(0);
  const active = hover !== null ? pts[hover] : null;

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={w} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="cf-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const gv = min + t * range;
          const gy = y(gv);
          return (
            <g key={t}>
              <line x1={pad.left} x2={w - pad.right} y1={gy} y2={gy} stroke="var(--grid-line)" />
              <text x={pad.left - 8} y={gy + 3} textAnchor="end" className="fill-[var(--ink-faint)] text-[10px]">
                {formatINR(gv)}
              </text>
            </g>
          );
        })}

        {/* zero baseline */}
        <line x1={pad.left} x2={w - pad.right} y1={zeroY} y2={zeroY} stroke="var(--border-strong)" strokeDasharray="3 3" />

        {/* forecast confidence band */}
        {bandPath && <path d={bandPath} fill="var(--brand)" opacity={0.1} />}

        {/* history area + line */}
        <path d={histArea} fill="url(#cf-area)" />
        <motion.path
          d={histLine} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }}
        />

        {/* forecast dashed line */}
        <motion.path
          d={foreLine} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.5, ease: "easeInOut" }}
        />

        {/* shock markers */}
        {histPts.filter((p) => p.shock).map((p) => (
          <circle key={p.i} cx={x(p.i)} cy={y(p.value)} r={3.5} fill="var(--risk-high)" stroke="var(--surface)" strokeWidth={1.5} />
        ))}

        {/* hover guide */}
        {active && (
          <g>
            <line x1={x(active.i)} x2={x(active.i)} y1={pad.top} y2={pad.top + innerH} stroke="var(--border-strong)" />
            <circle cx={x(active.i)} cy={y(active.value)} r={5} fill={active.forecast ? "var(--accent)" : "var(--brand)"} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}

        {/* hover hit areas */}
        {pts.map((p) => (
          <rect
            key={p.i} x={x(p.i) - innerW / pts.length / 2} y={pad.top}
            width={innerW / pts.length} height={innerH} fill="transparent"
            onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-md)]"
          style={{ left: Math.min(Math.max(x(active.i), 70), w - 70), top: 4 }}
        >
          <div className="font-medium text-ink">{formatMonth(active.label)}</div>
          <div className={active.value < 0 ? "text-risk-high" : "text-ink-muted"}>
            {active.forecast ? "Forecast" : "Actual"}: {formatINR(active.value)}
          </div>
          {active.shock && <div className="mt-0.5 text-risk-high">⚠ {active.shock.replace(/_/g, " ")}</div>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-4 px-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" /> Actual</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-accent" style={{ backgroundImage: "repeating-linear-gradient(90deg,var(--accent) 0 4px,transparent 4px 7px)" }} /> Forecast</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-brand/10" /> Confidence band</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-risk-high" /> Shock month</span>
      </div>
    </div>
  );
}
