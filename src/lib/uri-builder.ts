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
 * The engine name sqitch itself understands. CockroachDB and YugabyteDB speak
 * the Postgres wire protocol and use sqitch's `pg` engine, not their own name.
 */
export function sqitchEngine(engine: EngineType): string {
  return engine === "cockroach" || engine === "yugabyte" ? "pg" : engine;
}

/**
 * Construct a sqitch target URI for the given engine. Postgres-family engines
 * (pg / cockroach / yugabyte) share the db:pg:// scheme; mysql uses db:mysql://;
 * sqlite uses a file path. Credentials are only included when a user is given
 * (users are advised to prefer .pgpass / env vars over embedding passwords).
 */
export function buildUri(engine: EngineType, fields: UriFields): string {
  if (engine === "sqlite") {
    return `db:sqlite:${fields.path || "/path/to/db.sqlite"}`;
  }
  const scheme = engine === "mysql" ? "mysql" : "pg";
  const port = fields.port || defaultPort(engine);
  const host = fields.host || "localhost";
  const database = fields.database || "mydb";
  const credentials = fields.user
    ? `${fields.user}${fields.password ? `:${fields.password}` : ""}@`
    : "";
  return `db:${scheme}://${credentials}${host}:${port}/${database}`;
}
