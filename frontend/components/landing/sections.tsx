"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Building2, UserRound, Check } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SIGNALS, STEPS, NOVELTIES } from "@/lib/constants";

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Reveal>
        <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand">
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={1}>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {title}
        </h2>
      </Reveal>
      {sub && (
        <Reveal delay={2}>
          <p className="mt-4 text-lg text-ink-muted">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-6 py-28">
      <SectionHeading
        eyebrow="How it works"
        title="From scattered signals to a clear path forward"
        sub="Underused rural data becomes predictive foresight — in three steps."
      />

      <Reveal delay={2}>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SIGNALS.map((s) => (
            <div key={s.key} className="card p-5 text-center transition-transform hover:-translate-y-1">
              <div className="text-3xl">{s.icon}</div>
              <div className="mt-3 text-sm font-semibold text-ink">{s.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-ink-muted">{s.detail}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} delay={i}>
            <div className="card-lg h-full p-7">
              <div className="font-display text-5xl font-semibold text-brand-soft">{step.n}</div>
              <h3 className="mt-3 text-xl font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Novelties() {
  return (
    <section id="novelty" className="relative overflow-hidden py-28">
      <div className="absolute inset-0 -z-10 bg-bg-subtle/60" />
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="What sets Pravah apart"
          title="Six ideas most teams won't build"
          sub="Not hackathon gimmicks — each one solves a real problem in rural credit."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {NOVELTIES.map((n, i) => (
            <Reveal key={n.title} delay={i % 3}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="card group relative h-full overflow-hidden p-7"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-soft opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                <div className="text-3xl">{n.icon}</div>
                <div className="mt-4 inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  {n.tag}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-ink">{n.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{n.body}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const personas = [
  {
    icon: UserRound,
    kicker: "For micro-enterprises",
    title: "A financial co-pilot in your pocket",
    href: "/app",
    cta: "Open owner view",
    features: [
      "Record income, expenses, savings & loans in seconds",
      "Financial vital signs: runway, volatility, repayment capacity",
      "Early alerts with concrete, sector-specific next steps",
      "Multilingual & voice-ready for low-literacy last-mile use",
    ],
  },
  {
    icon: Building2,
    kicker: "For field officers",
    title: "See your whole portfolio's health at a glance",
    href: "/officer",
    cta: "Open officer view",
    features: [
      "Risk board — every enterprise ranked Low / Watch / High",
      "Drill into profiles, forecasts and the drivers behind each flag",
      "Credit-readiness pipeline: who's ready to graduate to formal credit",
      "Prioritised action queue for timely field intervention",
    ],
  },
];

export function Personas() {
  return (
    <section id="personas" className="mx-auto max-w-6xl px-6 py-28">
      <SectionHeading eyebrow="Two views, one platform" title="Built for both sides of the last mile" />
      <div className="mt-14 grid gap-5 md:grid-cols-2">
        {personas.map((p, i) => (
          <Reveal key={p.title} delay={i}>
            <div className="card-lg group flex h-full flex-col p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <p.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium uppercase tracking-wide text-ink-faint">{p.kicker}</span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-semibold text-ink">{p.title}</h3>
              <ul className="mt-5 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-deep"
              >
                {p.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
