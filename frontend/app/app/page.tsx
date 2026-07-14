"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { EnterpriseDetailView } from "@/components/enterprise/detail";
import { loadBundle } from "@/lib/data";
import type { PortfolioCard } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function OwnerAppPage() {
  const { t } = useI18n();
  const [list, setList] = useState<PortfolioCard[]>([]);
  const [id, setId] = useState<string>("");

  useEffect(() => {
    loadBundle().then((b) => {
      const sorted = [...b.portfolio.enterprises].sort((a, c) => a.name.localeCompare(c.name));
      setList(sorted);
      // Default to a High-risk enterprise so the owner view showcases alerts.
      const featured = b.portfolio.enterprises.find((e) => e.risk_band === "High") ?? sorted[0];
      setId(featured?.id ?? "");
    });
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t("owner.title")}</h1>
          <p className="text-sm text-ink-muted">{t("owner.sub")}</p>
        </div>
        <label className="relative inline-flex items-center">
          <span className="sr-only">Select enterprise</span>
          <select
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="ring-focus appearance-none rounded-full border border-border bg-surface py-2.5 pl-4 pr-10 text-sm font-medium text-ink"
          >
            {list.map((e) => (
              <option key={e.id} value={e.id}>{e.name} · {e.sector_label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-ink-faint" />
        </label>
      </div>
      {id && <EnterpriseDetailView key={id} id={id} owner />}
    </AppShell>
  );
}
