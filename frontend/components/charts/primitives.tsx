"use client";

import { motion } from "motion/react";
import { formatINR } from "@/lib/utils";
import type { Contribution } from "@/lib/types";

/** Diverging horizontal bars for exact factor attribution. */
export function ContributionBars({ items }: { items: Contribution[] }) {
  const shown = items.filter((c) => Math.abs(c.value) > 1).slice(0, 6);
  const maxAbs = Math.max(1, ...shown.map((c) => Math.abs(c.value)));
  return (
    <div className="space-y-2.5">
      {shown.map((c, i) => {
        const pct = (Math.abs(c.value) / maxAbs) * 50;
        const neg = c.value < 0;
        return (
          <div key={c.key} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-ink-muted" title={c.driver}>{c.driver}</span>
            <div className="relative h-5 flex-1">
              <div className="absolute left-1/2 top-0 h-full w-px bg-border-strong" />
              <motion.div
                className="absolute top-0.5 h-4 rounded"
                style={{
                  background: neg ? "var(--risk-high)" : "var(--risk-low)",
                  right: neg ? "50%" : undefined,
                  left: neg ? undefined : "50%",
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
              />
            </div>
            <span className={`w-14 shrink-0 text-right font-mono ${neg ? "text-risk-high" : "text-risk-low"}`}>
              {formatINR(c.value, { sign: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Radial gauge for a 0-100 score, coloured by band. */
export function RadialGauge({
  value, max = 100, label, sublabel, color = "var(--brand)", size = 132,
}: {
  value: number; max?: number; label?: string; sublabel?: string; color?: string; size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  // 270° arc (gap at bottom)
  const arc = 0.75;
  const dash = c * arc;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDashoffset: dash }}
          whileInView={{ strokeDashoffset: dash * (1 - pct) }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="font-display text-3xl font-semibold text-ink">{Math.round(value)}</div>
        {label && <div className="text-xs font-medium" style={{ color }}>{label}</div>}
        {sublabel && <div className="text-[10px] text-ink-faint">{sublabel}</div>}
      </div>
    </div>
  );
}

/** Tiny sparkline for list rows. */
export function Sparkline({ data, color = "var(--brand)", width = 84, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
