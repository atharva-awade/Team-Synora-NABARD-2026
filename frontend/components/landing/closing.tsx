"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { ArrowRight, Code2 } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { METRICS, VALUE_CREATION } from "@/lib/constants";

function AnimatedStat({ value, decimals = 0, suffix = "", prefix = "" }: {
  value: number; decimals?: number; suffix?: string; prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const stats = [
  { label: "Early-warning AUC", value: METRICS.riskAUC, decimals: 2, hint: "Held-out stress detection" },
  { label: "Forecast R²", value: METRICS.forecastR2, decimals: 2, hint: "6-month cash-flow backtest" },
  { label: "Directional accuracy", value: METRICS.directional, suffix: "%", hint: "Up/down move called right" },
  { label: "Sectors modelled", value: METRICS.sectors, hint: "Each a distinct digital twin" },
];

export function Proof() {
  return (
    <section id="proof" className="relative overflow-hidden py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_50%_at_50%_100%,var(--brand-soft),transparent)]" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand">
              The model, honestly
            </span>
          </Reveal>
          <Reveal delay={1}>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Real AI, measured on held-out data
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 text-lg text-ink-muted">
              Trained on simulated multi-sector data with walk-forward backtests — no cherry-picking,
              no black box. These are the numbers, and every prediction shows its working.
            </p>
          </Reveal>
        </div>

        <Reveal delay={2}>
          <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card-lg p-7 text-center">
                <div className="font-display text-5xl font-semibold text-gradient-brand">
                  <AnimatedStat value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix ?? ""} />
                </div>
                <div className="mt-3 text-sm font-semibold text-ink">{s.label}</div>
                <div className="mt-1 text-xs text-ink-faint">{s.hint}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ValueCreation() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Reveal>
            <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand">
              Value for NABARD
            </span>
          </Reveal>
          <Reveal delay={1}>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink">
              Aligned with the mission, by design
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 text-ink-muted">
              Pravah maps directly onto NABARD&apos;s four value-creation goals — turning underserved,
              thin-file enterprises into visible, credit-ready participants in the formal economy.
            </p>
          </Reveal>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUE_CREATION.map((v, i) => (
            <Reveal key={v.title} delay={i}>
              <div className="card h-full p-6">
                <div className="text-sm font-semibold text-brand">0{i + 1}</div>
                <h3 className="mt-2 font-semibold text-ink">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-brand px-8 py-16 text-center text-white shadow-[var(--shadow-brand)]">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Foresight for every rural enterprise
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Explore the live prototype — both the owner and field-officer experiences, powered by
              real models running end to end.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/app" size="lg" variant="secondary" className="!bg-white !text-brand-deep">
                Launch the platform <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/officer" size="lg" variant="ghost" className="!text-white hover:!bg-white/10">
                Field-officer view
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <Logo />
        <p className="text-center text-sm text-ink-faint sm:text-left">
          Built for the NABARD Hackathon @ GFF 2026 · AI-Driven Cash Flow Prediction &amp; Risk Flagging
        </p>
        <a
          href="https://github.com/atharva-awade/Team-Synora-NABARD-2026"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <Code2 className="h-4 w-4" /> Repository
        </a>
      </div>
    </footer>
  );
}
