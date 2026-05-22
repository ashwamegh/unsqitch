# Plan 1: Scaffolding & Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Electron + React + TypeScript project with electron-vite, Tailwind, shadcn/ui, Zustand, better-sqlite3, xterm.js, and all dev tooling configured.

**Architecture:** electron-vite scaffold with main/preload/renderer entry points. Path aliases for shared IPC types. SQLite for app state. Vitest for testing.

**Tech Stack:** Electron 33+, React 18, TypeScript 5, Tailwind CSS v4, shadcn/ui, electron-vite, Zustand, better-sqlite3, xterm.js, Vitest, Playwright

---

### Task 1: Initialize electron-vite project

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `index.html`

- [ ] **Step 1: Scaffold electron-vite project**

```bash
cd /home/ashwaspare/Studio/labs/coding/unsqitch
npm create electron-vite@latest . -- --template react-ts
```

If the above command doesn't work, try: `npm create @quick-start/electron@latest . -- --template react-ts`

If prompted about existing directory, choose to proceed. This creates the base electron-vite React+TypeScript scaffold.

- [ ] **Step 2: Verify scaffold runs**

```bash
npm install
npm run dev
```

Expected: Electron window opens with default React app. Kill process after verifying.

- [ ] **Step 3: Commit scaffold**

```bash
git init
git add -A
git commit -m "chore: initialize electron-vite project with React+TS template"
```

---

### Task 2: Configure path aliases and TypeScript

**Files:**
- Modify: `tsconfig.node.json`
- Modify: `tsconfig.web.json`
- Modify: `electron.vite.config.ts`
- Create: `electron/shared/ipc-types.ts`

- [ ] **Step 1: Create shared IPC types directory**

```bash
mkdir -p electron/shared
```

- [ ] **Step 2: Create initial IPC types file**

Create `electron/shared/ipc-types.ts`:

```typescript
// Shared IPC channel definitions — imported by both main and renderer via path alias @shared

export type IpcChannel = string;

// Channels will be populated in later plans as services are built.
// For now, export the type so the alias is validated.
export type { IpcChannel };
```

- [ ] **Step 3: Add @shared path alias to tsconfig.node.json**

In `tsconfig.node.json`, add to `compilerOptions`:

```json
"paths": {
  "@shared": ["./electron/shared"],
  "@shared/*": ["./electron/shared/*"]
}
```

- [ ] **Step 4: Add @shared path alias to tsconfig.web.json**

In `tsconfig.web.json`, add to `compilerOptions`:

```json
"paths": {
  "@shared": ["./electron/shared"],
  "@shared/*": ["./electron/shared/*"]
}
```

- [ ] **Step 5: Configure electron-vite resolve alias**

In `electron.vite.config.ts`, add resolve alias for `@shared`:

```typescript
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('electron/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('electron/shared')
      }
    },
    plugins: [react()]
  }
});
```

- [ ] **Step 6: Verify alias works**

Add a temporary import in `electron/main.ts`:

```typescript
import type { IpcChannel } from '@shared/ipc-types';
```

Run `npm run dev` — should compile without errors. Remove the temporary import after verifying.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add @shared path alias for IPC types"
```

---

### Task 3: Install and configure Tailwind CSS v4 + shadcn/ui

**Files:**
- Modify: `package.json`
- Create/Modify: `src/assets/main.css`
- Create: `components.json`

- [ ] **Step 1: Install Tailwind CSS v4**

```bash
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Tailwind in electron.vite.config.ts**

Add `@tailwindcss/vite` plugin to the renderer config in `electron.vite.config.ts`:

```typescript
import tailwindcss from '@tailwindcss/vite';
// ... existing imports

// In renderer config:
plugins: [react(), tailwindcss()]
```

- [ ] **Step 3: Set up CSS entry point**

Replace contents of `src/assets/main.css` (or create it):

```css
@import "tailwindcss";
```

Import it in `src/main.tsx`:

```typescript
import './assets/main.css';
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: TypeScript, Default style, Slate base color, CSS variables yes. This creates `components.json` and `src/lib/utils.ts`.

- [ ] **Step 5: Verify Tailwind + shadcn work**

```bash
npm run dev
```

Expected: App renders with Tailwind styles applied. Kill process after verifying.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install Tailwind CSS v4 and shadcn/ui"
```

---

### Task 4: Install runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install zustand better-sqlite3 @xterm/xterm @xterm/addon-fit chokidar
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom electron-rebuild playwright @playwright/test
```

- [ ] **Step 3: Configure electron-rebuild as postinstall**

Add to `package.json` scripts:

```json
"postinstall": "electron-rebuild"
```

- [ ] **Step 4: Verify better-sqlite3 native build**

```bash
npm run postinstall
```

Expected: electron-rebuild compiles better-sqlite3 for Electron's Node ABI. No errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: install zustand, better-sqlite3, xterm.js, chokidar, test deps"
```

---

### Task 5: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    alias: {
      '@shared': resolve(__dirname, 'electron/shared')
    }
  }
});
```

- [ ] **Step 2: Create test setup file**

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Create test directory structure**

```bash
mkdir -p tests/unit tests/fixtures tests/integration tests/e2e
```

- [ ] **Step 4: Add test scripts to package.json**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "vitest run --config vitest.integration.config.ts",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Verify test runner**

Create `tests/unit/scaffold.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest with unit/integration/e2e structure"
```

---

### Task 6: Create project directory structure

**Files:**
- Create: directory structure as per spec

- [ ] **Step 1: Create all directories**

```bash
mkdir -p electron/services
mkdir -p src/pages/HomePage
mkdir -p src/pages/ProjectPage
mkdir -p src/components/layout
mkdir -p src/components/terminal
mkdir -p src/components/progress
mkdir -p src/components/shared
mkdir -p src/hooks
mkdir -p src/lib
mkdir -p src/types
mkdir -p tests/fixtures/test-project
mkdir -p tests/fixtures/sqitch-output
```

- [ ] **Step 2: Add .gitkeep to empty dirs**

```bash
for dir in electron/services src/pages/HomePage src/pages/ProjectPage src/components/layout src/components/terminal src/components/progress src/components/shared src/hooks src/types tests/fixtures/test-project tests/fixtures/sqitch-output; do
  touch "$dir/.gitkeep"
done
```

- [ ] **Step 3: Create placeholder files for key modules**

Create `src/lib/sqitch-parser.ts`:

```typescript
// sqitch stdout parser — implemented in Plan 2
export function parseSqitchOutput(_output: string): never {
  throw new Error('Not implemented');
}
```

Create `src/lib/plan-parser.ts`:

```typescript
// sqitch.plan file parser — implemented in Plan 2
export function parsePlanFile(_content: string): never {
  throw new Error('Not implemented');
}
```

Create `src/hooks/useIpc.ts`:

```typescript
// IPC hook — implemented in Plan 3
export function useIpc() {
  throw new Error('Not implemented');
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: create project directory structure with placeholder modules"
```

---

### Task 7: Create electron-builder config and Docker Compose

**Files:**
- Create: `electron-builder.yml`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create electron-builder.yml**

```yaml
appId: com.unsqitch.app
productName: UnSqitch
directories:
  buildResources: build
  output: dist
files:
  - out/**/*
  - "!out/renderer/**/*"
mac:
  category: public.app-category.developer-tools
  target:
    - dmg
    - zip
  universalBuild: true
linux:
  target:
    - AppImage
    - deb
  category: Development
win:
  target:
    - nsis
npmRebuild: true
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - '54231:5432'
    environment:
      POSTGRES_USER: sqitch
      POSTGRES_PASSWORD: sqitch
      POSTGRES_DB: sqitch_test
    volumes:
      - pgdata:/var/lib/postgresql/data

  mysql:
    image: mysql:8
    ports:
      - '33072:3306'
    environment:
      MYSQL_ROOT_PASSWORD: sqitch
      MYSQL_DATABASE: sqitch_test
      MYSQL_USER: sqitch
      MYSQL_PASSWORD: sqitch

  cockroach:
    image: cockroachdb/cockroach:latest
    ports:
      - '36257:26257'
    command: start-single-node --insecure
    volumes:
      - cockroachdata:/cockroach/cockroach-data

  yugabyte:
    image: yugabytedb/yugabyte:latest
    ports:
      - '54234:5433'
    command: bin/yugabyted start --daemon=false
    volumes:
      - yugabytedata:/home/yugabyte/yb_data

volumes:
  pgdata:
  cockroachdata:
  yugabytedata:
```

- [ ] **Step 3: Add Docker scripts to package.json**

```json
"docker:up": "docker compose up -d",
"docker:down": "docker compose down",
"docker:reset": "docker compose down -v && docker compose up -d"
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add electron-builder config and Docker Compose for test databases"
```