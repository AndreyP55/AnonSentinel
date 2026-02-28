import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";
import axios from "axios";
import { getCached, setCache } from "../cache.js";
import { withRetry } from "../retry.js";

const SEARCH_URL = process.env.SEARCH_URL || "http://acpx.virtuals.io/api/agents/v5/search";
const AGENTS_API = "https://acpx.virtuals.io/api/agents";

interface AgentMetrics {
  successfulJobCount: number | null;
  successRate: number | null;
  uniqueBuyerCount: number | null;
  minsFromLastOnlineTime: number | null;
  isOnline: boolean;
}

interface AgentJob {
  name: string;
  description: string;
  price: number;
  priceV2: { type: string; value: number };
  requiredFunds: boolean;
}

interface Agent {
  id: number;
  name: string;
  description: string;
  walletAddress: string;
  tokenAddress: string | null;
  symbol: string | null;
  metrics: AgentMetrics;
  jobs: AgentJob[];
}

interface DigestEntry {
  agentName: string;
  agentWallet: string;
  isOnline: boolean;
  successRate: number | null;
  completedJobs: number | null;
  offerings: {
    name: string;
    description: string;
    price: string;
    requiredFunds: boolean;
  }[];
}

async function searchViaSearchAPI(query: string, topK: number): Promise<Agent[]> {
  const response = await axios.get<{ data: Agent[] }>(SEARCH_URL, {
    params: { query, claw: "true", topK: String(topK), searchMode: "hybrid" },
    timeout: 5000,
  });
  return response.data?.data ?? [];
}

async function searchViaFiltersAPI(query: string, topK: number): Promise<Agent[]> {
  const response = await axios.get(AGENTS_API, {
    params: {
      "filters[name][$containsi]": query,
      "pagination[pageSize]": String(topK),
    },
    timeout: 15000,
    headers: { Accept: "application/json", Origin: "https://agdp.io", Referer: "https://agdp.io/" },
  });
  const agents = response.data?.data ?? [];
  return agents.map((a: any) => ({
    id: a.id,
    name: a.name,
    description: a.description || "",
    walletAddress: a.walletAddress || "",
    tokenAddress: a.tokenAddress ?? null,
    symbol: a.symbol ?? null,
    metrics: {
      successfulJobCount: a.successfulJobCount ?? a.metrics?.successfulJobCount ?? null,
      successRate: a.successRate ?? a.metrics?.successRate ?? null,
      uniqueBuyerCount: a.uniqueBuyerCount ?? a.metrics?.uniqueBuyerCount ?? null,
      minsFromLastOnlineTime: null,
      isOnline: a.isOnline ?? false,
    },
    jobs: a.jobs ?? [],
  }));
}

async function searchMarketplace(query: string, topK: number): Promise<Agent[]> {
  // Quick attempt via Search API (5s timeout, no retry)
  try {
    const result = await searchViaSearchAPI(query, topK);
    if (result.length > 0) {
      console.log(`[offerings_digest] Search API OK for "${query}"`);
      return result;
    }
  } catch (err: any) {
    console.log(`[offerings_digest] Search API failed (${err?.response?.status ?? err?.code}), switching to filters API...`);
  }

  // Reliable fallback with retry
  try {
    return await withRetry(
      () => searchViaFiltersAPI(query, topK),
      `offerings_digest filters "${query}"`
    );
  } catch (err: any) {
    console.log(`[offerings_digest] Filters API also failed (${err?.response?.status ?? err?.code})`);
    throw err;
  }
}

function formatPrice(price: number, priceType?: string): string {
  if (priceType === "percentage") return `${(price * 100).toFixed(1)}% commission`;
  return `$${price.toFixed(2)} USDC`;
}

function buildDigestEntries(agents: Agent[], onlineOnly: boolean): DigestEntry[] {
  let filtered = agents.filter((a) => a.jobs && a.jobs.length > 0);
  if (onlineOnly) {
    filtered = filtered.filter((a) => a.metrics.isOnline);
  }

  return filtered.map((a) => ({
    agentName: a.name,
    agentWallet: a.walletAddress,
    isOnline: a.metrics.isOnline,
    successRate: a.metrics.successRate,
    completedJobs: a.metrics.successfulJobCount,
    offerings: a.jobs.map((j) => ({
      name: j.name,
      description: j.description,
      price: formatPrice(j.price, j.priceV2?.type),
      requiredFunds: j.requiredFunds,
    })),
  }));
}

function buildHumanSummary(query: string, entries: DigestEntry[], totalAgents: number): string {
  const lines: string[] = [];

  lines.push(`OFFERINGS DIGEST: "${query}"`);
  lines.push("=".repeat(40));
  lines.push(`Found ${entries.length} agents with ${entries.reduce((sum, e) => sum + e.offerings.length, 0)} total offerings`);

  if (entries.length === 0) {
    lines.push("\nNo agents with offerings found for this query.");
    lines.push("Try a broader search term or check agdp.io for the full marketplace.");
    lines.push("\n---");
    lines.push("Provided by AnonBase Sentinel");
    return lines.join("\n");
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const status = e.isOnline ? "ONLINE" : "offline";
    const rate = e.successRate != null ? `${e.successRate.toFixed(0)}% success` : "no data";
    const jobs = e.completedJobs != null ? `${e.completedJobs} jobs done` : "";

    lines.push(`\n${i + 1}. ${e.agentName} [${status}] — ${rate}${jobs ? `, ${jobs}` : ""}`);

    for (const o of e.offerings) {
      const funds = o.requiredFunds ? " [requires funds]" : "";
      lines.push(`   - ${o.name}: ${o.price}${funds}`);
      if (o.description) {
        const desc = o.description.length > 120 ? o.description.slice(0, 117) + "..." : o.description;
        lines.push(`     ${desc}`);
      }
    }
  }

  lines.push("\n--- How to hire ---");
  lines.push("Use: acp job create <wallet> <offering_name> --requirements '{...}'");
  lines.push("Or ask through Butler on app.virtuals.io");

  lines.push("\n---");
  lines.push("Provided by AnonBase Sentinel");

  return lines.join("\n");
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const query = request.query?.trim();
  if (!query) {
    return { deliverable: JSON.stringify({ error: "query is required", human_summary: "Error: No search query provided." }) };
  }

  const maxResults = Math.min(Math.max(request.maxResults ?? 10, 1), 20);
  const onlineOnly = request.onlineOnly ?? false;

  const cacheKey = { query: query.toLowerCase(), maxResults, onlineOnly };
  const cached = getCached("offerings_digest", cacheKey);
  if (cached) {
    return { deliverable: cached };
  }

  try {
    const agents = await searchMarketplace(query, maxResults);
    const entries = buildDigestEntries(agents, onlineOnly);

    const result = {
      query,
      totalAgentsSearched: agents.length,
      agentsWithOfferings: entries.length,
      totalOfferings: entries.reduce((sum, e) => sum + e.offerings.length, 0),
      onlineOnly,
      digest: entries,
      human_summary: buildHumanSummary(query, entries, agents.length),
    };

    const deliverable = JSON.stringify(result);
    setCache("offerings_digest", cacheKey, deliverable);
    return { deliverable };
  } catch (err: any) {
    return {
      deliverable: JSON.stringify({
        error: "digest_failed",
        message: err?.message ?? String(err),
        human_summary: `Failed to generate offerings digest: ${err?.message ?? String(err)}`,
      }),
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (!request.query || typeof request.query !== "string" || !request.query.trim()) {
    return { valid: false, reason: "query is required and must be a non-empty string" };
  }
  if (request.maxResults !== undefined && (typeof request.maxResults !== "number" || request.maxResults < 1)) {
    return { valid: false, reason: "maxResults must be a positive number" };
  }
  return { valid: true };
}

export function requestPayment(request: any): string {
  return `Preparing offerings digest for "${request.query}". Please proceed with payment.`;
}
