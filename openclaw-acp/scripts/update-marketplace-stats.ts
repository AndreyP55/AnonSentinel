#!/usr/bin/env npx tsx
/**
 * Fetches a sample of ACP marketplace agents and generates a stats snapshot.
 * Output: ../../marketplace-stats.json (repo root)
 *
 * Usage:
 *   npx tsx scripts/update-marketplace-stats.ts
 *
 * Schedule on VPS (cron every hour):
 *   0 * * * * cd /path/to/AnonSentinel/openclaw-acp && npx tsx scripts/update-marketplace-stats.ts
 */

import axios from "axios";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../../marketplace-stats.json");

const AGENTS_API = "https://acpx.virtuals.io/api/agents";
const SAMPLE_SIZE = 100;

interface AgentJob {
  name: string;
  description: string;
  price: number;
  priceV2?: { type: string; value: number };
}

interface Agent {
  id: number;
  name: string;
  category: string | null;
  isOnline: boolean;
  successfulJobCount: number | null;
  jobs: AgentJob[];
}

async function fetchAgents(): Promise<Agent[]> {
  const response = await axios.get(AGENTS_API, {
    params: { "pagination[pageSize]": String(SAMPLE_SIZE), "pagination[page]": "1" },
    timeout: 20000,
    headers: { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" },
  });
  return (response.data?.data ?? []) as Agent[];
}

function calcStats(agents: Agent[]) {
  const onlineAgents = agents.filter((a) => a.isOnline);

  // Category distribution
  const categoryCounts: Record<string, number> = {};
  for (const a of agents) {
    const cat = (a.category ?? "uncategorized").toLowerCase();
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Price stats (fixed-price jobs only)
  const prices: number[] = [];
  for (const a of agents) {
    for (const j of a.jobs ?? []) {
      if (j.priceV2?.type === "fixed" || (!j.priceV2 && j.price > 0)) {
        prices.push(j.price);
      }
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
          sampleSize: prices.length,
        }
      : null;

  // Agents with offerings count
  const agentsWithJobs = agents.filter((a) => (a.jobs ?? []).length > 0).length;

  // Top agents by completed jobs (preview, not full data)
  const topByJobs = agents
    .filter((a) => (a.successfulJobCount ?? 0) > 0)
    .sort((a, b) => (b.successfulJobCount ?? 0) - (a.successfulJobCount ?? 0))
    .slice(0, 3)
    .map((a) => ({ name: a.name, completedJobs: a.successfulJobCount }));

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: agents.length,
    totalAgentsInSample: agents.length,
    onlineCount: onlineAgents.length,
    onlinePercent: agents.length > 0 ? +(onlineAgents.length / agents.length * 100).toFixed(1) : 0,
    agentsWithOfferings: agentsWithJobs,
    topCategories,
    priceStats,
    topAgentsByJobs: topByJobs,
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
  const agents = await fetchAgents();
  console.log(`  Got ${agents.length} agents`);

  const stats = calcStats(agents);

  writeFileSync(OUTPUT_PATH, JSON.stringify(stats, null, 2));
  console.log(`Stats written to: ${OUTPUT_PATH}`);
  console.log(
    `  Online: ${stats.onlineCount}/${stats.totalAgentsInSample} (${stats.onlinePercent}%)`
  );
  console.log(`  Top categories: ${stats.topCategories.map((c) => c.name).join(", ")}`);
  if (stats.priceStats) {
    console.log(
      `  Prices: avg $${stats.priceStats.avg}, min $${stats.priceStats.min}, max $${stats.priceStats.max}`
    );
  }
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});
