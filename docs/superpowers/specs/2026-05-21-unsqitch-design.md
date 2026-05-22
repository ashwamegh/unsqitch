# UnSqitch — Design Specification

**Date:** 2026-05-21
**Status:** Approved

## Overview

UnSqitch is a cross-platform Electron desktop application that provides a GUI wrapper for the Sqitch CLI. It enables developers to manage database migrations through a natural-language-driven UI instead of memorizing CLI commands. The app is designed for daily use, inspired by Postico 2's polished experience, and targets both junior and senior developers.

## Architecture

**Approach:** Layered Service Architecture

```
Renderer (React UI) ←→ Typed IPC ←→ Service Layer ←→ Sqitch CLI / File System
```

- **Main process:** Houses all services (sqitch, project, config, engine, target). Handles file I/O and sqitch process spawning.
- **Renderer:** Pure UI layer. React + TypeScript. Communicates with main process exclusively through typed IPC channels.
- **Sqitch CLI:** Spawned as child processes. stdout/stderr streamed in real-time to both the progress UI and terminal panel.
- **Hybrid sqitch management:** Uses system sqitch if available. Offers install guidance and manual path configuration if not. Auto-install deferred to v2.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Electron 33+ |
| Frontend | React 18 + TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Build tool | electron-vite |
| Terminal | xterm.js |
| State management | Zustand |
| IPC | Typed channels (shared types between main/renderer) |
| File watching | chokidar |
| App state DB | better-sqlite3 |
| Testing - Unit | Vitest |
| Testing - Integration | Vitest + Docker containers |
| Testing - E2E | Playwright |
| Packaging | electron-builder |

## Project Structure

```
unsqitch/
├── docker-compose.yml
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── shared/
│   │   └── ipc-types.ts         ← shared IPC channel types (accessible by both main and renderer via tsconfig paths alias)
│   └── services/
│       ├── sqitch.service.ts
│       ├── project.service.ts
│       ├── config.service.ts
│       ├── engine.service.ts
│       └── target.service.ts
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── HomePage/
│   │   └── ProjectPage/
│   ├── components/
│   │   ├── layout/
│   │   ├── terminal/
│   │   ├── progress/
│   │   └── shared/
│   ├── hooks/
│   │   ├── useIpc.ts
│   │   ├── useSqitchCommand.ts
│   │   └── useProject.ts
│   ├── lib/
│   │   ├── sqitch-parser.ts
│   │   └── plan-parser.ts
│   └── types/
├── tests/
│   ├── fixtures/
│   │   └── test-project/
│   ├── integration/
│   └── e2e/
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json          ← main process (paths alias: @shared → electron/shared)
└── tsconfig.web.json           ← renderer (paths alias: @shared → electron/shared)
```

## UI Model

### Window Model

Single-window application for v1. Sidebar stays persistent, main panel switches between views.

**Navigation state machine:**
```
home → project (click project card)
project → home (click back button)
project → section (click sidebar item)
section → section (click different sidebar item)
```

State is managed via Zustand store: `{ view: 'home' | 'project', projectId: string | null, section: string | null }`. No URL routing needed — state-driven rendering.

- **Home view** is the top-level sidebar item — shows project list
- Click a project in the list → sidebar updates to show project sections, main panel loads that project's views
- Back button returns to home/project list
- Multi-window support deferred to v2

### Home View

Project cards showing:
- Project name (directory name)
- Engine type
- Number of planned changes
- Last deployment timestamp

Actions: Open Project (directory picker with sqitch project validation), click card to enter project, remove from recent list (right-click), Settings.

**Empty state (no projects):** Center of home page shows large "Open a Project" CTA button + brief description: "Open a directory containing a Sqitch project to get started." Below the button: "or create a new project" link that opens the Init form.

Recent projects stored in SQLite app database (`~/.unsqitch/app.db`).

### Project View

Sidebar navigation + main panel + collapsible terminal panel.

**Sidebar sections:**

Development (top group):
- **Plan** — Read-only timeline view of sqitch.plan
- **Deploy** — Form + preview + progress + terminal
- **Revert** — Click-to-revert with confirmation
- **Status** — Dashboard cards + changes list
- **Verify** — Run + results per change
- **Log** — Chronological deployment history

Setup (bottom group):
- **Engine** — Add/remove/list engines
- **Target** — URI builder + add/remove/list
- **Config** — Section-based key/value editor (via sqitch config CLI)

Action button: **+ Add Change** — Form for sqitch add (name, note, requires, conflicts), creates scripts, opens in external editor.

### Show Commands Toggle

Global toolbar toggle (`</> Show Commands`) that reveals/hides the generated sqitch command for every form. When off, only the friendly form and run button are shown. When on, each section displays the exact sqitch CLI command that will be executed, with a "Copy Command" button.

Default: off. Junior devs see clean forms; senior devs flip it on to see and copy exact commands.

On first run: show a one-time tooltip on the Show Commands toggle: "Toggle this to see the exact sqitch CLI commands behind each action." Tooltip persists until explicitly dismissed (X button) or until the user toggles Show Commands on once. Never shown again after either action (tracked in settings).

### Natural Language UI

All forms use natural language descriptions instead of raw CLI flags. Examples:

- Deploy: "You're about to deploy 3 new changes to mydb" instead of "Target: mydb, Change: @head"
- Revert: "This will undo the last 4 changes. 7 changes will remain deployed."
- Plan: "First we create users, then emails depends on users, then orders depends on emails."

The underlying sqitch commands are always visible via the Show Commands toggle.

### Preview Mode (Deploy & Revert)

UI Preview diffs plan vs status locally, no database connection, instant. Shows "these X changes would be deployed" or "these X changes would be reverted."

**Before any destructive action (deploy, revert), the app forces a fresh `sqitch status` run against the target database** to ensure preview reflects actual state. Preview results are marked as "informational — verified before execution." The actual execution runs the sqitch command which re-checks state atomically.

**Status cache lifecycle:**
- **Populated:** On project open (first `sqitch status` call)
- **Invalidated:** On window focus, after any deploy/revert/verify action, on manual section refresh, on file watcher change detection
- **Fallback:** Stale banner only shows after window regains focus (not on a timer during active use). If status cache is older than 5 minutes when window regains focus, show subtle "Data may be outdated" banner with Refresh button This is safer than any CLI-based dry-run because it never touches the database.

Note: sqitch has no `--dry-run` flag. The `--log-only` flag exists but writes to the sqitch registry without running scripts, which is not suitable for preview purposes.

### Revert Flow

Click any deployed change → "Revert to here" option. **"Revert to here" means the selected change remains deployed; all changes deployed after it are reverted.** This matches `sqitch revert <target> --to <change>` semantics — the `--to` change stays.

Preview dialog shows:
- List of changes that will be undone (with ✕ markers)
- Natural language summary ("7 changes will remain deployed, including 'discounts'")
- Generated command (when Show Commands is on): `sqitch revert <target> --to <change> -y`
- Confirmation required

**Revert edge cases:**
- Revert the latest change only → `sqitch revert <target> --to <second_to_last_change> -y` (revert to the change before the latest, so only the latest is undone)
- Revert the latest change (if only one deployed) → `sqitch revert <target> -y` (reverts all — only option since there's nothing to keep)
- Revert to a tag → `sqitch revert <target> --to @v1.0.0 -y` (all changes after tag are reverted, tag stays)
- Revert multiple → `sqitch revert <target> --to <change> -y` (all changes after specified change are reverted)

**Important:** `sqitch revert <target> -y` with no `--to` reverts ALL changes, not just the latest. To revert only the latest change, the UI must determine the second-to-last deployed change from `sqitch status` output and generate `--to <that_change>`.

Dependency-aware blocking: cannot revert a change that has dependent changes deployed. UI shows which changes block the revert and offers to revert all dependents.

### Plan View

Timeline/story view with:
- Numbered sequence of changes
- Dependencies shown as "← requires X" (natural language)
- Conflicts shown as "conflicts with X"
- Tags (@v1.0.0) as visual separators/milestones
- Click a change → read-only script view + open in external editor
- + Add Change button at bottom

With Show Commands on: each change shows the `sqitch add` command that created it.

### Status View

Dashboard cards at top (deployed count, reverted count, verified count).

Changes list with deployment state, tag badges, timestamps. Pagination with page number input, per-page control (10/25/50/100).

Dependencies section with arrow notation and satisfaction status: "emails → depends on → users ✔ satisfied"

Click a change → detail panel with change ID, project, deployer, timestamp, tag, note, dependencies, events.

### Progress UI & Terminal Panel

**Top of main panel** — Progress UI during operations:
- Change-by-change status with timing (✔/⟳/⏳/✕)
- Progress bar
- Cancel button
- On failure: error summary, View Full Log, Retry, Revert Successful options

**Bottom panel** — Collapsible terminal using xterm.js:
- Auto-opens when command starts
- Stays open on failure (user closes manually or auto-closes on next successful command)
- Streams raw sqitch stdout/stderr
- Clear and toggle buttons
- Scrollback buffer: 10,000 lines (configurable)
- Resize: min-height 150px, max-height 50% of window, drag to resize. xterm.js reflows on resize.
- Stdin: sqitch revert is run with `-y` flag (documented short form for suppressing the revert prompt). sqitch deploy and other commands do not require this flag. Any prompt-requiring operation must be handled in the UI form before command is issued.

### Setup Views

**Init:** Accessible from Home page via "New Project" button. Form fields:
- Project directory: file picker (must be empty or non-existent directory)
- Engine: dropdown (postgresql, mysql, sqlite, cockroachdb, yugabytedb)
- Project name: text input (defaults to directory name)
- URI: auto-constructed from engine selection (uses Target URI builder pattern). For SQLite, this switches to a file path picker instead of host/port/user/password.
- Top directory: text input (default: `.`)
- Plan file: text input (default: `sqitch.plan`)

With Show Commands on: shows `sqitch init <name> --engine <engine> --uri <uri> --top-dir <dir>`

After init: project is opened in project view, and the user is prompted to add their first change.

**Engine:** Cards for configured engines with Edit/Remove. Add Engine form with engine type, database URI, client path, registry schema. Shows command when toggle is on.

**Target:** URI builder that adapts per engine (user selects engine type from dropdown first):
- PostgreSQL/CockroachDB/YugabyteDB: host, port, database, user, password → constructs `db:pg://`. Engine dropdown selection determines client path defaults and registry behavior (e.g., CockroachDB may use a different psql client path).
- MySQL: host, port, database, user, password → constructs `db:mysql://`
- SQLite: file path picker → constructs `db:sqlite:`

Shows constructed URI and generated command when toggle is on.

**Config:** Uses `sqitch config --list` to read and `sqitch config <key> <value>` to write. Never parses .conf files directly. Section tabs (core, engine, target, user) are visual groupings of the flat key=value list from `sqitch config --list`. Shows `sqitch config` command when toggle is on. Config is cached in memory after first read; cache is invalidated on write operations and on window focus refresh.

### Settings

- Sqitch binary path with auto-detection and manual override
- External editor preference
- Theme (Light/Dark/System)
- Show Commands default
- Command timeout (default: 5 min)
- Terminal scrollback buffer size (default: 10,000)
- Large revert warning threshold (default: 5)

## Data Model

```typescript
type PlanEntryType = 'pragma' | 'change' | 'tag' | 'unparseable';

interface PlanEntry {
  type: PlanEntryType;
  index: number;
  pragma?: { key: string; value: string };
  change?: PlanChange;
  tag?: PlanTag;
  unparseable?: { line: string };
}

interface PlanFile {
  entries: PlanEntry[];
  pragmas: Record<string, string>;
  changes: PlanChange[];
  tags: PlanTag[];
  unparseableLines: { line: string; index: number }[];
}

// entries[] preserves file order for timeline rendering.
// pragmas, changes, tags are convenience lookups derived from entries.

interface PlanChange {
  name: string;
  requires: string[];
  conflicts: string[];
  timestamp: string; // ISO 8601 format, e.g., "2024-01-15T10:00:00Z"
  planner: { name: string; email: string };
  note: string;
}

interface PlanTag {
  name: string;
  timestamp: string; // ISO 8601 format
  planner: { name: string; email: string };
  note: string;
}

interface DeploymentStatus {
  target: string;
  engine: string;
  deployed: DeployedChange[];
  pending: string[];
  lastChange: string;
  lastTag: string[];
  lastDeployTime: string;
}

interface DeployedChange {
  name: string;
  changeId: string;
  deployedAt: string;
  deployedBy: string;
  tags: string[];
  note: string;
  requires: string[];
  conflicts: string[];
}

interface LogEntry {
  change: string;
  changeId: string;
  action: 'deploy' | 'revert';
  timestamp: string;
  committer: { name: string; email: string };
  note: string;
  tags: string[];
  requires: string[];
  conflicts: string[];
}

interface ConfigEntry {
  section: string;
  subsection?: string;
  key: string;
  value: string;
}
// Examples:
// engine.pg.client=psql → { section: "engine", subsection: "pg", key: "client", value: "psql" }
// core.engine=pg        → { section: "core", subsection: undefined, key: "engine", value: "pg" }

interface SqitchEvent {
  type: 'deploy' | 'revert' | 'verify';
  change: string;
  target?: string;
  status: 'ok' | 'failed' | 'running';
  rawLine: string;
}

type ErrorType =
  | 'sqitch_crash'
  | 'db_connection'
  | 'file_permission'
  | 'binary_not_found'
  | 'partial_deployment'
  | 'command_timeout'
  | 'unknown';

type ErrorAction =
  | { label: string; action: 'retry' | 'revert' | 'view_log' | 'check_connection' | 'open_settings' | 'open_file_manager' | 'refresh' };

interface AppError {
  type: ErrorType;
  message: string;
  sqitchOutput?: string;
  recoverable: boolean;
  actions: ErrorAction[];
}

interface Project {
  id: string;
  name: string;
  path: string;
  engine: string;
  lastOpened: string;
  changeCount: number;
  lastDeployment?: string;
}
```

## Parsers

### sqitch.plan Parser

**Actual format** (single-line per entry):
```
%syntax-version=1.0.0
%project=my-app
%uri=https://github.com/example/my-app
appschema 2024-01-15T10:00:00Z Marge N. O'Vera <marge@example.com> # Add schema for all flipr objects.
users [appschema] 2024-01-15T10:30:00Z Marge N. O'Vera <marge@example.com> # Creates table to track our users.
@v1.0.0 2024-01-15T11:00:00Z Marge N. O'Vera <marge@example.com> # Tag v1.0.0.
insert_user [users appschema] 2024-01-16T09:00:00Z Marge N. O'Vera <marge@example.com> # Creates a function to insert a user.
new_auth [users !legacy_auth] 2024-01-17T09:00:00Z Marge N. O'Vera <marge@example.com> # New auth, conflicts with legacy.
```

**Parser rules:**
- Pragmas: `/^%([\w-]+)=(.+)$/` → `{ pragmas[key] = value }`
- Tags: `/^@([\w-]+)\s+(\S+)\s+([^<]*<[^>]+>)\s*(?:#\s*(.+))?$/` → `{ name, timestamp, planner, note }`
- Changes: `/^([\w-]+)\s*(?:\[(.+?)\])?\s+(\S+)\s+([^<]*<[^>]+>)\s*(?:#\s*(.+))?$/` → `{ name, deps, conflicts, timestamp, planner, note }`
  - Dependencies in brackets: split by space, `!`-prefixed = conflicts, rest = requires
  - Note is optional — `#` and description may be absent

**Unparseable line handling:** If a line doesn't match any regex pattern, it is added to `PlanFile.unparseableLines`. The UI surfaces a warning: "2 lines in sqitch.plan could not be parsed" with a collapsible detail view showing the raw lines.

**Output:** `PlanFile` type from data model.

### sqitch stdout Parser

**Patterns:**
- Deploy line: `/^\s*\+\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/`
- Revert line: `/^\s*-\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/`
- Verify line: `/^\s*\*\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/`
- "Deploying change X to Y" → extract change name and target
- "Reverting change X from Y" → extract change name and target
- "Verifying change X" → extract change name

**Output:** Emits `SqitchEvent` objects in real-time as stdout streams.

### CLI Output → Data Model Mapping

| UI Field | Source Command | Parsing Strategy |
|----------|---------------|------------------|
| Status dashboard (deployed/reverted/verified counts) | `sqitch status <target>` | Parse summary line + deployed change list |
| DeployedChange (name, changeId, deployedAt, deployedBy) | `sqitch status <target>` | Parse each "Change: ..." block in status output |
| DeployedChange.tags | `sqitch status <target>` + `sqitch log <target>` | Tags appear in status output per change |
| DeployedChange.requires, conflicts | Plan file (not from DB) | Cross-reference plan parser output with deployed list |
| LogEntry (all fields) | `sqitch log <target>` | Parse structured log output blocks |
| ConfigEntry (all fields) | `sqitch config --list` | Key=value parsing |
| Preview pending changes | `sqitch plan` + `sqitch status` diff | Local diff, no command needed |
| Verify results per change | `sqitch verify <target>` stdout | stdout parser (verify lines) |

**Note on `sqitch status` output:** Sqitch does not support `--format json` for status. Use `sqitch status <target> --show-changes --show-tags --date-format raw` for the most machine-parseable output. All status parsing must handle human-readable format. All parsers must be validated against real fixture outputs in tests.

### sqitch config Parser

**Input:** Output of `sqitch config --list` (flat key=value lines)

**Parser rules:**
- Line format: `section.subsection.key=value` or `section.key=value`
- Split on first `=` only to handle values containing `=` (e.g., `core.uri=db:pg://user=me@host`)
- Multiline values: `sqitch config --list` does not produce multiline output (it uses `\n` literal escaping). If encountered, collapse to single line by replacing literal `\n` with newline character on display.
- Parse into `ConfigEntry` type from data model
- `engine.pg.client=psql` → `{ section: "engine", subsection: "pg", key: "client", value: "psql" }`
- `core.engine=pg` → `{ section: "core", subsection: undefined, key: "engine", value: "pg" }`

## Error Handling

| Error Type | Detection | UI Response |
|-----------|-----------|-------------|
| sqitch crashes mid-deploy | Non-zero exit code | Show error, mark failed change, offer "Revert Successful" or "View Log" |
| DB connection drops | sqitch connection error output | Show error with "Check Connection" and "Retry" |
| File permissions | sqitch permission denied output | Show error with path, offer "Open in File Manager" |
| sqitch not found | Binary path check fails before spawn | Show setup dialog |
| Partial deployment | `sqitch status` shows deployed but not at head | Status shows "Partially deployed", offer "Deploy Remaining" or "Revert All" |
| Command timeout | Process exceeds configurable timeout (default: 5 min) | Kill process, show timeout error with "Retry" or "Increase Timeout" |

All errors use the `AppError` structured type. Every error includes:
- `type` — categorized error type
- `message` — human-readable description
- `sqitchOutput` — raw sqitch output when available
- `recoverable` — whether the app can continue
- `actions` — available recovery actions with labels

Unknown errors (`type: 'unknown'`) surface to the user with:
- Raw sqitch output in a collapsible section
- "Copy Error Details" button (for pasting into issues)
- "Report Issue" button (links to GitHub issues)
- "Refresh" recovery action

## File Watching

Using chokidar to watch project files when a project is open:
- Watch `sqitch.plan` → re-parse plan, update Plan view
- Watch deploy/revert/verify script directories → reflect changes in script viewer
- Debounce: 500ms to avoid thrashing on multi-file saves
- Configure `atomic: true` to handle sqitch's atomic write pattern (write to temp, rename)
- Ignore: `.git`, `node_modules`, tmp files
- Visual indicator: subtle pulse/dot on the sidebar section that received new data

### Stale State Handling

When sqitch is run externally (terminal, CI), the UI may show stale data. Three-layer detection:

1. **File watcher** — Detects plan file and script changes, re-parses automatically
2. **Window focus refresh** — On `browser-window-focus` event, run `sqitch status` to refresh deployment state
3. **Manual refresh** — Each section has a "Refresh" button (icon in section header) that re-runs the relevant sqitch command

If a destructive action is attempted on stale state (e.g., revert a change already reverted externally), sqitch itself will return an error — the UI shows this as a standard `AppError` with "Refresh" as a recovery action.

## App State

Using `better-sqlite3` for `~/.unsqitch/app.db`:

**Tables:**
- **projects** — id, name, path, engine, lastOpened, changeCount, lastDeployment
- **settings** — key, value
- **recent_commands** — id, projectId, command, timestamp, exitCode
- **target_labels** — id, projectId, targetName TEXT(128), label TEXT(64) (stores UnSqitch-specific metadata per target, e.g., label="production"). targetName stores the sqitch target alias only (e.g., "mydb", "staging"), never full URIs. Indexed on (projectId, targetName) for fast lookup.

Production target tagging is an UnSqitch-only feature — not a sqitch convention. The `target_labels` table maps target names to labels. The UI shows a "Mark as Production" option on each target in the Target view. When a target is labeled "production", destructive actions (revert) on that target require typed confirmation + red warning.

Single-instance enforcement: Electron `app.requestSingleInstanceLock()` prevents multiple app instances. SQLite's single-writer model is sufficient given this constraint.

Note: better-sqlite3 requires native compilation. electron-builder must be configured with `npmRebuild: true` and `electron-rebuild` must run as a postinstall step in package.json (`"postinstall": "electron-rebuild"`). electron-rebuild must target the Electron Node ABI version — this is handled automatically when electron-rebuild is installed as a devDependency.

## Sqitch Binary Management

On first launch:
1. Detect binary: `which sqitch` on macOS/Linux, `where sqitch` on Windows (`process.platform === 'win32'`)
2. If found: run `sqitch --version`, extract first semver match `(\d+\.\d+\.\d+)` from output, verify minimum version (v1.0.0+), verify engines, cache path
3. If not found: show platform-appropriate install guidance + option to specify manual path + option to skip
4. If version is below minimum: show warning "UnSqitch requires Sqitch v1.0.0 or later. Installed: vX.Y.Z" with upgrade instructions

Before every command: quick-check binary exists at cached path. If missing, show warning and offer re-detect or manual path.

V1: install guidance only (no auto-install). Auto-install deferred to v2.

## External Editor Integration

- **Launch:** `child_process.spawn(editorCommand, [filePath])` where `editorCommand` comes from settings
- **Default detection:** Check `$VISUAL` → `$EDITOR` → platform defaults (`code` on all platforms, `notepad` on Windows fallback)
- **Windows support:** Full path to editor exe, or rely on `start` command for file association
- **File watching:** chokidar watches for external script changes, auto-updates Plan/Status views
- **After "Open in Editor":** Toast notification "Opened in ${editorName}" where `editorName` is derived from the configured editor binary path (e.g., `code` → "VS Code", `vim` → "Vim", custom path → filename without extension)

## Engine Support (v1)

| Engine | URI Format | Docker Image | Test Port |
|--------|-----------|--------------|-----------|
| PostgreSQL | db:pg:// | postgres:16 | 54231 |
| MySQL | db:mysql:// | mysql:8 | 33072 |
| SQLite | db:sqlite: | No Docker | N/A |
| CockroachDB | db:pg:// | cockroachdb/cockroach:latest | 36257 |
| YugabyteDB | db:pg:// | yugabytedb/yugabyte:latest | 54234 |

All engines supported with engine-specific URI builders. Docker test setup includes all server-based engines.

## Safety & Guardrails

- **No delete from plan or scripts** — plan file and migration scripts are read-only in the UI
- **Revert-only on database** — only destructive database action is revert, always with preview and confirmation
- **Dependency-aware blocking** — cannot revert a change with deployed dependents
- **Large revert warning** — reverting more than 5 changes (configurable) requires user to type the number of changes being reverted (e.g., "Type 12 to confirm")
- **Production target protection** — targets tagged as "production" require typed confirmation + red warning
- **UI doesn't expose delete buttons** for plan entries or scripts

| Operation | Plan file | Scripts | Database |
|-----------|-----------|---------|----------|
| View | ✅ | ✅ (read-only) | ✅ |
| Add | ✅ (sqitch add) | ✅ (sqitch add) | ✅ (deploy) |
| Edit | ❌ | ❌ (open in external editor only) | ❌ |
| Delete | ❌ | ❌ | ❌ (only revert) |

## Security

- **Passwords are session-only.** Target URIs with embedded credentials (`db:pg://user:pass@host/db`) are held in memory only during the session. They are never persisted to `app.db`.
- **Note: Sqitch itself stores target URIs in its config files.** If a user embeds a password in a target URI, it will be written to `sqitch.conf` by `sqitch target add`. UnSqitch cannot prevent this. The UI should warn users: "Avoid embedding passwords in URIs. Prefer .pgpass, environment variables, or engine-specific auth files." The Target URI builder password field includes this advisory text.
- **Target storage uses aliases.** The `target_labels` and `projects` tables store the sqitch target name (e.g., "mydb"), not the full URI. The full URI is read from `sqitch config` at runtime.
- **Command history is redacted.** The `recent_commands` table stores the command template with credentials stripped (e.g., `sqitch deploy mydb -y` instead of `sqitch deploy db:pg://user:pass@host/db -y`). The target alias is stored, not the URI.
- **Password fields in the Target URI builder** use masked input. When editing an existing target, the password field shows placeholder dots and is populated from `sqitch config` at runtime, never from app.db.
- **Future (v2):** Integrate with OS keychain via `keytar` to persist credentials securely.

## V1 Command Coverage

| Command | View | Operations |
|---------|------|------------|
| init | Home | Initialize new sqitch project in a directory |
| add | Plan | Add change form + command builder |
| plan | Plan | Read-only timeline view |
| deploy | Deploy | Form + preview + progress + terminal |
| revert | Status/Plan | Click-to-revert + confirmation |
| verify | Verify | Run + results per change |
| status | Status | Dashboard cards + changes list |
| log | Log | Chronological deployment history |
| engine | Engine | Add/remove/list engines |
| target | Target | URI builder + add/remove/list |
| config | Config | Section-based key/value editor via sqitch config CLI |

**Not in v1:** rework, tag, bundle, checkout, rebase, check, upgrade. Architecture supports adding these later.

### Command Templates

Every UI action maps to an exact sqitch command:

| UI Action | Generated Command |
|-----------|-------------------|
| Init project | `sqitch init <name> --engine <engine> --uri <uri> --top-dir <dir>` |
| Add change | `sqitch add <name> -n "<note>" [-r <requires>]... [-x <conflicts>]...` |
| Deploy all | `sqitch deploy <target> --verify` |
| Deploy to change | `sqitch deploy <target> --to <change> --verify` |
| Revert latest change | `sqitch revert <target> --to <second_to_last_change> -y` |
| Revert to change | `sqitch revert <target> --to <change> -y` |
| Verify | `sqitch verify <target>` |
| Status | `sqitch status <target>` |
| Log | `sqitch log <target>` |
| Plan | `sqitch plan` |
| Add engine | `sqitch engine add <name> --target <uri>` |
| Remove engine | `sqitch engine remove <name>` |
| Add target | `sqitch target add <name> --uri <uri>` |
| Remove target | `sqitch target remove <name>` |
| Read config | `sqitch config --list` |
| Set config | `sqitch config <key> <value>` |
| Unset config | `sqitch config --unset <key>` |

All commands run with `--chdir <project_path>` to ensure correct working directory. Exception: `sqitch init` — if the project directory doesn't exist, create it first (`fs.mkdir`), then run `sqitch init <name> --engine <engine> --uri <uri> --top-dir <dir>` with `--chdir` pointing to the new directory. If the directory exists but is empty, run init directly with `--chdir`.

## Docker Compose & Testing

Docker Compose runs Postgres (54231), MySQL (33072), CockroachDB (36257), YugabyteDB (54234) for testing. All ports are non-default to avoid conflicts with local installs.

Testing layers:
- **Unit:** Services, parsers, React components (no Docker)
- **Integration:** Docker containers, real sqitch commands against live databases
- **E2E:** Playwright against full Electron app
- **Parser fixtures:** All parsers (plan, stdout, config) must be validated against real sqitch output fixtures. Fixtures are generated by running actual sqitch commands against Docker containers and capturing stdout. Stored in `tests/fixtures/sqitch-output/`. Parser tests compare parsed output against expected data model instances.

Scripts: `docker:up` (start all containers), `docker:down` (stop containers), `docker:reset` (destroy volumes + restart for clean slate), `test`, `test:integration`, `test:e2e`

Test fixtures include a pre-built sqitch project with deploy/revert/verify scripts.

## Build Targets

- macOS (x64 + ARM64)
- Linux (AppImage + deb)
- Windows (NSIS installer)
