import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact Indian-rupee formatting (₹1.2L, ₹45k, ₹-3k). */
export function formatINR(value: number, opts?: { sign?: boolean }): string {
  const sign = value < 0 ? "-" : opts?.sign && value > 0 ? "+" : "";
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_00_00_000) body = `${(abs / 1_00_00_000).toFixed(2)}Cr`;
  else if (abs >= 1_00_000) body = `${(abs / 1_00_000).toFixed(2)}L`;
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  else body = `${Math.round(abs)}`;
  return `${sign}₹${body}`;
}

/** Full rupee formatting with grouping (₹1,23,456). */
export function formatINRFull(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export const riskColorVar = (band: string) =>
  band === "High" ? "var(--risk-high)" : band === "Watch" ? "var(--risk-watch)" : "var(--risk-low)";

export const riskSoftVar = (band: string) =>
  band === "High" ? "var(--risk-high-soft)" : band === "Watch" ? "var(--risk-watch-soft)" : "var(--risk-low-soft)";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
