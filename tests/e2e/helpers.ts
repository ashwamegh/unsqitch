import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright";

const tempDbDirs: string[] = [];

/**
 * Launch the built app against a throwaway app database.
 *
 * Without this the suite reads the developer's real ~/.unsqitch/app.db, so
 * whichever projects they happen to have opened change what the Home view
 * renders (list vs. empty state) and the tests become machine-dependent.
 */
export async function launchApp(): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "unsqitch-e2e-"));
  tempDbDirs.push(dbDir);

  const app = await electron.launch({
    args: [
      ".",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-dev-shm-usage",
    ],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "",
      UNSQITCH_DB_PATH: path.join(dbDir, "app.db"),
    },
  });

  app.process().stdout?.on("data", (data) => {
    console.log(`[Electron Stdout] ${data.toString()}`);
  });

  app.process().stderr?.on("data", (data) => {
    console.error(`[Electron Stderr] ${data.toString()}`);
  });

  const page = await app.firstWindow({ timeout: 30000 });
  if (!page) {
    throw new Error("Electron app failed to open a window — check if display is available");
  }
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
  for (const dir of tempDbDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
