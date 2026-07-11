import { cn } from "@/lib/utils";

const bandStyles: Record<string, string> = {
  Low: "bg-risk-low-soft text-risk-low",
  Watch: "bg-risk-watch-soft text-risk-watch",
  High: "bg-risk-high-soft text-risk-high",
  "Credit-ready": "bg-risk-low-soft text-risk-low",
  Emerging: "bg-risk-watch-soft text-risk-watch",
  Building: "bg-surface-3 text-ink-muted",
};

export function RiskBadge({ band, className, pulse }: { band: string; className?: string; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        bandStyles[band] ?? "bg-surface-3 text-ink-muted",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && band === "High" && "animate-pulse-ring")} />
      {band}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted", className)}>
      {children}
    </span>
  );
}
