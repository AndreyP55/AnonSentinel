// =============================================================================
// Dynamic loader for seller offerings.
// Offerings are stored per-agent: src/seller/offerings/<agent-name>/<offering>/
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import type { OfferingHandlers } from "./offeringTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** The parsed offering.json config. */

export interface OfferingConfig {
  name: string;
  description: string;
  jobFee: number;
  jobFeeType: "fixed" | "percentage";
  requiredFunds: boolean;
}

export interface LoadedOffering {
  config: OfferingConfig;
  handlers: OfferingHandlers;
}

function resolveOfferingsRoot(agentDirName: string): string {
  return path.resolve(__dirname, "..", "offerings", agentDirName);
}

/**
 * Load a named offering from `src/seller/offerings/<agentDirName>/<name>/`.
 * Expects `offering.json` and `handlers.ts` in that directory.
 */
function isValidOfferingName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export async function loadOffering(
  offeringName: string,
  agentDirName: string
): Promise<LoadedOffering> {
  if (!isValidOfferingName(offeringName)) {
    throw new Error(`Invalid offering name: "${offeringName}". Only alphanumeric, hyphens and underscores are allowed.`);
  }

  const offeringDir = path.resolve(resolveOfferingsRoot(agentDirName), offeringName);

  // offering.json
  const configPath = path.join(offeringDir, "offering.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`offering.json not found: ${configPath}`);
  }
  let config: OfferingConfig;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to parse offering.json at ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // handlers.ts (dynamically imported)
  const handlersPath = path.join(offeringDir, "handlers.ts");
  if (!fs.existsSync(handlersPath)) {
    throw new Error(`handlers.ts not found: ${handlersPath}`);
  }

  const handlers = (await import(pathToFileURL(handlersPath).href)) as OfferingHandlers;

  if (typeof handlers.executeJob !== "function") {
    throw new Error(`handlers.ts in "${offeringName}" must export an executeJob function`);
  }

  return { config, handlers };
}

/**
 * List all available offering names for a given agent.
 */
export function listOfferings(agentDirName: string): string[] {
  const offeringsRoot = resolveOfferingsRoot(agentDirName);
  if (!fs.existsSync(offeringsRoot)) return [];
  return fs
    .readdirSync(offeringsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
