"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { ArrowRight, ShieldCheck, WifiOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/ui/interactive";

const VillageScene = dynamic(() => import("@/components/three/village-scene"), { ssr: false });

const badges = [
  { icon: ShieldCheck, label: "PII-free by design" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Sparkles, label: "Explainable AI" },
];

/**
 * Pinned hero stage. A tall section whose sticky inner viewport holds the 3D
 * canvas; scrolling the stage flies the camera through the solarpunk village.
 * The copy fades as the fly-through begins, and the canvas only renders while
 * the stage is on screen (frameloop gate) so the heavy scene never costs GPU on
 * the content sections below.
 */
export function HeroStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const scroll = useRef(0);
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [maxDpr, setMaxDpr] = useState(1.5);
  const [ready, setReady] = useState(false);

  const { scrollYProgress } = useScroll({ target: stageRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => (scroll.current = v));

  const copyOpacity = useTransform(scrollYProgress, [0, 0.16], [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.24], [0, -70]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMaxDpr(window.matchMedia("(max-width: 768px)").matches ? 1.5 : 2);
    setReady(true);
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={stageRef} className="relative h-[450vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* 3D fly-through */}
        <div className="absolute inset-0">
          {ready && <VillageScene scroll={scroll} active={active} reducedMotion={reduced} maxDpr={maxDpr} />}
        </div>

        {/* soft, contained glow only behind the copy column (no full-screen cloud) */}
        <motion.div
          style={{ opacity: copyOpacity }}
          className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[62vh] max-w-3xl -translate-y-1/2"
        >
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 45%, color-mix(in srgb, var(--bg) 55%, transparent), transparent 72%)",
            }}
          />
        </motion.div>

        {/* copy */}
        <motion.div
          style={{ opacity: copyOpacity, y: copyY }}
          className="relative z-10 mx-auto flex h-screen max-w-4xl flex-col items-center justify-center px-6 text-center"
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
            className="hero-glow font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-7xl"
          >
            See the cash flow
            <br />
            <span className="text-gradient-brand">before it happens.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="hero-glow-soft mt-6 max-w-2xl text-lg font-medium leading-relaxed text-ink"
          >
            Pravah forecasts cash flow and flags financial stress for rural micro-enterprises —
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
            className="hero-glow-soft mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink"
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
        <motion.div style={{ opacity: cueOpacity }} className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
          <div className="flex h-9 w-5 items-start justify-center rounded-full border border-border-strong p-1.5">
            <motion.span
              className="h-1.5 w-1 rounded-full bg-ink-faint"
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
