import { execSync } from 'child_process';
import { existsSync } from 'fs';

const MINIMUM_VERSION = '1.0.0';

function findInPath(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const trimmed = result.trim();
    return trimmed && existsSync(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

export function detectSqitchBinary(customPath?: string): string | null {
  if (customPath && existsSync(customPath)) {
    return customPath;
  }

  const candidates = ['sqitch'];
  for (const candidate of candidates) {
    const found = findInPath(candidate);
    if (found) return found;
  }

  const commonPaths = [
    '/usr/local/bin/sqitch',
    '/usr/bin/sqitch',
    '/opt/homebrew/bin/sqitch',
    '/opt/local/bin/sqitch',
  ];
  for (const p of commonPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

function parseVersion(output: string): string | null {
  const match = output.match(/sqitch\s+\(App::Sqitch\)\s+v?([\d.]+)/i);
  if (match) return match[1];
  const loose = output.match(/v?([\d.]+)/);
  return loose ? loose[1] : null;
}

function versionMeetsMinimum(version: string, minimum: string): boolean {
  const vParts = version.split('.').map(Number);
  const mParts = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(vParts.length, mParts.length); i++) {
    const v = vParts[i] || 0;
    const m = mParts[i] || 0;
    if (v > m) return true;
    if (v < m) return false;
  }
  return true;
}

export function checkSqitchVersion(binaryPath: string): { version: string; meetsMinimum: boolean } | null {
  try {
    const output = execSync(`"${binaryPath}" --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const version = parseVersion(output);
    if (!version) return null;
    return {
      version,
      meetsMinimum: versionMeetsMinimum(version, MINIMUM_VERSION),
    };
  } catch {
    return null;
  }
}
