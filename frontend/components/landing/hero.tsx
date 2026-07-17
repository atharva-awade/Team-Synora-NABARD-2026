"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ShieldCheck, WifiOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/ui/interactive";

const badges = [
  { icon: ShieldCheck, label: "PII-free by design" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Sparkles, label: "Explainable AI" },
];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const textY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-[100svh] overflow-hidden">
      {/* subtle grid texture over the global island backdrop */}
      <div className="grid-bg radial-fade absolute inset-0 -z-[1]" />

      {/* clean, contained legibility scrim behind the copy, no text glow, so
          the type stays crisp with no fuzzy halo, while the island reads clearly */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 58% 60% at 50% 46%, color-mix(in srgb, var(--bg) 66%, transparent) 0%, color-mix(in srgb, var(--bg) 30%, transparent) 48%, transparent 80%)",
        }}
      />

      {/* copy */}
      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative z-10 mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-4 py-1.5 text-xs font-medium text-ink-muted backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          NABARD Hackathon @ GFF 2026 · AI for Rural Finance
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-7xl"
        >
          See the cash flow
          <br />
          <span className="text-gradient-brand">before it happens.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7 }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted"
        >
          Pravah forecasts cash flow and flags financial stress for rural micro-enterprises -
          learning from UPI, market and climate signals, never personal data. Explainable,
          offline-first, built for the last mile.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Magnetic>
            <Button href="/app" size="lg">
              Explore the platform <ArrowRight className="h-4 w-4" />
            </Button>
          </Magnetic>
          <Magnetic>
            <Button href="#how" size="lg" variant="secondary">
              See how it works
            </Button>
          </Magnetic>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted"
        >
          {badges.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5">
              <b.icon className="h-4 w-4 text-brand" />
              {b.label}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* scroll cue */}
      <motion.div
        style={{ opacity: textOpacity }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-border-strong p-1.5">
          <motion.span
            className="h-1.5 w-1 rounded-full bg-ink-faint"
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          />
        </div>
      </motion.div>
    </section>
  );
}
