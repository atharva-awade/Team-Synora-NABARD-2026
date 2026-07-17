"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useMotionValueEvent } from "motion/react";

const IslandScene = dynamic(() => import("@/components/three/island-scene"), { ssr: false });

/**
 * Fixed, full-page 3D backdrop for the landing route. The flying island stays
 * pinned to the viewport while the camera revolves around it as the whole page
 * scrolls. It is bright in the hero and eases to a faint ambient presence behind
 * the content sections so text stays readable. Landing-only, never mounted in
 * the dashboards.
 */
export function IslandBackdrop() {
  const scroll = useRef(0);
  const [reduced, setReduced] = useState(false);
  const [maxDpr, setMaxDpr] = useState(1.75);
  const [ready, setReady] = useState(false);

  const { scrollYProgress } = useScroll();
  useMotionValueEvent(scrollYProgress, "change", (v) => (scroll.current = v));

  // Bright in the hero → faint (but still orbiting) behind the content so text
  // stays clean while the island keeps revolving.
  const opacity = useTransform(scrollYProgress, [0, 0.12, 0.3], [1, 0.38, 0.15]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMaxDpr(window.matchMedia("(max-width: 768px)").matches ? 1.25 : 1.75);
    setReady(true);
  }, []);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity }}
    >
      {/* soft brand wash sitting under the scene */}
      <div className="absolute inset-0 bg-[radial-gradient(65%_55%_at_50%_35%,var(--brand-soft),transparent)]" />
      {ready && <IslandScene scroll={scroll} reducedMotion={reduced} maxDpr={maxDpr} />}
    </motion.div>
  );
}
