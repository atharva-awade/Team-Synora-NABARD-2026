"use client";

import type { Bundle, EnterpriseDetail, PortfolioSummary } from "./types";

/**
 * Data source. The app is offline-first: it loads a precomputed bundle
 * (portfolio + per-enterprise detail + forecast params) so it runs fully
 * standalone on any static host. When a live backend is configured via
 * NEXT_PUBLIC_API_URL, that can be layered on for real-time data entry.
 */

let bundlePromise: Promise<Bundle> | null = null;

export function loadBundle(): Promise<Bundle> {
  if (!bundlePromise) {
    bundlePromise = fetch("/data/pravah_bundle.json", { cache: "force-cache" }).then((r) => {
      if (!r.ok) throw new Error("Failed to load Pravah data bundle");
      return r.json() as Promise<Bundle>;
    });
  }
  return bundlePromise;
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  return (await loadBundle()).portfolio;
}

export async function getEnterprise(id: string): Promise<EnterpriseDetail> {
  const b = await loadBundle();
  const detail = b.enterprises[id];
  if (!detail) throw new Error(`Enterprise ${id} not found`);
  return detail;
}
