"use client";

import { useI18n, LANGS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-surface-2 p-1" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.label}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            lang === l.code ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-muted hover:text-ink",
          )}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}
