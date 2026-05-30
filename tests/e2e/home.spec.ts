import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './helpers';
import type { ElectronApplication, Page } from 'playwright';

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

test('app launches and shows home view', async () => {
  await expect(page.locator('text=Welcome to UnSqitch')).toBeVisible({ timeout: 10000 });
});

test('shows Open a Project button', async () => {
  await expect(page.locator('text="Open a Project"')).toBeVisible();
});

test.skip('shows New Project link', async () => {
  // Only visible when projects exist
});

test('sidebar shows UnSqitch branding', async () => {
  await expect(page.locator('text="UnSqitch"')).toBeVisible();
});
