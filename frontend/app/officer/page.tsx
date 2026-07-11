"use client";

import { AppShell } from "@/components/app/app-shell";
import { PortfolioView } from "@/components/officer/portfolio";

export default function OfficerPage() {
  return (
    <AppShell>
      <PortfolioView />
    </AppShell>
  );
}
