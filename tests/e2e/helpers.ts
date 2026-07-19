import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright";

export async function launchApp(): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
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
}
