import { describe, expect, it } from "vitest";
import { buildUri, defaultPort } from "../../src/lib/uri-builder";

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

  it("uses the pg scheme with cockroach/yugabyte default ports", () => {
    expect(buildUri("cockroach", { database: "app" })).toBe("db:pg://localhost:26257/app");
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
