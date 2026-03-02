import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";
import axios from "axios";
import { getCached, setCache } from "../cache.js";
import { withRetry } from "../retry.js";

const SEARCH_URL = process.env.SEARCH_URL || "http://acpx.virtuals.io/api/agents/v5/search";
const AGENTS_API = "https://acpx.virtuals.io/api/agents";
const METRICS_API = "https://acpx.virtuals.io/api/metrics/agent";

interface AgentSnapshot {
  name: string;
  agentId: number | null;
  isOnline: boolean;
  successRate: number | null;
  completedJobs: number | null;
  uniqueBuyers: number | null;
  offeringCount: number;
  priceRange: string;
  token: string | null;
  walletAddress: string;
}

async function resolveAgent(query: string): Promise<AgentSnapshot | null> {
  let agent: any = null;

  try {
    const res = await axios.get<{ data: any[] }>(SEARCH_URL, {
      params: { query, claw: "true", topK: "3", searchMode: "hybrid" },
      timeout: 5000,
    });
    const agents = res.data?.data ?? [];
    agent = agents.find((a: any) => a.name?.toLowerCase() === query.toLowerCase()) ?? agents[0];
  } catch {
    // fallback
  }

  if (!agent) {
    try {
      const res = await withRetry(
        () => axios.get(AGENTS_API, {
          params: { "filters[name][$containsi]": query, "pagination[pageSize]": "3" },
          timeout: 15000,
          headers: { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" },
        }),
        `agent_compare resolve "${query}"`,
      );
      const agents = res.data?.data ?? [];
      agent = agents.find((a: any) => a.name?.toLowerCase() === query.toLowerCase()) ?? agents[0];
    } catch {
      return null;
    }
  }

  if (!agent) return null;

  let metrics: any = agent.metrics ?? {};
  if (agent.id) {
    try {
      const mr = await axios.get(`${METRICS_API}/${agent.id}`, {
        timeout: 10000,
        headers: { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" },
      });
      const md = mr.data?.data;
      if (md) {
        metrics = {
          successfulJobCount: md.successfulJobCount ?? null,
          successRate: md.successRate ?? null,
          uniqueBuyerCount: md.uniqueBuyerCount ?? null,
          isOnline: md.isOnline ?? false,
        };
      }
    } catch {
      // use basic metrics
    }
  }

  const jobs: any[] = agent.jobs ?? [];
  const prices = jobs.map((j: any) => j.price ?? 0).filter((p: number) => p > 0);
  const priceRange = prices.length > 0
    ? `$${Math.min(...prices).toFixed(2)} – $${Math.max(...prices).toFixed(2)}`
    : "N/A";

  return {
    name: agent.name,
    agentId: agent.id ?? null,
    isOnline: metrics.isOnline ?? agent.isOnline ?? false,
    successRate: metrics.successRate ?? agent.successRate ?? null,
    completedJobs: metrics.successfulJobCount ?? agent.successfulJobCount ?? null,
    uniqueBuyers: metrics.uniqueBuyerCount ?? agent.uniqueBuyerCount ?? null,
    offeringCount: jobs.length,
    priceRange,
    token: agent.symbol ? `$${agent.symbol}` : null,
    walletAddress: agent.walletAddress ?? "",
  };
}

function buildHumanSummary(snapshots: AgentSnapshot[]): string {
  const lines: string[] = [];

  lines.push("AGENT COMPARISON");
  lines.push("=".repeat(40));
  lines.push(`Comparing ${snapshots.length} agents\n`);

  const header = "| Agent | Status | Success | Jobs | Buyers | Offerings | Price Range | Token |";
  const divider = "|" + "---|".repeat(8);
  lines.push(header);
  lines.push(divider);

  for (const s of snapshots) {
    const status = s.isOnline ? "ONLINE" : "offline";
    const rate = s.successRate != null ? `${s.successRate.toFixed(0)}%` : "N/A";
    const jobs = s.completedJobs != null ? String(s.completedJobs) : "N/A";
    const buyers = s.uniqueBuyers != null ? String(s.uniqueBuyers) : "N/A";
    lines.push(`| ${s.name} | ${status} | ${rate} | ${jobs} | ${buyers} | ${s.offeringCount} | ${s.priceRange} | ${s.token ?? "None"} |`);
  }

  const online = snapshots.filter((s) => s.isOnline);
  const bestByRate = [...snapshots].sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0))[0];
  const bestByJobs = [...snapshots].sort((a, b) => (b.completedJobs ?? 0) - (a.completedJobs ?? 0))[0];

  lines.push("\n--- Quick Verdict ---");
  if (bestByRate) lines.push(`Highest success rate: ${bestByRate.name} (${bestByRate.successRate?.toFixed(0) ?? "N/A"}%)`);
  if (bestByJobs) lines.push(`Most jobs completed: ${bestByJobs.name} (${bestByJobs.completedJobs ?? "N/A"})`);
  lines.push(`Online now: ${online.length > 0 ? online.map((s) => s.name).join(", ") : "None"}`);

  lines.push("\n---");
  lines.push("Provided by AnonBase Sentinel");

  return lines.join("\n");
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const raw = request.agentIds?.trim();
  if (!raw) {
    return { deliverable: JSON.stringify({ error: "agentIds is required", human_summary: "Error: No agent IDs provided." }) };
  }

  const queries = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
  if (queries.length < 2 || queries.length > 5) {
    return {
      deliverable: JSON.stringify({
        error: "invalid_count",
        human_summary: `Please provide 2-5 agent names/IDs, separated by commas. You provided ${queries.length}.`,
      }),
    };
  }

  const cacheKey = { agentIds: queries.map((q: string) => q.toLowerCase()).sort().join(",") };
  const cached = getCached("agent_compare", cacheKey);
  if (cached) {
    return { deliverable: cached };
  }

  try {
    const results = await Promise.all(queries.map((q: string) => resolveAgent(q)));

    const snapshots: AgentSnapshot[] = [];
    const notFound: string[] = [];

    for (let i = 0; i < queries.length; i++) {
      if (results[i]) {
        snapshots.push(results[i]!);
      } else {
        notFound.push(queries[i]);
      }
    }

    const result = {
      compared: snapshots.length,
      notFound: notFound.length > 0 ? notFound : undefined,
      agents: snapshots,
      human_summary: buildHumanSummary(snapshots),
    };

    const deliverable = JSON.stringify(result);
    setCache("agent_compare", cacheKey, deliverable);
    return { deliverable };
  } catch (err: any) {
    return {
      deliverable: JSON.stringify({
        error: "compare_failed",
        message: err?.message ?? String(err),
        human_summary: `Failed to compare agents: ${err?.message ?? String(err)}`,
      }),
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (!request.agentIds || typeof request.agentIds !== "string" || !request.agentIds.trim()) {
    return { valid: false, reason: "agentIds is required (comma-separated names or IDs, 2-5 agents)" };
  }
  const count = request.agentIds.split(",").filter((s: string) => s.trim()).length;
  if (count < 2) return { valid: false, reason: "Provide at least 2 agents to compare" };
  if (count > 5) return { valid: false, reason: "Maximum 5 agents per comparison" };
  return { valid: true };
}

export function requestPayment(request: any): string {
  const count = request.agentIds?.split(",").filter((s: string) => s.trim()).length ?? 0;
  return `Comparing ${count} agents side-by-side. Please proceed with payment.`;
}
