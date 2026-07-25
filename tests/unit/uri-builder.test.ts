import { describe, expect, it } from "vitest";
import {
  buildUri,
  defaultClient,
  defaultPort,
  parseUri,
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
    });
  });
});
