/**
 * Pure logic behind the production-dependency audit gate, kept separate from I/O so it
 * can be unit-tested. See scripts/audit-prod.mjs for why the gate works this way.
 *
 * These functions are security-relevant: a bug here makes the gate pass while shipped
 * code is vulnerable. An earlier version of resolveEntry treated an "@scope" as a path
 * segment, which truncated the dependency walk and hid vite, postcss and esbuild — the
 * three packages that actually had advisories — from the audit. Hence the tests.
 */

export const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, medium: 2, high: 3, critical: 4 };

/**
 * Drops the last package name from a nested bun.lock key:
 * "@electron/asar/minimatch" -> "@electron/asar" -> "".
 * A scoped package occupies two path segments, so this cannot just split on "/".
 */
export function parentKey(key) {
  const segments = key.split("/");
  const drop = segments.length >= 2 && segments[segments.length - 2].startsWith("@") ? 2 : 1;
  return segments.slice(0, segments.length - drop).join("/");
}

/**
 * Resolves a dependency name the way bun does: prefer an entry nested under the
 * requiring package, then successively shallower ancestors, then the hoisted entry.
 */
export function resolveEntry(packages, fromKey, name) {
  for (let scope = fromKey; scope !== ""; scope = parentKey(scope)) {
    const candidate = `${scope}/${name}`;
    if (packages[candidate]) return candidate;
  }
  return packages[name] ? name : null;
}

/**
 * Every package reachable from `roots`, as a Map of name -> Set of resolved versions.
 * Walks dependencies, optionalDependencies and peerDependencies, because a peer that is
 * actually installed still ends up in the shipped bundle.
 */
export function productionClosure(lock, roots) {
  const packages = lock.packages ?? {};
  const found = new Map();
  const seen = new Set();
  const queue = roots.map((name) => resolveEntry(packages, "", name)).filter(Boolean);

  while (queue.length > 0) {
    const key = queue.pop();
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = packages[key];
    if (!Array.isArray(entry)) continue;

    const spec = entry[0] ?? "";
    const at = spec.lastIndexOf("@");
    if (at > 0) {
      const name = spec.slice(0, at);
      if (!found.has(name)) found.set(name, new Set());
      found.get(name).add(spec.slice(at + 1));
    }

    const meta =
      entry.find((part) => part && typeof part === "object" && !Array.isArray(part)) ?? {};
    for (const group of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      for (const dep of Object.keys(meta[group] ?? {})) {
        const resolved = resolveEntry(packages, key, dep);
        if (resolved && !seen.has(resolved)) queue.push(resolved);
      }
    }
  }
  return found;
}

export function parseVersion(value) {
  const core = String(value).split(/[-+]/)[0];
  const parts = core.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
  while (parts.length < 3) parts.push(0);
  return parts;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

/** Evaluates npm advisory ranges such as ">=7.0.0 <7.28.0" or "<=5.0.7 || >=6.0.0 <6.2.1". */
export function satisfies(version, range) {
  if (!range) return false;
  return range.split("||").some((group) =>
    group
      .split(/[\s,]+/)
      .filter(Boolean)
      .every((clause) => {
        const match = clause.match(/^(<=|>=|<|>|=)?\s*v?(\d[^\s]*)$/);
        if (!match) return false;
        const cmp = compareVersions(version, match[2]);
        switch (match[1] ?? "=") {
          case "<":
            return cmp < 0;
          case "<=":
            return cmp <= 0;
          case ">":
            return cmp > 0;
          case ">=":
            return cmp >= 0;
          default:
            return cmp === 0;
        }
      }),
  );
}

/** Parses bun.lock, which is JSONC: trailing commas are legal. */
export function parseLockfile(text) {
  return JSON.parse(text.replace(/,(\s*[}\]])/g, "$1"));
}

/**
 * Advisories that affect a version actually present in the shipped closure, at or above
 * the given severity threshold.
 */
export function findExposures(advisories, shipped, threshold) {
  const exposures = [];
  for (const [name, list] of Object.entries(advisories)) {
    const versions = shipped.get(name);
    if (!versions) continue; // not shipped: dev-only dependency
    for (const advisory of list) {
      if ((SEVERITY_RANK[advisory.severity] ?? 0) < threshold) continue;
      const affected = [...versions].filter((v) => satisfies(v, advisory.vulnerable_versions));
      if (affected.length > 0) exposures.push({ name, versions: affected, ...advisory });
    }
  }
  return exposures;
}
