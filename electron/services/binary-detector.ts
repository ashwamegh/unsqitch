import { execSync } from "child_process";

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

export function detectSqitchBinary(customPath?: string): string | null {
  if (customPath) {
    try {
      execSync(`"${customPath}" --version`, { stdio: "pipe" });
      return customPath;
    } catch {
      return null;
    }
  }

  try {
    const command =
      process.platform === "win32" ? "where sqitch" : "which sqitch";
    const result = execSync(command, { stdio: "pipe" }).toString().trim();
    return result.split("\n")[0].trim();
  } catch {
    return null;
  }
}

export function checkSqitchVersion(
  binaryPath: string,
): { version: string; meetsMinimum: boolean } | null {
  try {
    const output = execSync(`"${binaryPath}" --version`, {
      stdio: "pipe",
    }).toString();
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
