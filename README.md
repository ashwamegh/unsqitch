# UnSqitch

> A sleek, high-fidelity visual deployment manager and schema controller for Sqitch migration projects.

[![CI](https://github.com/ashwamegh/unsqitch/actions/workflows/ci.yml/badge.svg)](https://github.com/ashwamegh/unsqitch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](.nvmrc)
[![Sqitch](https://img.shields.io/badge/sqitch-%E2%89%A51.0-orange.svg)](https://sqitch.org/)
[![Security audit](https://github.com/ashwamegh/unsqitch/actions/workflows/security.yml/badge.svg)](https://github.com/ashwamegh/unsqitch/actions/workflows/security.yml)
[![CodeQL](https://github.com/ashwamegh/unsqitch/actions/workflows/codeql.yml/badge.svg)](https://github.com/ashwamegh/unsqitch/actions/workflows/codeql.yml)

UnSqitch brings the power of [Sqitch](https://sqitch.org/) database migrations to a premium, cross-platform desktop application. Built with Electron, React, TypeScript, and modern glassmorphic aesthetics, it provides database engineers with real-time migration tracking, step-by-step deploy/revert execution, and interactive configuration management.

---

## Key Features

- 🗺️ **Interactive Plan Timeline**: Visualise your migration plan sequentially with statuses, tags, dependency details, and quick code previews.
- 🐚 **Collapsible Sidebar Navigation**: Space-saving sidebar that collapses to high-contrast icons for maximum focus, and expands dynamically when configuring projects.
- ⚡ **Integrated Terminal Panel**: Real-time streaming command output with auto-scrolling, size customisation, and collapsibility.
- ⚙️ **Project Engine & Target Management**: Setup targets, database connections, and custom sqitch engines with auto-detection configurations.
- 🛡️ **Safety Guardrails**: Threshold warnings for large schema reverts and confirmation steps to prevent accidental database overrides.
- 🎨 **Adaptive Theming**: Native light/dark theme system matching modern design languages.

---

## Tech Stack

- **Core**: Electron, Vite, React (TypeScript), Zustand (State Management)
- **Styling**: TailwindCSS, Lucide React (Icons), Glassmorphic Component Library
- **Tooling & Code Quality**:
  - **Biome**: Ultra-fast formatting and linting
  - **Husky**: Pre-commit quality assurance hooks
  - **Commitlint**: Strict compliance with the Conventional Commits specification

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/) 22 or higher (see [`.nvmrc`](.nvmrc))
- [Sqitch CLI](https://sqitch.org/download/) 1.0 or higher
- Git
- Docker (optional — only for the integration tests)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ashwamegh/unsqitch.git
   cd unsqitch
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server with Electron hot-reloading:
```bash
npm run dev
```

### Production Build

Compile, optimize, and build the Electron binaries:
```bash
# Build for current OS
npm run build

# Build specific platform targets
npm run build:linux
npm run build:win
npm run build:mac
```

---

## Development & Code Quality Guidelines

We enforce modern code hygiene standards using pre-commit hooks to ensure quality and consistency across branches.

### Linter & Formatter (Biome)

We use **Biome** as our unified linting and formatting tool. It runs in microseconds and ensures clean syntax:
- Run checks: `npm run lint`
- Apply automatic fixes: `npm run lint:fix`

### Conventional Commit Message Standard

All commits must follow the **Conventional Commits** specification. In this repository, **defining a scope is mandatory** (e.g. `feat(scope): subject`).

#### Format
```
<type>(<scope>): <subject>

[optional body]
```

#### Valid Examples
- `feat(sidebar): add collapsible mode toggle`
- `fix(settings): correct system default theme loader`
- `chore(lint): configure husky and commitlint rules`

#### Invalid Examples
- `fix: correct typo` (Missing scope)
- `wip: sidebar stuff` (Invalid type and missing scope)

Our Husky hooks automatically validate both the commit message format and code syntax before letting you commit.

---

## Testing

UnSqitch has three layers of tests:

| Layer | Command | Notes |
| ----- | ------- | ----- |
| **Unit** | `npm test` | Vitest + jsdom. Covers parsers, services, and React view routing. No external dependencies. |
| **E2E** | `npm run test:e2e` | Playwright drives the fully built Electron app. Automatically rebuilds native modules and runs `npm run build` first. |
| **Integration** | `npm run test:integration` | Runs real Sqitch commands against live databases. Requires the [Sqitch CLI](https://sqitch.org/download/) and Docker (`npm run docker:up`). Skipped automatically when `RUN_INTEGRATION` is unset. |

### Native module note

`better-sqlite3` is a native module and must be compiled against the ABI of whichever runtime loads it — **Node.js** for unit tests, **Electron** for the running app and E2E. This is handled automatically:

- `npm test` rebuilds for the **Node** ABI first (via its `pretest` hook → `npm run rebuild:node`).
- `npm run test:e2e` rebuilds for the **Electron** ABI and builds the app first (via its `pretest:e2e` hook → `npm run rebuild:electron`).
- The app itself (`npm run dev`, `npm run start`, and production builds) uses the **Electron** ABI, set up by `postinstall` on a fresh `npm install`.

If you switch between running the unit tests and launching the app manually and hit a `NODE_MODULE_VERSION` error, re-run the matching rebuild script (`npm run rebuild:node` or `npm run rebuild:electron`).

### Engine notes

Verified against Sqitch 1.6.1 with the databases from `docker-compose.yml`:

| Engine | URI scheme | Notes |
| ------ | ---------- | ----- |
| PostgreSQL | `db:pg://` | Needs a `psql` client on `PATH`. |
| SQLite | `db:sqlite:` | No server required. |
| CockroachDB | `db:cockroach://` | Uses Sqitch's own `cockroach` engine — deploying it through `pg` fails while creating the registry. |
| YugabyteDB | `db:pg://` | Sqitch has no `yugabyte` engine; it is driven through `pg`. |
| MySQL | `db:mysql://` | Sqitch needs the `DBD::MariaDB` Perl driver, which the Homebrew build does not ship. Point **Settings → Sqitch path** at a build that has it (for example a wrapper around the `sqitch/sqitch` Docker image). Sqitch also stores its registry in a separate `sqitch` database by default — set `engine.mysql.registry` if the user cannot create it. |

If a client rejects the server's self-signed TLS certificate (common with MySQL 8),
configure the client rather than Sqitch — e.g. `skip-ssl` in a `[client]` section
of `.my.cnf`.

---

## Documentation

| Document | What it covers |
| -------- | -------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, architecture tour, the quirks that bite, testing, commit and PR conventions. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the renderer, IPC layer, services and stores fit together, and how to add a capability. |
| [SECURITY.md](SECURITY.md) | How to report a vulnerability, and the credential-handling guarantees. |
| [docs/REPOSITORY-HARDENING.md](docs/REPOSITORY-HARDENING.md) | The automated security checks, and the repository settings to enable. |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes per release. |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Expected conduct in the project's spaces. |
| [docs/superpowers/specs/](docs/superpowers/specs/) | The original design specification. Where it disagrees with the real Sqitch CLI, the CLI wins. |

---

## Contributing

Contributions are welcome — bug reports, engine coverage, and UX improvements especially.
Start with [CONTRIBUTING.md](CONTRIBUTING.md); it covers the development setup, the
architecture, and two things that will otherwise cost you an afternoon (the native
module's dual ABI, and validating parsers against real Sqitch output).

```bash
npm run lint        # Biome across the repo
npm run typecheck   # main + renderer
npm test            # unit tests
```

Please open an issue before starting anything large, so the approach can be agreed first.

---

## Security

Please report vulnerabilities privately rather than in a public issue — see
[SECURITY.md](SECURITY.md). Note that database passwords are held in memory for the
session only and are never written to the app database, and that recorded command
history is credential-redacted.

---

## License

[MIT](LICENSE) © ashwamegh

UnSqitch is an independent front end for [Sqitch](https://sqitch.org/) and is not
affiliated with the Sqitch project.

