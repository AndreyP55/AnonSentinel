#!/usr/bin/env npx tsx
/**
 * Fetches a sample of ACP marketplace agents and generates a stats snapshot.
 * Output: ../../marketplace-stats.json (repo root)
 *
 * Usage:
 *   npx tsx scripts/update-marketplace-stats.ts
 *
 * Auto-updated every 6 hours via GitHub Actions.
 */

import axios from "axios";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../../marketplace-stats.json");

const AGENTS_API = "https://acpx.virtuals.io/api/agents";
const SAMPLE_SIZE = 100; // API максимум на страницу
const HEADERS = { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" };

interface AgentJob {
  name: string;
  price: number;
  priceV2?: { type: string; value: number };
}

interface Agent {
  id: number;
  name: string;
  category: string | null;
  successfulJobCount: number | null;
  successRate: number | null;
  uniqueBuyerCount: number | null;
  lastActiveAt: string | null;
  jobs: AgentJob[];
}

interface FetchResult {
  agents: Agent[];
  totalAgents: number;
}

async function fetchAgents(): Promise<FetchResult> {
  const response = await axios.get(AGENTS_API, {
    params: { "pagination[pageSize]": String(SAMPLE_SIZE), "pagination[page]": "1" },
    timeout: 25000,
    headers: HEADERS,
  });
  const agents = (response.data?.data ?? []) as Agent[];
  const totalAgents: number = response.data?.meta?.pagination?.total ?? agents.length;
  return { agents, totalAgents };
}

function calcStats(agents: Agent[], totalAgents: number) {
  const now = Date.now();
  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const MS_30D = 30 * 24 * 60 * 60 * 1000;

  // Activity: agents active in last 7 / 30 days
  const activeIn7d = agents.filter(
    (a) => a.lastActiveAt && now - new Date(a.lastActiveAt).getTime() < MS_7D
  ).length;
  const activeIn30d = agents.filter(
    (a) => a.lastActiveAt && now - new Date(a.lastActiveAt).getTime() < MS_30D
  ).length;

  // Category distribution (exclude null → show as "other")
  const categoryCounts: Record<string, number> = {};
  let withCategory = 0;
  for (const a of agents) {
    if (a.category) {
      const cat = a.category.toLowerCase();
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      withCategory++;
    }
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // Price stats for fixed-price jobs
  const prices: number[] = [];
  for (const a of agents) {
    for (const j of a.jobs ?? []) {
      const val = j.priceV2?.type === "fixed" ? j.priceV2.value : j.price;
      if (val > 0) prices.push(val);
    }
  }
  prices.sort((a, b) => a - b);

  const priceStats =
    prices.length > 0
      ? {
          min: +prices[0].toFixed(4),
          max: +prices[prices.length - 1].toFixed(4),
          avg: +(prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(4),
          median: +prices[Math.floor(prices.length / 2)].toFixed(4),
          // Price tier distribution
          tiers: {
            "under_$0.10": prices.filter((p) => p < 0.1).length,
            "$0.10-$1": prices.filter((p) => p >= 0.1 && p < 1).length,
            "$1-$5": prices.filter((p) => p >= 1 && p < 5).length,
            "$5-$20": prices.filter((p) => p >= 5 && p < 20).length,
            "over_$20": prices.filter((p) => p >= 20).length,
          },
          sampleSize: prices.length,
        }
      : null;

  // Agents with offerings
  const agentsWithOfferings = agents.filter((a) => (a.jobs ?? []).length > 0).length;

  // Average success rate (among agents with jobs)
  const rates = agents
    .filter((a) => (a.successfulJobCount ?? 0) > 0 && a.successRate != null)
    .map((a) => a.successRate as number);
  const avgSuccessRate =
    rates.length > 0 ? +(rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(1) : null;

  // Top agents by completed jobs
  const topByJobs = agents
    .filter((a) => (a.successfulJobCount ?? 0) > 0)
    .sort((a, b) => (b.successfulJobCount ?? 0) - (a.successfulJobCount ?? 0))
    .slice(0, 10)
    .map((a) => ({
      name: a.name,
      completedJobs: a.successfulJobCount,
      successRate: a.successRate != null ? `${a.successRate}%` : null,
      uniqueBuyers: a.uniqueBuyerCount ?? 0,
      category: a.category?.toLowerCase() ?? null,
    }));

  // Top agents by unique buyers
  const topByBuyers = agents
    .filter((a) => (a.uniqueBuyerCount ?? 0) > 0)
    .sort((a, b) => (b.uniqueBuyerCount ?? 0) - (a.uniqueBuyerCount ?? 0))
    .slice(0, 5)
    .map((a) => ({
      name: a.name,
      uniqueBuyers: a.uniqueBuyerCount,
      completedJobs: a.successfulJobCount ?? 0,
    }));

  return {
    generatedAt: new Date().toISOString(),
    marketplace: {
      totalAgents,
      sampleSize: agents.length,
      agentsWithOfferings,
      agentsWithOfferingsPercent: +((agentsWithOfferings / agents.length) * 100).toFixed(1),
      categorizedAgentsPercent: +((withCategory / agents.length) * 100).toFixed(1),
    },
    activity: {
      activeIn7Days: activeIn7d,
      activeIn30Days: activeIn30d,
      activeIn7DaysPercent: +((activeIn7d / agents.length) * 100).toFixed(1),
      avgSuccessRate,
    },
    categories: topCategories,
    pricing: priceStats,
    topAgentsByJobs: topByJobs,
    topAgentsByBuyers: topByBuyers,
    cta: {
      note: "This is a free preview. For deeper analysis, use AnonSentinel paid offerings:",
      agentWallet: "0x67CD5FEeF4Bd8961f3Af80A096f273E575943a90",
      offerings: [
        { name: "agent_brief", price: "$0.05", description: "Full profile for any agent" },
        { name: "ecosystem_health_check", price: "$0.10", description: "Token risk & health score" },
        { name: "offerings_digest", price: "$0.15", description: "Curated marketplace search" },
      ],
    },
  };
}

async function main() {
  console.log("Fetching marketplace data...");
  const { agents, totalAgents } = await fetchAgents();
  console.log(`  Got ${agents.length} agents (total in marketplace: ${totalAgents})`);

  const stats = calcStats(agents, totalAgents);

  writeFileSync(OUTPUT_PATH, JSON.stringify(stats, null, 2));
  console.log(`Stats written to: ${OUTPUT_PATH}`);
  console.log(`  Total marketplace: ${stats.marketplace.totalAgents} agents`);
  console.log(`  With offerings: ${stats.marketplace.agentsWithOfferings} (${stats.marketplace.agentsWithOfferingsPercent}%)`);
  console.log(`  Active in 7d: ${stats.activity.activeIn7Days} (${stats.activity.activeIn7DaysPercent}%)`);
  console.log(`  Avg success rate: ${stats.activity.avgSuccessRate ?? "n/a"}%`);
  if (stats.pricing) {
    console.log(`  Prices: avg $${stats.pricing.avg}, min $${stats.pricing.min}, max $${stats.pricing.max}`);
  }
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});
