#!/usr/bin/env node
/**
 * Captures the screenshots used by the GitHub wiki.
 *
 * Run against the built app (`bun run build` first, with the native module built for the
 * Electron ABI). It seeds a throwaway app database pointing at a demo Sqitch project, then
 * walks the UI and writes one PNG per view.
 *
 * Usage:
 *   node scripts/capture-screenshots.mjs <demo-project-dir> <output-dir>
 *
 * The database is a temp file, so the developer's real ~/.unsqitch/app.db is untouched and
 * the screenshots are identical whatever projects they happen to have open.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "playwright";

const projectPath = resolve(process.argv[2] ?? "/tmp/unsqitch-demo");
const outDir = resolve(process.argv[3] ?? "/tmp/wiki-shots");

if (!existsSync(join(projectPath, "sqitch.plan"))) {
  console.error(`No sqitch.plan in ${projectPath} — point this at a real Sqitch project.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const dbDir = mkdtempSync(join(tmpdir(), "unsqitch-shots-"));
const dbPath = join(dbDir, "app.db");
const env = { ...process.env, VITE_DEV_SERVER_URL: "", UNSQITCH_DB_PATH: dbPath };

const VIEWPORT = { width: 1440, height: 900 };

/** Launches the app; the first launch also creates the database schema. */
async function launch() {
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    env,
  });
  const page = await app.firstWindow({ timeout: 30000 });
  await page.setViewportSize(VIEWPORT);
  return { app, page };
}

/** Inserts the demo project so Home lists it — the real flow uses a native file dialog. */
function seedProject() {
  const sql = `INSERT OR REPLACE INTO projects (id, name, path, engine, lastOpened, changeCount)
    VALUES ('demo-orders-service', 'orders-service', '${projectPath}', 'sqlite', '${new Date(
      Date.UTC(2026, 0, 15, 9, 30),
    ).toISOString()}', 3);`;
  // bun ships SQLite, so this needs no native module and cannot clash with the Electron ABI.
  execFileSync(
    "bun",
    [
      "-e",
      `const { Database } = require("bun:sqlite");
    const db = new Database(${JSON.stringify(dbPath)});
    db.run(${JSON.stringify(sql)});
    db.close();`,
    ],
    { stdio: "inherit" },
  );
}

const shot = async (page, name) => {
  await page.waitForTimeout(700); // let data land and transitions settle
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`  ${name}.png`);
};

// First launch: create the schema, capture the empty state, then close.
{
  const { app, page } = await launch();
  await page.waitForTimeout(1200);
  await shot(page, "01-home-empty");
  await app.close();
}

seedProject();

// Second launch: the seeded project is listed, so every project view has real data.
const { app, page } = await launch();
await page.waitForTimeout(1200);
await shot(page, "02-home-with-project");

await page.getByText("orders-service", { exact: false }).first().click();
await page.waitForTimeout(1200);
await shot(page, "03-plan");

const sections = [
  ["Deploy", "04-deploy"],
  ["Status", "05-status"],
  ["Log", "06-log"],
  ["Revert", "07-revert"],
  ["Verify", "08-verify"],
  ["Target", "09-targets"],
  ["Engine", "10-engines"],
  ["Config", "11-config"],
];

for (const [label, file] of sections) {
  try {
    await page
      .getByRole("button", { name: new RegExp(`^${label}`, "i") })
      .first()
      .click();
    await shot(page, file);
  } catch (error) {
    console.error(`  skipped ${file}: ${String(error).split("\n")[0]}`);
  }
}

await app.close();
console.log(`\nScreenshots in ${outDir}`);
