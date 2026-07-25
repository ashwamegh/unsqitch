import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { closeApp, launchApp } from "./helpers";

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const result = await launchApp();
  app = result.app;
  page = result.page;
});

test.afterAll(async () => {
  await closeApp(app);
});

test("app launches and shows home view", async () => {
  await expect(page.locator("text=Welcome to UnSqitch")).toBeVisible({
    timeout: 10000,
  });
});

test("shows Open a Project button", async () => {
  await expect(page.locator('text="Open a Project"')).toBeVisible();
});

test.skip("shows New Project link", async () => {
  // Only visible when projects exist
});

test("sidebar shows UnSqitch branding when expanded", async () => {
  // The sidebar starts collapsed (icons only) on the home screen, so the
  // textual branding is revealed only after expanding it.
  await page.getByTitle("Expand Sidebar").first().click();
  await expect(page.locator('text="UnSqitch"').first()).toBeVisible();
});
