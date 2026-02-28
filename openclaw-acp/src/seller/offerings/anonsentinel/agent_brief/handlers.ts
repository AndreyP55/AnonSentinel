import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";
import axios from "axios";
import { getCached, setCache } from "../cache.js";
import { withRetry } from "../retry.js";

const SEARCH_URL = process.env.SEARCH_URL || "http://acpx.virtuals.io/api/agents/v5/search";
const AGENTS_API = "https://acpx.virtuals.io/api/agents";
const METRICS_API = "https://acpx.virtuals.io/api/metrics/agent";

interface AgentMetrics {
  successfulJobCount: number | null;
  successRate: number | null;
  uniqueBuyerCount: number | null;
  minsFromLastOnlineTime: number | null;
  isOnline: boolean;
}

interface AgentJob {
  id: number;
  name: string;
  description: string;
  price: number;
  priceV2: { type: string; value: number };
  requiredFunds: boolean;
}

interface AgentResource {
  name: string;
  description?: string;
  url?: string;
}

interface Agent {
  id: number;
  name: string;
  description: string;
  walletAddress: string;
  tokenAddress: string | null;
  symbol: string | null;
  category: string | null;
  metrics: AgentMetrics;
  jobs: AgentJob[];
  resources: AgentResource[];
}

async function searchAgentViaSearchAPI(query: string): Promise<Agent | null> {
  const response = await axios.get<{ data: Agent[] }>(SEARCH_URL, {
    params: { query, claw: "true", topK: "3", searchMode: "hybrid" },
    timeout: 5000,
  });

  const agents = response.data?.data;
  if (!agents || agents.length === 0) return null;

  const exactMatch = agents.find(
    (a) => a.name.toLowerCase() === query.toLowerCase()
  );
  return exactMatch ?? agents[0];
}

async function searchAgentViaFiltersAPI(query: string): Promise<Agent | null> {
  const encoded = encodeURIComponent(query);
  const response = await axios.get(AGENTS_API, {
    params: { "filters[name][$containsi]": query, "pagination[pageSize]": "5" },
    timeout: 15000,
    headers: { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" },
  });

  const agents = response.data?.data;
  if (!agents || agents.length === 0) return null;

  const best = agents.find(
    (a: any) => a.name?.toLowerCase() === query.toLowerCase()
  ) ?? agents[0];

  if (best.id) {
    try {
      const metricsRes = await axios.get(`${METRICS_API}/${best.id}`, {
        timeout: 10000,
        headers: { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" },
      });
      const md = metricsRes.data?.data;
      if (md) {
        return {
          id: best.id,
          name: md.name || best.name,
          description: best.description || md.description || "",
          walletAddress: best.walletAddress || md.walletAddress || "",
          tokenAddress: best.tokenAddress ?? null,
          symbol: best.symbol ?? null,
          category: best.category ?? null,
          metrics: {
            successfulJobCount: md.successfulJobCount ?? null,
            successRate: md.successRate ?? null,
            uniqueBuyerCount: md.uniqueBuyerCount ?? null,
            minsFromLastOnlineTime: null,
            isOnline: md.isOnline ?? false,
          },
          jobs: best.jobs ?? [],
          resources: best.resources ?? [],
        };
      }
    } catch {
      // metrics endpoint failed, return basic data
    }
  }

  return {
    id: best.id,
    name: best.name,
    description: best.description || "",
    walletAddress: best.walletAddress || "",
    tokenAddress: best.tokenAddress ?? null,
    symbol: best.symbol ?? null,
    category: best.category ?? null,
    metrics: {
      successfulJobCount: best.successfulJobCount ?? null,
      successRate: best.successRate ?? null,
      uniqueBuyerCount: best.uniqueBuyerCount ?? null,
      minsFromLastOnlineTime: null,
      isOnline: false,
    },
    jobs: best.jobs ?? [],
    resources: best.resources ?? [],
  };
}

async function searchAgent(query: string): Promise<Agent | null> {
  // Strategy 1: Search API — one quick attempt (5s timeout, no retry)
  try {
    const result = await searchAgentViaSearchAPI(query);
    if (result) {
      console.log(`[agent_brief] Search API OK for "${query}"`);
      return result;
    }
  } catch (err: any) {
    console.log(`[agent_brief] Search API failed (${err?.response?.status ?? err?.code}), switching to filters API...`);
  }

  // Strategy 2: Filters API + Metrics API — reliable, with retry
  try {
    const result = await withRetry(
      () => searchAgentViaFiltersAPI(query),
      `agent_brief filters "${query}"`
    );
    if (result) return result;
  } catch (err: any) {
    console.log(`[agent_brief] Filters API also failed (${err?.response?.status ?? err?.code})`);
  }

  return null;
}

function formatPrice(price: number, priceType?: string): string {
  if (priceType === "percentage") return `${(price * 100).toFixed(1)}% commission`;
  return `$${price} USDC`;
}

function formatOnlineStatus(metrics: AgentMetrics): string {
  if (metrics.isOnline) return "Online now";
  if (metrics.minsFromLastOnlineTime == null) return "Unknown";
  const mins = metrics.minsFromLastOnlineTime;
  if (mins < 60) return `Last seen ${mins}m ago`;
  if (mins < 1440) return `Last seen ${Math.round(mins / 60)}h ago`;
  return `Last seen ${Math.round(mins / 1440)}d ago`;
}

function buildHumanSummary(agent: Agent): string {
  const lines: string[] = [];

  lines.push(`AGENT BRIEF: ${agent.name}`);
  lines.push("=".repeat(40));

  if (agent.description) {
    lines.push(`\n${agent.description}`);
  }

  lines.push(`\nStatus: ${formatOnlineStatus(agent.metrics)}`);
  lines.push(`Category: ${agent.category ?? "N/A"}`);
  lines.push(`Wallet: ${agent.walletAddress}`);

  if (agent.tokenAddress && agent.symbol) {
    lines.push(`Token: ${agent.symbol} (${agent.tokenAddress})`);
  } else {
    lines.push("Token: None");
  }

  const m = agent.metrics;
  lines.push("\n--- Performance ---");
  lines.push(`Jobs completed: ${m.successfulJobCount ?? "N/A"}`);
  lines.push(`Success rate: ${m.successRate != null ? `${m.successRate.toFixed(1)}%` : "N/A"}`);
  lines.push(`Unique buyers: ${m.uniqueBuyerCount ?? "N/A"}`);

  const jobs = agent.jobs ?? [];
  if (jobs.length > 0) {
    lines.push(`\n--- Offerings (${jobs.length}) ---`);
    for (const j of jobs) {
      const fee = formatPrice(j.price, j.priceV2?.type);
      const funds = j.requiredFunds ? " [requires funds]" : "";
      lines.push(`  - ${j.name}: ${fee}${funds}`);
      if (j.description) {
        lines.push(`    ${j.description}`);
      }
    }
  } else {
    lines.push("\nNo offerings registered.");
  }

  const resources = agent.resources ?? [];
  if (resources.length > 0) {
    lines.push(`\n--- Resources (${resources.length}) ---`);
    for (const r of resources) {
      lines.push(`  - ${r.name}${r.description ? `: ${r.description}` : ""}`);
    }
  }

  lines.push("\n---");
  lines.push("Provided by AnonBase Sentinel");

  return lines.join("\n");
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const agentName = request.agentName?.trim();
  if (!agentName) {
    return { deliverable: JSON.stringify({ error: "agentName is required", human_summary: "Error: No agent name provided." }) };
  }

  const cached = getCached("agent_brief", { agentName });
  if (cached) {
    return { deliverable: cached };
  }

  try {
    const agent = await searchAgent(agentName);

    if (!agent) {
      const notFound = {
        error: "agent_not_found",
        query: agentName,
        human_summary: `No agent found matching "${agentName}". Try a different name or keyword.`,
      };
      return { deliverable: JSON.stringify(notFound) };
    }

    const brief = {
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      walletAddress: agent.walletAddress,
      token: agent.tokenAddress ? { address: agent.tokenAddress, symbol: agent.symbol } : null,
      metrics: {
        isOnline: agent.metrics.isOnline,
        successfulJobs: agent.metrics.successfulJobCount,
        successRate: agent.metrics.successRate,
        uniqueBuyers: agent.metrics.uniqueBuyerCount,
        lastSeenMinutesAgo: agent.metrics.minsFromLastOnlineTime,
      },
      offerings: (agent.jobs ?? []).map((j) => ({
        name: j.name,
        description: j.description,
        price: j.price,
        priceType: j.priceV2?.type,
        requiredFunds: j.requiredFunds,
      })),
      resources: (agent.resources ?? []).map((r) => ({
        name: r.name,
        description: r.description,
        url: r.url,
      })),
      human_summary: buildHumanSummary(agent),
    };

    const deliverable = JSON.stringify(brief);
    setCache("agent_brief", { agentName }, deliverable);
    return { deliverable };
  } catch (err: any) {
    const errorMsg = err?.message ?? String(err);
    return {
      deliverable: JSON.stringify({
        error: "search_failed",
        message: errorMsg,
        human_summary: `Failed to retrieve agent brief: ${errorMsg}`,
      }),
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (!request.agentName || typeof request.agentName !== "string" || !request.agentName.trim()) {
    return { valid: false, reason: "agentName is required and must be a non-empty string" };
  }
  return { valid: true };
}

export function requestPayment(request: any): string {
  return `Preparing intelligence brief for agent "${request.agentName}". Please proceed with payment.`;
}
