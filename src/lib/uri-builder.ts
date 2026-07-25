export type EngineType = "pg" | "mysql" | "sqlite" | "cockroach" | "yugabyte";

export interface UriFields {
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
  path?: string;
}

export const ENGINE_OPTIONS: Array<{ value: EngineType; label: string; defaultPort: string }> = [
  { value: "pg", label: "PostgreSQL", defaultPort: "5432" },
  { value: "mysql", label: "MySQL", defaultPort: "3306" },
  { value: "sqlite", label: "SQLite", defaultPort: "" },
  { value: "cockroach", label: "CockroachDB", defaultPort: "26257" },
  { value: "yugabyte", label: "YugabyteDB", defaultPort: "5433" },
];

export function defaultPort(engine: EngineType): string {
  return ENGINE_OPTIONS.find((e) => e.value === engine)?.defaultPort ?? "";
}

/**
 * The engine name sqitch itself understands.
 *
 * Verified against sqitch 1.6.1: `cockroach` is a first-class engine (its
 * registry needs Cockroach-specific DDL, so deploying it through the `pg` engine
 * fails), whereas there is no `yugabyte` engine — YugabyteDB is driven through
 * `pg`.
 */
export function sqitchEngine(engine: EngineType): string {
  return engine === "yugabyte" ? "pg" : engine;
}

/** URI scheme sqitch expects for an engine (`db:<scheme>://…`). */
export function uriScheme(engine: EngineType): string {
  switch (engine) {
    case "mysql":
      return "mysql";
    case "sqlite":
      return "sqlite";
    case "cockroach":
      return "cockroach";
    default:
      // pg and yugabyte both use the pg scheme.
      return "pg";
  }
}

/** Suggested client executable per engine (used as a placeholder default). */
export function defaultClient(engine: EngineType): string {
  switch (engine) {
    case "mysql":
      return "mysql";
    case "sqlite":
      return "sqlite3";
    default:
      // pg / cockroach / yugabyte all use the psql client.
      return "psql";
  }
}

/**
 * Parse a sqitch target URI back into an engine + fields for editing. The
 * password is intentionally NOT returned — the field stays masked and the
 * existing value is preserved unless the user types a new one.
 */
export function parseUri(uri: string): { engine: EngineType; fields: UriFields } {
  if (uri.startsWith("db:sqlite:")) {
    return { engine: "sqlite", fields: { path: uri.slice("db:sqlite:".length) } };
  }
  const match = uri.match(
    /^db:(pg|mysql|cockroach):\/\/(?:([^:@/]+)(?::[^@/]+)?@)?([^:/]+)(?::(\d+))?\/(.+)$/,
  );
  if (!match) return { engine: "pg", fields: {} };
  const [, scheme, user, host, port, database] = match;
  const engine: EngineType =
    scheme === "mysql" ? "mysql" : scheme === "cockroach" ? "cockroach" : "pg";
  return { engine, fields: { host, port, database, user } };
}

/**
 * Construct a sqitch target URI for the given engine. CockroachDB has its own
 * scheme (db:cockroach://); YugabyteDB is driven through pg (db:pg://); mysql
 * uses db:mysql://; sqlite uses a file path. Credentials are only included when a
 * user is given (users are advised to prefer .pgpass / env vars over embedding
 * passwords).
 */
export function buildUri(engine: EngineType, fields: UriFields): string {
  if (engine === "sqlite") {
    return `db:sqlite:${fields.path || "/path/to/db.sqlite"}`;
  }
  const scheme = uriScheme(engine);
  const port = fields.port || defaultPort(engine);
  const host = fields.host || "localhost";
  const database = fields.database || "mydb";
  const credentials = fields.user
    ? `${fields.user}${fields.password ? `:${fields.password}` : ""}@`
    : "";
  return `db:${scheme}://${credentials}${host}:${port}/${database}`;
}
