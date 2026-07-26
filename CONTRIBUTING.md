# Contributing to UnSqitch

Thanks for your interest in improving UnSqitch. This document covers everything you
need to get productive: how to run the app, how the code is organised, the quirks
worth knowing about, and what a good pull request looks like.

> Looking for how to **use** the app rather than change it? That is the
> [user guide in the wiki](https://github.com/ashwamegh/unsqitch/wiki) — a walkthrough of
> every view with screenshots, per-engine notes, and troubleshooting. Worth skimming before
> working on a view, so your change matches what the docs promise.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Getting set up

**Prerequisites**

| Tool | Notes |
| ---- | ----- |
| Bun 1.2+ | The only supported package manager. The version in [`.bun-version`](.bun-version) is what CI uses, and `bun install` refuses to run under npm or yarn. |
| Node.js 22+ | Still required alongside Bun: vitest, electron-vite, electron-builder, Playwright and `node-gyp` all execute on Node, and the native module is compiled against the ABI of the Node in [`.nvmrc`](.nvmrc) — which is not the Node version Bun bundles. |
| [Sqitch CLI](https://sqitch.org/download/) 1.0+ | The app shells out to it; without it, only the file-based views work. |
| Docker (optional) | Only needed for integration tests — see `docker-compose.yml`. |

```bash
git clone https://github.com/ashwamegh/unsqitch.git
cd unsqitch
bun install
bun run dev
```

`bun run dev` starts Vite plus Electron with hot reload. You do not need a database
to work on the Plan view, the setup views, or anything file-based.

### Working without a real project

Opening the renderer in a plain browser (`http://localhost:5173`) runs it against
[`src/mock-api.ts`](src/mock-api.ts) instead of Electron IPC, which is the quickest
way to iterate on UI. `tests/fixtures/test-project` is a real, deployable Sqitch
project used by the tests — point the app at it when you want the real thing.

---

## Architecture in one minute

```
Renderer (React + Zustand)  ←→  typed IPC  ←→  Main process services  ←→  sqitch CLI / files
```

- **`src/`** is the renderer. It never touches the filesystem or spawns processes; it
  only calls `window.unsqitch.*`. Pure logic (parsers, URI building, diffing) lives in
  `src/lib/` and is unit-tested directly.
- **`electron/`** is the main process. `electron/main.ts` registers one IPC handler per
  channel and delegates to a service in `electron/services/`.
- **`electron/shared/ipc-types.ts`** is the contract between the two. Adding a feature
  that needs the filesystem or the CLI means: channel → preload method → handler →
  service, and a mock in `src/mock-api.ts` so browser mode keeps working.
- **State** lives in two Zustand stores: `src/store/navigation.ts` (which view, UI
  toggles) and `src/store/project.ts` (project data, command events). They are kept in
  sync — opening a project sets both.

`docs/superpowers/specs/` holds the original design specification. It is a useful
reference, but where it disagrees with the real Sqitch CLI, **the CLI wins** — see
"Verify against real sqitch" below.

---

## Quirks worth knowing

### 1. The native module has two ABIs

`better-sqlite3` is compiled against whichever runtime loads it — **Node** for Vitest,
**Electron** for the app and E2E. You cannot satisfy both at once. The package scripts
handle it:

```bash
bun run test          # rebuilds for Node first (pretest hook)
bun run test:e2e      # rebuilds for Electron and builds the app first
bun run dev           # rebuilds for Electron (predev hook)
```

Use `bun run test`. Plain `bun test` starts Bun's own test runner, which ignores both
vitest and the `pretest` rebuild.

If you see a `NODE_MODULE_VERSION` mismatch, run `bun run rebuild:node` or
`bun run rebuild:electron` to match what you are about to do. Let the rebuild finish —
interrupting it can leave a corrupt binary that hangs on first use (delete
`node_modules/better-sqlite3/build` and rebuild if that happens).

Both rebuilds go through [`scripts/rebuild-native.mjs`](scripts/rebuild-native.mjs),
which exists because two failure modes here are silent:

- `@electron/rebuild` records the ABI it built for in `build/Release/.forge-meta` and
  skips the rebuild when it matches. A Node-ABI rebuild replaces the binary *without*
  updating that marker, so the next `electron-rebuild` reports "Rebuild Complete" and
  does nothing — and the app then dies on launch. The script deletes the build directory
  first, which removes the stale marker with it.
- Running the rebuild under Bun produces a binary for Bun's bundled Node ABI, which
  neither the project's Node nor Electron can load. The script is therefore invoked with
  `node`, and it spawns its children with the same interpreter.

After building, it loads the addon to confirm the ABI actually changed, so neither
failure can reach you as a mysterious crash later.

### 2. Verify against real sqitch, never against assumed output

Several early bugs came from parsers written against hand-written fixtures that did
not match what Sqitch actually prints. If you touch a parser:

1. Run the real command (`bun run docker:up` gives you databases).
2. Capture the output into `tests/fixtures/sqitch-output/`.
3. Assert against that fixture.

Known realities the parsers depend on: `sqitch status` prefixes every informational
line with `# ` and exits **1** when nothing is deployed; deploy/revert/verify lines are
dot-padded (`+ appschema ...... ok`) and may carry a tag (`+ users @v1.0.0 .. ok`);
`engine list` / `target list` print only names unless given `--verbose`.

### 3. Effects and unstable callbacks

Do not put a locally-defined handler in a `useEffect` dependency array — it is a new
function every render, so the effect re-runs, sets state, and loops. Depend on the
data instead. This froze the app once.

---

## Testing

| Layer | Command | What it covers |
| ----- | ------- | -------------- |
| Unit | `bun run test` | Parsers, services, stores, view routing. No external dependencies. |
| Integration | `bun run docker:up && bun run test:integration` | Real Sqitch commands against real databases. Skipped unless `RUN_INTEGRATION=1`. |
| E2E | `bun run test:e2e` | Playwright driving the built Electron app. |

```bash
bun run lint        # Biome (whole repo)
bun run lint:fix    # Biome with fixes
bun run typecheck   # tsc for main + renderer
```

Please add a test with any bug fix — ideally one that fails before your change. Tests
that encode a bug (asserting the broken behaviour) are worse than no test; if you find
one, fix it and say so in the commit body.

---

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), and **a scope is
mandatory** — commitlint rejects commits without one.

```
<type>(<scope>): <subject>

[body explaining why, wrapped at ~80 columns]
```

- Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `build`, `ci`.
- Subject: imperative, lower case, no trailing period, ≤ 150 characters.
- Use the body to explain **why** and what you verified — especially for anything
  behavioural. "Verified against PostgreSQL 16 in docker-compose" is exactly the kind
  of note that helps the next person.

Good: `fix(status): parse the "# "-prefixed format real sqitch emits`
Bad: `fix: bug` (no scope, says nothing)

Husky runs Biome and `typecheck` before each commit, and commitlint on the message.

---

## Pull requests

1. Branch from `main`.
2. Make sure `bun run lint`, `bun run typecheck` and `bun run test` all pass.
3. Fill in the PR template: what changed, why, and how you verified it.
4. If the change is user-visible, include a screenshot or a short clip.
5. Note anything you could **not** verify (a database you lack, an OS you cannot test)
   — an honest gap is far more useful than an implied guarantee.

Small, focused PRs get reviewed faster. If you are planning something large, open an
issue first so we can agree the approach before you write code.

---

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/ashwamegh/unsqitch/issues/new/choose).
For anything security-related, follow [SECURITY.md](SECURITY.md) instead of opening a
public issue.

When reporting a bug, the Sqitch version (`sqitch --version`), the engine, and the
exact command output from the Sqitch Output panel are almost always what we need.
