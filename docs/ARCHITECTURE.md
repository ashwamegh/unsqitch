# Architecture

UnSqitch is an Electron app that drives the [Sqitch](https://sqitch.org/) CLI. It owns no
migration logic of its own: Sqitch remains the source of truth for the plan, the
registry and the database, and UnSqitch's job is to make that state legible and the
commands safe to run.

```
┌──────────────────────────────┐
│ Renderer  (src/)             │   React + Zustand + Tailwind
│  views · stores · lib        │   no fs, no child processes
└──────────────┬───────────────┘
               │  window.unsqitch.*  (contextBridge)
               │  channels in electron/shared/ipc-types.ts
┌──────────────┴───────────────┐
│ Main process  (electron/)    │   IPC handlers → services
│  services · file watcher     │
└──────────────┬───────────────┘
               │  spawn(argv)                 read/write
      ┌────────┴─────────┐          ┌─────────┴──────────┐
      │  sqitch CLI      │          │ project files      │
      │  → database      │          │ sqitch.conf/plan   │
      └──────────────────┘          └────────────────────┘
```

## Layers

### Renderer (`src/`)

Pure UI. It never imports `fs`, `child_process` or `electron`; the only way out is
`window.unsqitch.*`. That keeps `contextIsolation` meaningful and makes most logic
testable in plain Vitest.

- `pages/` — one component per sidebar section, plus the home/project shells.
- `components/` — shared UI. `progress/` holds the run/error surfaces, `plan/` the
  timeline, `shared/` reusable pieces such as `TargetPicker` and `CommandPreview`.
- `lib/` — **pure functions, no React**: the plan/status/log/stdout parsers, the URI
  builder, the plan-vs-status diff. Most of the test suite lives against this directory.
- `store/` — two Zustand stores (see below).
- `mock-api.ts` — a full stand-in for the IPC surface so the renderer runs in a plain
  browser. Every new IPC method needs a mock here or browser mode breaks.

### Main process (`electron/`)

- `main.ts` — window creation plus one `ipcMain.handle` per channel. Handlers stay thin:
  validate, delegate to a service, map errors.
- `services/` — the real work. `sqitch.service.ts` spawns the CLI; `project.service.ts`
  owns the SQLite app database; `config`/`engine`/`target.service.ts` wrap the
  corresponding Sqitch commands; `project-layout.ts` resolves `core.top_dir` /
  `core.plan_file`; `target-resolver.ts` discovers configured targets;
  `file-watcher.service.ts` watches the plan and script directories;
  `binary-detector.ts` locates and version-checks Sqitch.
- `preload.ts` — exposes the API over `contextBridge`. It is the only place that names
  both a channel and a renderer-facing method.
- `shared/ipc-types.ts` — the channel constants and payload types, imported by both
  sides. This file *is* the contract.

## State

| Store | Holds |
| ----- | ----- |
| `store/navigation.ts` | Which view/section is active, sidebar and Show-Commands toggles, watcher pulses, and cross-view requests such as "revert to this change". |
| `store/project.ts` | The open project, parsed plan, last status, config cache, streamed command events, and the last target used. |

The two are deliberately kept in sync: `openProject` sets the active project in *both*
(an early bug left every project view empty because only navigation was updated).

Command output is streamed rather than awaited: the main process forwards every stdout
chunk, and `ingestStream` re-parses the accumulated buffer into a coalesced
one-row-per-change event list. That is what makes the progress list live.

## Adding a capability that needs the filesystem or the CLI

1. Add the channel to `electron/shared/ipc-types.ts`.
2. Add a service method (or a new service) under `electron/services/`.
3. Register a handler in `electron/main.ts` that maps failures to an `AppError`.
4. Expose it in `electron/preload.ts`.
5. Add a mock to `src/mock-api.ts`.
6. Call it from a view — never reach around the bridge.

## Error handling

`src/types/error.ts` defines `AppError` (type, message, raw Sqitch output, recovery
actions) and `classifyError`, which infers the type from Sqitch's output — connection
failures, permission problems, a missing binary, a partial deployment, a timeout.

Two constraints shaped this:

- Electron only serialises `Error` instances across IPC, so handlers throw a real
  `Error` carrying the type in its message, and `parseIpcError` reconstructs the
  `AppError` in the renderer.
- Sqitch writes some failures to **stdout**, so classification inspects both streams.

Exit codes are not uniformly fatal: `sqitch status` exits 1 when a project simply has
nothing deployed, so `runCommand` takes a list of tolerated exit codes.

## Data at rest

`~/.unsqitch/app.db` (SQLite, via `better-sqlite3`) stores recent projects, settings,
target labels, and a credential-redacted command history. Set `UNSQITCH_DB_PATH` to
point it elsewhere — the E2E suite uses this to avoid touching the developer's data.

Database credentials are session-only and never written to this database. See
[SECURITY.md](../SECURITY.md).

## Native module ABI

`better-sqlite3` must be compiled for the runtime that loads it — Node for Vitest,
Electron for the app. The package scripts rebuild it as needed; see
[CONTRIBUTING.md](../CONTRIBUTING.md#1-the-native-module-has-two-abis).

## Testing strategy

- **Unit** (`tests/unit/`) — parsers and services in isolation; view routing and stores
  with Testing Library. Parser fixtures in `tests/fixtures/sqitch-output/` are **real
  captures** from Sqitch against Dockerised databases, not hand-written samples. That
  distinction matters: the original hand-written fixtures hid the fact that none of the
  parsers matched real output.
- **Integration** (`tests/integration/`) — real Sqitch commands against real databases
  from `docker-compose.yml`. Opt-in via `RUN_INTEGRATION=1`.
- **E2E** (`tests/e2e/`) — Playwright launching the built Electron app against a
  throwaway app database.

## Where the spec fits

`docs/superpowers/specs/` contains the original design specification, and
`docs/superpowers/plans/` the implementation plans. They are useful context, but they
were written before the code met the real CLI. Where they disagree with Sqitch's actual
behaviour — for example the CockroachDB URI scheme, or the argument form of
`sqitch target add` — the CLI is correct and the code follows it.
