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
 * Parse a sqitch target URI back into an engine + fields for editing. The password is
 * intentionally NOT returned, so it never reaches the form state; use passwordFrom() when
 * an existing target's URI has to be rebuilt without losing its credentials.
 *
 * `parsed` says whether the URI was actually understood. Callers must check it: sqitch
 * accepts forms this builder cannot represent (`db:pg:mydb`, IPv6 literals, a URI with no
 * database), and treating those as an empty field set silently rewrites a real target to
 * the placeholder defaults `db:pg://localhost:5432/mydb`.
 */
export function parseUri(uri: string): {
  engine: EngineType;
  fields: UriFields;
  parsed: boolean;
} {
  if (uri.startsWith("db:sqlite:")) {
    return { engine: "sqlite", fields: { path: uri.slice("db:sqlite:".length) }, parsed: true };
  }
  const match = uri.match(
    /^db:(pg|mysql|cockroach):\/\/(?:([^:@/]+)(?::[^@/]+)?@)?([^:/]+)(?::(\d+))?\/(.+)$/,
  );
  if (!match) return { engine: "pg", fields: {}, parsed: false };
  const [, scheme, user, host, port, database] = match;
  const engine: EngineType =
    scheme === "mysql" ? "mysql" : scheme === "cockroach" ? "cockroach" : "pg";
  return { engine, fields: { host, port, database, user }, parsed: true };
}

/**
 * The password embedded in a URI, if any.
 *
 * Exists so editing a target can preserve credentials that sqitch already stores: the
 * edit flow rebuilds the URI from form fields, and without this the rebuilt URI would
 * drop the password and quietly break the target. The value is only ever passed straight
 * back into a URI — it is not put into form state and not displayed.
 */
export function passwordFrom(uri: string): string | undefined {
  const schemeEnd = uri.indexOf("://");
  if (schemeEnd === -1) return undefined;

  // Split at the LAST "@", the same rule redactCommand uses. A character class that
  // excluded "/" would miss passwords containing a slash, which are legal and common.
  // The trade-off is that a URI with an "@" in its *path* is read as having userinfo;
  // that form is not a valid sqitch target URI, so it is not worth more machinery.
  const at = uri.lastIndexOf("@");
  if (at <= schemeEnd + 3) return undefined;

  const userinfo = uri.slice(schemeEnd + 3, at);
  const separator = userinfo.indexOf(":");
  return separator === -1 ? undefined : userinfo.slice(separator + 1);
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
