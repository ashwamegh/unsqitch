import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: '',
    },
  });
  const page = await app.firstWindow({ timeout: 30000 });
  if (!page) {
    throw new Error('Electron app failed to open a window — check if display is available');
  }
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
}
