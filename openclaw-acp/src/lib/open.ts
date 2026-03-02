// =============================================================================
// Open a URL in the user's default browser. Platform-specific, no dependencies.
// Uses spawn (no shell) to prevent command injection via malicious URLs.
// =============================================================================

import { spawn } from "child_process";

export function openUrl(url: string): void {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Silently fail — the URL is always printed as fallback
  }
}
