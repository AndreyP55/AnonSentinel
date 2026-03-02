// =============================================================================
// acp resource query <url> [--params '<json>'] — Query a resource by URL
// =============================================================================

import axios from "axios";
import * as output from "../lib/output.js";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal"]);
const BLOCKED_PREFIXES = ["10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.", "169.254."];

function isSafeUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (BLOCKED_HOSTS.has(parsed.hostname)) return false;
    if (BLOCKED_PREFIXES.some((p) => parsed.hostname.startsWith(p))) return false;
    return true;
  } catch {
    return false;
  }
}

export async function query(url: string, params?: Record<string, any>): Promise<void> {
  if (!url) {
    output.fatal("Usage: acp resource query <url> [--params '<json>']");
  }

  try {
    new URL(url);
  } catch {
    output.fatal(`Invalid URL: ${url}`);
  }

  if (!isSafeUrl(url)) {
    output.fatal("URL points to a blocked or internal address.");
  }

  try {
    // Make HTTP request to resource URL
    output.log(`\nQuerying resource at: ${url}`);
    if (params && Object.keys(params).length > 0) {
      output.log(`  With params: ${JSON.stringify(params, null, 2)}\n`);
    } else {
      output.log("");
    }

    let response;
    try {
      // Always use GET request, params as query string
      if (params && Object.keys(params).length > 0) {
        // Build query string from params
        const queryString = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== null && value !== undefined) {
            queryString.append(key, String(value));
          }
        }
        const urlWithParams = url.includes("?")
          ? `${url}&${queryString.toString()}`
          : `${url}?${queryString.toString()}`;
        response = await axios.get(urlWithParams, { timeout: 30000 });
      } else {
        response = await axios.get(url, { timeout: 30000 });
      }
    } catch (httpError: any) {
      if (httpError.response) {
        // Server responded with error status
        const errorMsg = httpError.response.data
          ? JSON.stringify(httpError.response.data, null, 2)
          : httpError.response.statusText;
        output.fatal(
          `Resource query failed: ${httpError.response.status} ${httpError.response.statusText}\n${errorMsg}`
        );
      } else {
        output.fatal(
          `Resource query failed: ${
            httpError instanceof Error ? httpError.message : String(httpError)
          }`
        );
      }
    }

    const responseData = response.data;

    output.output(responseData, (data) => {
      output.heading(`Resource Query Result`);
      output.log(`\n  URL: ${url}`);
      output.log(`\n  Response:`);
      if (typeof data === "string") {
        output.log(`    ${data}`);
      } else {
        output.log(
          `    ${JSON.stringify(data, null, 2)
            .split("\n")
            .map((line, i) => (i === 0 ? line : `    ${line}`))
            .join("\n")}`
        );
      }
      output.log("");
    });
  } catch (e) {
    output.fatal(`Resource query failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
