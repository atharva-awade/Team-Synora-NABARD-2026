"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { LayoutGrid, UserRound } from "lucide-react";

const tabs = [
  { href: "/officer", labelKey: "nav.officer", icon: LayoutGrid },
  { href: "/app", labelKey: "nav.enterprise", icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-5">
            <Link href="/" aria-label="Home">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-1 rounded-full bg-surface-2 p-1 sm:flex">
              {tabs.map((tab) => {
                const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      active ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {t(tab.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
