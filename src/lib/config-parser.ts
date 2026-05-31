import type { ConfigEntry } from "../types/config";

export function parseConfigList(output: string): ConfigEntry[] {
  const lines = output.split("\n");
  const entries: ConfigEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const keyPart = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);

    const parts = keyPart.split(".");
    let section: string;
    let subsection: string | undefined;
    let key: string;

    if (parts.length === 1) {
      continue;
    } else if (parts.length === 2) {
      section = parts[0];
      key = parts[1];
      subsection = undefined;
    } else {
      section = parts[0];
      subsection = parts.slice(1, -1).join(".");
      key = parts[parts.length - 1];
    }

    entries.push({ section, subsection, key, value });
  }

  return entries;
}
