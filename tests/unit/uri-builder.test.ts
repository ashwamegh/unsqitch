import { describe, expect, it } from "vitest";
import {
  buildUri,
  defaultClient,
  defaultPort,
  parseUri,
  passwordFrom,
  sqitchEngine,
} from "../../src/lib/uri-builder";

describe("buildUri", () => {
  it("builds a postgres URI with credentials and default port", () => {
    expect(
      buildUri("pg", { host: "db.example.com", database: "app", user: "joe", password: "s" }),
    ).toBe("db:pg://joe:s@db.example.com:5432/app");
  });

  it("omits credentials when no user is provided", () => {
    expect(buildUri("pg", { host: "localhost", database: "app" })).toBe(
      "db:pg://localhost:5432/app",
    );
  });

  it("uses the mysql scheme and default port", () => {
    expect(buildUri("mysql", { user: "root", database: "app" })).toBe(
      "db:mysql://root@localhost:3306/app",
    );
  });

  // Verified against sqitch 1.6.1: cockroach is its own engine/scheme, while
  // YugabyteDB is driven through pg.
  it("uses the cockroach scheme for CockroachDB", () => {
    expect(buildUri("cockroach", { database: "app" })).toBe("db:cockroach://localhost:26257/app");
  });

  it("uses the pg scheme for YugabyteDB", () => {
    expect(buildUri("yugabyte", { database: "app" })).toBe("db:pg://localhost:5433/app");
  });

  it("builds a sqlite file URI", () => {
    expect(buildUri("sqlite", { path: "/data/app.db" })).toBe("db:sqlite:/data/app.db");
  });

  it("honors an explicit port override", () => {
    expect(buildUri("pg", { host: "h", port: "6000", database: "d" })).toBe("db:pg://h:6000/d");
  });
});

describe("defaultPort", () => {
  it("returns per-engine defaults", () => {
    expect(defaultPort("pg")).toBe("5432");
    expect(defaultPort("mysql")).toBe("3306");
    expect(defaultPort("sqlite")).toBe("");
  });
});

describe("sqitchEngine", () => {
  it("keeps cockroach (a real sqitch engine) and maps only yugabyte to pg", () => {
    expect(sqitchEngine("cockroach")).toBe("cockroach");
    expect(sqitchEngine("yugabyte")).toBe("pg");
    expect(sqitchEngine("mysql")).toBe("mysql");
    expect(sqitchEngine("sqlite")).toBe("sqlite");
    expect(sqitchEngine("pg")).toBe("pg");
  });
});

describe("defaultClient", () => {
  it("returns the client executable per engine", () => {
    expect(defaultClient("pg")).toBe("psql");
    expect(defaultClient("cockroach")).toBe("psql");
    expect(defaultClient("mysql")).toBe("mysql");
    expect(defaultClient("sqlite")).toBe("sqlite3");
  });
});

describe("parseUri", () => {
  it("round-trips a pg URI without leaking the password", () => {
    const { engine, fields } = parseUri("db:pg://joe:secret@db.example.com:6000/app");
    expect(engine).toBe("pg");
    expect(fields).toMatchObject({
      host: "db.example.com",
      port: "6000",
      database: "app",
      user: "joe",
    });
    expect(fields.password).toBeUndefined();
  });

  it("parses a mysql URI", () => {
    expect(parseUri("db:mysql://root@localhost:3306/app")).toMatchObject({
      engine: "mysql",
      fields: { host: "localhost", port: "3306", database: "app", user: "root" },
    });
  });

  it("parses a cockroach URI back to the cockroach engine", () => {
    expect(parseUri("db:cockroach://root@127.0.0.1:36257/defaultdb")).toMatchObject({
      engine: "cockroach",
      fields: { host: "127.0.0.1", port: "36257", database: "defaultdb", user: "root" },
    });
  });

  it("parses a sqlite file URI", () => {
    expect(parseUri("db:sqlite:/data/app.db")).toEqual({
      engine: "sqlite",
      fields: { path: "/data/app.db" },
      parsed: true,
    });
  });

  /*
   * These URI forms are all accepted by sqitch but cannot be represented by the field
   * builder. They must report parsed: false, because a caller that rebuilds a URI from the
   * returned (empty) fields would replace a working target with the placeholder defaults
   * db:pg://localhost:5432/mydb — silently pointing it at a different database.
   */
  it.each([
    ["a URI with no authority", "db:pg:mydb"],
    ["an IPv6 literal host", "db:pg://[::1]:5432/app"],
    ["a URI with no database", "db:pg://localhost:5432"],
  ])("reports %s as unparsed rather than guessing", (_label, uri) => {
    const result = parseUri(uri);
    expect(result.parsed).toBe(false);
    expect(result.fields).toEqual({});
  });
});

describe("passwordFrom", () => {
  it("extracts the password so an edit can preserve it", () => {
    expect(passwordFrom("db:pg://joe:s3cret@host:5432/app")).toBe("s3cret");
    // Slashes and at-signs are legal in a password; a character class excluding them is
    // how the sibling redaction helper leaked credentials.
    expect(passwordFrom("db:mysql://root:pa/ss@host/app")).toBe("pa/ss");
    expect(passwordFrom("db:pg://joe:p@ss@host/app")).toBe("p@ss");
  });

  it("returns undefined when there is no password to preserve", () => {
    expect(passwordFrom("db:pg://joe@host:5432/app")).toBeUndefined();
    expect(passwordFrom("db:pg://host:5432/app")).toBeUndefined();
    expect(passwordFrom("db:sqlite:/data/app.db")).toBeUndefined();
  });
});
