import { cn } from "@/lib/utils";

/** Pravah wordmark with a "flow" glyph, three stacked flowing strokes. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-[var(--shadow-brand)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M3 8c3.5 0 3.5 3 7 3s3.5-3 7-3 3.5 3 4 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.55" />
          <path d="M3 13c3.5 0 3.5 3 7 3s3.5-3 7-3 3.5 3 4 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </span>
      {showText && (
        <span className="font-display text-[1.35rem] font-semibold tracking-tight text-ink">
          Pravah
        </span>
      )}
    </span>
  );
}
