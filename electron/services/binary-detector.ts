import { spawnSync } from "node:child_process";

const MINIMUM_VERSION = "1.0.0";

function compareSemver(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((aParts[i] || 0) > (bParts[i] || 0)) return 1;
    if ((aParts[i] || 0) < (bParts[i] || 0)) return -1;
  }
  return 0;
}

/**
 * Runs a binary with an argument array and returns its stdout, or null if it fails.
 *
 * Deliberately not execSync with an interpolated string: the path comes from the
 * Settings dialog, so a value containing a quote character would otherwise close the
 * quoting and let the rest run as shell commands. Wrapping it in double quotes is not
 * enough. This is the same rule sqitch.service.ts follows for every sqitch invocation.
 */
function runForOutput(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
  if (result.error || result.status !== 0 || !result.stdout) return null;
  return result.stdout.toString();
}

export function detectSqitchBinary(customPath?: string): string | null {
  if (customPath) {
    return runForOutput(customPath, ["--version"]) === null ? null : customPath;
  }

  const lookup = process.platform === "win32" ? "where" : "which";
  const found = runForOutput(lookup, ["sqitch"]);
  if (found === null) return null;

  const first = found.trim().split("\n")[0].trim();
  return first === "" ? null : first;
}

export function checkSqitchVersion(
  binaryPath: string,
): { version: string; meetsMinimum: boolean } | null {
  try {
    const output = runForOutput(binaryPath, ["--version"]);
    if (output === null) return null;
    const match = output.match(/(\d+\.\d+\.\d+)/);
    if (!match) return null;
    const version = match[1];
    return {
      version,
      meetsMinimum: compareSemver(version, MINIMUM_VERSION) >= 0,
    };
  } catch {
    return null;
  }
}
