import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, ".learning-cache.json");
const MAX_ENTRIES_PER_OFFERING = 100;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  key: string;
  offering: string;
  request: Record<string, any>;
  result: string;
  timestamp: number;
  hitCount: number;
}

interface CacheStore {
  entries: CacheEntry[];
  stats: { totalHits: number; totalMisses: number; totalSaves: number };
}

function loadCache(): CacheStore {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      return data as CacheStore;
    }
  } catch {
    // corrupted cache — start fresh
  }
  return { entries: [], stats: { totalHits: 0, totalMisses: 0, totalSaves: 0 } };
}

function saveCache(cache: CacheStore): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // non-fatal
  }
}

function buildCacheKey(offering: string, request: Record<string, any>): string {
  const sorted = Object.keys(request)
    .sort()
    .reduce((acc, key) => {
      acc[key] = typeof request[key] === "string" ? request[key].toLowerCase().trim() : request[key];
      return acc;
    }, {} as Record<string, any>);
  return `${offering}:${JSON.stringify(sorted)}`;
}

export function getCached(offering: string, request: Record<string, any>): string | null {
  const cache = loadCache();
  const key = buildCacheKey(offering, request);
  const now = Date.now();

  const entry = cache.entries.find(
    (e) => e.key === key && now - e.timestamp < CACHE_TTL_MS
  );

  if (entry) {
    entry.hitCount++;
    cache.stats.totalHits++;
    saveCache(cache);
    return entry.result;
  }

  cache.stats.totalMisses++;
  saveCache(cache);
  return null;
}

export function setCache(offering: string, request: Record<string, any>, result: string): void {
  const cache = loadCache();
  const key = buildCacheKey(offering, request);
  const now = Date.now();

  cache.entries = cache.entries.filter(
    (e) => !(e.key === key) && now - e.timestamp < CACHE_TTL_MS
  );

  cache.entries.push({
    key,
    offering,
    request,
    result,
    timestamp: now,
    hitCount: 0,
  });

  const offeringEntries = cache.entries.filter((e) => e.offering === offering);
  if (offeringEntries.length > MAX_ENTRIES_PER_OFFERING) {
    const toRemove = offeringEntries
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, offeringEntries.length - MAX_ENTRIES_PER_OFFERING);
    const removeKeys = new Set(toRemove.map((e) => e.key));
    cache.entries = cache.entries.filter((e) => !removeKeys.has(e.key));
  }

  cache.stats.totalSaves++;
  saveCache(cache);
}
