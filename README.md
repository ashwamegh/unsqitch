# UnSqitch

> A sleek, high-fidelity visual deployment manager and schema controller for Sqitch migration projects.

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
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Sqitch CLI](https://sqitch.org/download/)
- Git

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
- Run checks: `npx @biomejs/biome check src`
- Apply automatic fixes: `npx @biomejs/biome check --write src`

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
