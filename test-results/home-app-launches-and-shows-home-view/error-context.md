# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> app launches and shows home view
- Location: tests/e2e/home.spec.ts:18:5

# Error details

```
TimeoutError: electronApplication.firstWindow: Timeout 30000ms exceeded while waiting for event "window"
```

```
TypeError: Cannot read properties of undefined (reading 'close')
```

# Test source

```ts
  1  | import { _electron as electron } from 'playwright';
  2  | import type { ElectronApplication, Page } from 'playwright';
  3  | 
  4  | export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  5  |   const app = await electron.launch({
  6  |     args: ['.'],
  7  |     env: {
  8  |       ...process.env,
  9  |       VITE_DEV_SERVER_URL: '',
  10 |     },
  11 |   });
  12 |   const page = await app.firstWindow();
  13 |   return { app, page };
  14 | }
  15 | 
  16 | export async function closeApp(app: ElectronApplication): Promise<void> {
> 17 |   await app.close();
     |             ^ TypeError: Cannot read properties of undefined (reading 'close')
  18 | }
  19 | 
```