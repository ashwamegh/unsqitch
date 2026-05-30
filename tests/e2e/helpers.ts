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
  const page = await app.firstWindow();
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
}
