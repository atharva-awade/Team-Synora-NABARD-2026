"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#novelty", label: "What's new" },
  { href: "#personas", label: "Personas" },
  { href: "#proof", label: "The model" },
];

export function Nav() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav className="glass flex w-full max-w-6xl items-center justify-between rounded-full border border-border px-4 py-2.5 shadow-[var(--shadow-sm)]">
        <Link href="/" aria-label="Pravah home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Button href="/app" size="sm" className="hidden sm:inline-flex">
            Open app
          </Button>
        </div>
      </nav>
    </motion.header>
  );
}
