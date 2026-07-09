"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated light/dark toggle. A sliding sun/moon thumb with a soft glow and a
 * spring transition — light is the default state (thumb on the left / sun).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "ring-focus relative inline-flex h-9 w-16 items-center rounded-full border p-1 transition-colors duration-500",
        isDark ? "bg-surface-3 border-border-strong" : "bg-accent-soft border-border",
        className,
      )}
    >
      {/* track icons */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-ink-faint">
        <Sun className={cn("h-3.5 w-3.5 transition-opacity", isDark ? "opacity-40" : "opacity-0")} />
        <Moon className={cn("h-3.5 w-3.5 transition-opacity", isDark ? "opacity-0" : "opacity-40")} />
      </span>
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn(
          "relative z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md",
          isDark ? "ml-auto bg-brand text-white" : "bg-white text-accent-deep",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25 }}
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
