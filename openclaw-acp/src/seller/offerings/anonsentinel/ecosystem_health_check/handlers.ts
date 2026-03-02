import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";
import { getCached, setCache } from "../cache.js";
import { withRetry } from "../retry.js";

// ---------------------------------------------------------------------------
// Unified pair shape used by scoring / formatting
// ---------------------------------------------------------------------------
interface TokenPair {
  source: "codex" | "dexscreener";
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  txns: { h24: { buys: number; sells: number } };
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairCreatedAt: number;
}

// ---------------------------------------------------------------------------
// Codex API (powers Defined.fi) — sees bonding‑curve pairs that DEXScreener misses
// ---------------------------------------------------------------------------
const CODEX_GQL = "https://graph.codex.io/graphql";
const BASE_NETWORK_ID = 8453;

function getCodexApiKey(): string | undefined {
  return process.env.CODEX_API_KEY;
}

const CODEX_QUERY = `
query FilterPairs($tokenAddress: String!) {
  filterPairs(
    filters: {}
    pairs: [$tokenAddress]
    statsType: UNFILTERED
  ) {
    results {
      createdAt
      lastTransaction
      buyCount24
      sellCount24
      highPriceUsd24
      liquidity
      marketCap
      pair {
        address
        networkId
        token0 { address name symbol }
        token1 { address name symbol }
        createdAt
        exchangeHash
      }
      priceUsd
      priceChange24
      volumeUSD24
      exchange {
        name
      }
    }
  }
}`;

interface CodexPairResult {
  createdAt: number;
  lastTransaction: number;
  buyCount24: number;
  sellCount24: number;
  liquidity: number;
  marketCap: number;
  priceUsd: number;
  priceChange24: number;
  volumeUSD24: number;
  pair: {
    address: string;
    networkId: number;
    token0: { address: string; name: string; symbol: string };
    token1: { address: string; name: string; symbol: string };
    createdAt: number;
    exchangeHash: string;
  };
  exchange: { name: string } | null;
}

function codexToTokenPair(r: CodexPairResult, tokenAddress: string): TokenPair {
  const addr = tokenAddress.toLowerCase();
  const isToken0 = r.pair.token0.address.toLowerCase() === addr;
  const base = isToken0 ? r.pair.token0 : r.pair.token1;
  const quote = isToken0 ? r.pair.token1 : r.pair.token0;

  return {
    source: "codex",
    chainId: "base",
    dexId: r.exchange?.name ?? "Unknown",
    pairAddress: r.pair.address,
    baseToken: base,
    quoteToken: quote,
    priceUsd: String(r.priceUsd ?? 0),
    txns: { h24: { buys: r.buyCount24 ?? 0, sells: r.sellCount24 ?? 0 } },
    volume: { h24: r.volumeUSD24 ?? 0 },
    priceChange: { h24: r.priceChange24 ?? 0 },
    liquidity: { usd: r.liquidity ?? 0 },
    fdv: r.marketCap ?? 0,
    pairCreatedAt: (r.pair.createdAt ?? 0) * 1000,
  };
}

async function fetchFromCodex(tokenAddress: string): Promise<TokenPair[] | null> {
  const apiKey = getCodexApiKey();
  if (!apiKey) return null;

  try {
    const res = await withRetry(async () => {
      const r = await fetch(CODEX_GQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({
          query: CODEX_QUERY,
          variables: { tokenAddress: `${tokenAddress}:${BASE_NETWORK_ID}` },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        const err: any = new Error(`Codex returned ${r.status}`);
        err.status = r.status;
        throw err;
      }
      return r;
    }, "codex filterPairs");

    const json = await res.json() as any;
    const results: CodexPairResult[] = json?.data?.filterPairs?.results ?? [];
    if (results.length === 0) return null;

    return results.map((r) => codexToTokenPair(r, tokenAddress));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DEXScreener API — fallback, good for graduated tokens on Uniswap etc.
// ---------------------------------------------------------------------------
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
  };
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairCreatedAt: number;
}

function dexScreenerToTokenPair(p: DexScreenerPair): TokenPair {
  return {
    source: "dexscreener",
    chainId: p.chainId,
    dexId: p.dexId,
    pairAddress: p.pairAddress,
    baseToken: p.baseToken,
    quoteToken: p.quoteToken,
    priceUsd: p.priceUsd,
    txns: { h24: { buys: p.txns?.h24?.buys ?? 0, sells: p.txns?.h24?.sells ?? 0 } },
    volume: { h24: p.volume?.h24 ?? 0 },
    priceChange: { h24: p.priceChange?.h24 ?? 0 },
    liquidity: { usd: p.liquidity?.usd ?? 0 },
    fdv: p.fdv ?? 0,
    pairCreatedAt: p.pairCreatedAt ?? 0,
  };
}

async function fetchFromDexScreener(tokenAddress: string): Promise<TokenPair[] | null> {
  try {
    const response = await withRetry(async () => {
      const res = await fetch(`${DEXSCREENER_API}/${tokenAddress}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504)) {
        const err: any = new Error(`DEXScreener returned ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res;
    }, "dexscreener token");

    if (!response.ok) return null;

    const data = await response.json() as { pairs?: DexScreenerPair[] };
    if (!data.pairs || data.pairs.length === 0) return null;

    const basePairs = data.pairs.filter((p) => p.chainId === "base");
    const candidates = basePairs.length > 0 ? basePairs : data.pairs;

    return candidates.map(dexScreenerToTokenPair);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Unified fetch: Codex first, DEXScreener fallback, merge & pick best pair
// ---------------------------------------------------------------------------
function scorePair(p: TokenPair): number {
  const liq = p.liquidity?.usd ?? 0;
  const vol = p.volume?.h24 ?? 0;
  return liq * 0.6 + vol * 0.4;
}

async function fetchTokenData(tokenAddress: string): Promise<TokenPair | null> {
  const [codexPairs, dexPairs] = await Promise.all([
    fetchFromCodex(tokenAddress),
    fetchFromDexScreener(tokenAddress),
  ]);

  const allPairs: TokenPair[] = [
    ...(codexPairs ?? []),
    ...(dexPairs ?? []),
  ];

  if (allPairs.length === 0) return null;

  return allPairs.sort((a, b) => scorePair(b) - scorePair(a))[0];
}

// ---------------------------------------------------------------------------
// Health scoring
// ---------------------------------------------------------------------------
function calculateHealthScore(pair: TokenPair): { score: number; flags: string[] } {
  let score = 50;
  const flags: string[] = [];

  const liqUsd = pair.liquidity?.usd ?? 0;
  if (liqUsd >= 100000) { score += 15; }
  else if (liqUsd >= 50000) { score += 10; }
  else if (liqUsd >= 10000) { score += 5; }
  else if (liqUsd < 5000) { score -= 15; flags.push("VERY_LOW_LIQUIDITY"); }
  else { score -= 5; flags.push("LOW_LIQUIDITY"); }

  const vol24 = pair.volume?.h24 ?? 0;
  if (vol24 >= 100000) { score += 10; }
  else if (vol24 >= 10000) { score += 5; }
  else if (vol24 < 1000) { score -= 10; flags.push("LOW_VOLUME"); }

  const txns24 = (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0);
  if (txns24 >= 500) { score += 5; }
  else if (txns24 < 50) { score -= 5; flags.push("LOW_ACTIVITY"); }

  const buys24 = pair.txns?.h24?.buys ?? 0;
  const sells24 = pair.txns?.h24?.sells ?? 0;
  if (sells24 > 0 && buys24 > 0) {
    const ratio = buys24 / sells24;
    if (ratio < 0.3) { score -= 10; flags.push("HEAVY_SELLING"); }
    else if (ratio > 3) { score += 5; }
  }

  const priceChange24 = pair.priceChange?.h24 ?? 0;
  if (priceChange24 < -30) { score -= 10; flags.push("SHARP_DECLINE"); }
  else if (priceChange24 < -10) { score -= 5; }
  else if (priceChange24 > 50) { flags.push("HIGH_VOLATILITY"); }

  const ageMs = Date.now() - (pair.pairCreatedAt || Date.now());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays >= 30) { score += 5; }
  else if (ageDays < 1) { score -= 10; flags.push("VERY_NEW_TOKEN"); }
  else if (ageDays < 7) { score -= 5; flags.push("NEW_TOKEN"); }

  return { score: Math.max(0, Math.min(100, score)), flags };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function buildHumanSummary(pair: TokenPair, score: number, flags: string[]): string {
  const lines: string[] = [];
  const ageMs = Date.now() - (pair.pairCreatedAt || Date.now());
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  lines.push(`ECOSYSTEM HEALTH CHECK: ${pair.baseToken.symbol}`);
  lines.push("=".repeat(40));
  lines.push(`Token: ${pair.baseToken.name} (${pair.baseToken.symbol})`);
  lines.push(`Pair: ${pair.baseToken.symbol}/${pair.quoteToken.symbol} on ${pair.dexId}`);
  lines.push(`Pair Address: ${pair.pairAddress}`);
  lines.push(`Price: $${pair.priceUsd}`);
  lines.push(`Chain: ${pair.chainId}`);
  lines.push(`Data Source: ${pair.source === "codex" ? "Codex (Defined.fi)" : "DEXScreener"}`);
  lines.push(`Age: ${ageDays} days`);

  lines.push("\n--- Health Score ---");
  const grade = score >= 80 ? "HEALTHY" : score >= 60 ? "MODERATE" : score >= 40 ? "CAUTION" : "HIGH RISK";
  lines.push(`Score: ${score}/100 (${grade})`);

  if (flags.length > 0) {
    lines.push(`Flags: ${flags.join(", ")}`);
  }

  lines.push("\n--- Metrics ---");
  lines.push(`Liquidity: ${formatUsd(pair.liquidity?.usd ?? 0)}`);
  lines.push(`24h Volume: ${formatUsd(pair.volume?.h24 ?? 0)}`);
  lines.push(`FDV: ${formatUsd(pair.fdv ?? 0)}`);

  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;
  lines.push(`24h Transactions: ${buys + sells} (${buys} buys / ${sells} sells)`);
  lines.push(`24h Price Change: ${(pair.priceChange?.h24 ?? 0).toFixed(2)}%`);

  let recommendation: string;
  if (score >= 80) recommendation = "Token appears healthy. Standard monitoring recommended.";
  else if (score >= 60) recommendation = "Some concerns noted. Monitor closely.";
  else if (score >= 40) recommendation = "Multiple risk factors detected. Exercise caution.";
  else recommendation = "Significant risks identified. Thorough due diligence required.";

  lines.push(`\nRecommendation: ${recommendation}`);
  lines.push("\n---");
  lines.push("Provided by AnonBase Sentinel");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Job execution
// ---------------------------------------------------------------------------
export async function executeJob(request: any): Promise<ExecuteJobResult> {
  const tokenAddress = request.tokenAddress?.trim();
  if (!tokenAddress) {
    return { deliverable: JSON.stringify({ error: "tokenAddress is required", human_summary: "Error: No token address provided." }) };
  }

  const cached = getCached("ecosystem_health_check", { tokenAddress });
  if (cached) {
    return { deliverable: cached };
  }

  try {
    const pair = await fetchTokenData(tokenAddress);

    if (!pair) {
      return {
        deliverable: JSON.stringify({
          error: "token_not_found",
          tokenAddress,
          human_summary: `No trading data found for token ${tokenAddress}. It may not be listed on any DEX yet.`,
        }),
      };
    }

    const { score, flags } = calculateHealthScore(pair);

    const result = {
      tokenAddress,
      token: { name: pair.baseToken.name, symbol: pair.baseToken.symbol },
      chain: pair.chainId,
      dex: pair.dexId,
      pairAddress: pair.pairAddress,
      dataSource: pair.source === "codex" ? "Codex (Defined.fi)" : "DEXScreener",
      priceUsd: pair.priceUsd,
      healthScore: score,
      flags,
      metrics: {
        liquidityUsd: pair.liquidity?.usd ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        fdv: pair.fdv ?? 0,
        txns24h: { buys: pair.txns?.h24?.buys ?? 0, sells: pair.txns?.h24?.sells ?? 0 },
        priceChange24h: pair.priceChange?.h24 ?? 0,
        pairAgeDays: Math.floor((Date.now() - (pair.pairCreatedAt || Date.now())) / (1000 * 60 * 60 * 24)),
      },
      human_summary: buildHumanSummary(pair, score, flags),
    };

    const deliverable = JSON.stringify(result);
    setCache("ecosystem_health_check", { tokenAddress }, deliverable);
    return { deliverable };
  } catch (err: any) {
    return {
      deliverable: JSON.stringify({
        error: "health_check_failed",
        message: err?.message ?? String(err),
        human_summary: `Failed to perform health check: ${err?.message ?? String(err)}`,
      }),
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (!request.tokenAddress || typeof request.tokenAddress !== "string") {
    return { valid: false, reason: "tokenAddress is required and must be a string" };
  }
  const addr = request.tokenAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    return { valid: false, reason: "tokenAddress must be a valid EVM address (0x + 40 hex chars)" };
  }
  return { valid: true };
}

export function requestPayment(request: any): string {
  return `Running health check for token ${request.tokenAddress}. Please proceed with payment.`;
}
