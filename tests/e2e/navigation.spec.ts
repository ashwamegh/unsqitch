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

test.skip('sidebar shows Development section labels when in project', async () => {
  // Requires a project to be open
});

test.skip('Show Commands toggle exists in sidebar', async () => {
  // Only visible in project view
});

test.skip('Settings button exists in sidebar', async () => {
  // Only visible in project view
});
