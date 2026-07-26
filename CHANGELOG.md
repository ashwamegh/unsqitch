# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-26

First released build. Earlier versions of this file described a 1.0.0 release, but no tag
or release ever existed, so the initial implementation is folded in here.

### Added

- Initial implementation: plan timeline, deploy, revert, status, verify and log views, the
  engine/target/config setup views, and a typed IPC layer between the renderer and the
  Sqitch CLI.
- Installers for macOS (arm64 and x64), Windows and Linux, built and published by the
  release workflow with signed build provenance for every artifact.

- Onboarding that makes the app explain itself on first open: a project header
  summarising engine, target and how much of the plan is deployed, with the plan
  pragmas moved behind a disclosure.
- Target auto-discovery — target fields are pre-filled from `sqitch.conf` and offer the
  project's configured targets instead of asking the user to guess a URI.
- Deployment state on the Plan timeline (per-change Deployed/Pending badges) and a
  read-only script viewer with deploy/revert/verify tabs and SQL highlighting.
- Status view: deployed/reverted/verified/pending cards, a dependencies section with
  satisfaction status, a change detail panel, real pagination (10/25/50/100 plus a page
  input), and a partially-deployed state offering Deploy Remaining.
- "Revert to here" from both Status and Plan, including reverting to a tag.
- Structured error reporting: failures are classified (database connection, file
  permission, missing binary, partial deployment, timeout) and shown with recovery
  actions, the raw Sqitch output, and Copy Error Details.
- Change-by-change progress with per-change timings and a queued state, fed from
  streamed Sqitch output.
- Credential-redacted command history, a pre-command check that the Sqitch binary
  exists, and `--chdir` on every invocation.
- Support for `core.top_dir` and `core.plan_file`, so projects that keep their plan and
  scripts in a subdirectory work.
- CockroachDB via Sqitch's own `cockroach` engine; YugabyteDB via `pg`.
- Copy Command on every section's command preview.
- Open-source project files: MIT license, contributing guide, code of conduct, security
  policy, issue and pull request templates, CI, and Dependabot.

### Fixed

- Status, Log and the deploy progress list were empty for every real project: the
  parsers were written against hand-written fixtures rather than real Sqitch output.
  They now handle the `# `-prefixed status format, Sqitch's log blocks, dot-padded
  change lines (`+ appschema ...... ok`) and tagged changes (`+ users @v1.0.0 .. ok`),
  and are validated against captured real output.
- A fresh project reported an error instead of "nothing deployed" — `sqitch status`
  exits 1 in that case, which was treated as a crash.
- The Deploy preview listed already-deployed changes as pending on first visit, and
  ignored `--to` when counting.
- The pre-deploy status refresh raced the deploy instead of gating it.
- Opening a project did not set the active project in the project store, leaving every
  project view empty.
- An infinite render loop in the Target, Engine and Status views (unstable callbacks in
  effect dependencies).
- Editor integration and the Revert view were unreachable: no IPC handlers were
  registered for the editor, and the Revert section had no route.
- Cancelling a command showed a crash panel instead of a neutral notice.
- `sqitch target add` was invoked with `--uri`, which is a usage error; the URI is
  positional. `engine list` and `target list` were parsed as two fields when Sqitch
  prints only names without `--verbose`.
- Errors crossing IPC arrived as `[object Object]`, and connection failures were
  misclassified because Sqitch writes them to stdout.
- The project list was ordered non-deterministically when timestamps tied.
- E2E tests ran against the developer's real `~/.unsqitch/app.db`, so results depended
  on which projects happened to be registered.

### Changed

- Biome is the single formatter and linter; the leftover ESLint and Prettier
  configuration was removed and the pre-commit hook now checks the whole repository.
- `better-sqlite3` is rebuilt automatically for the right ABI by the `dev`, `start`,
  `test` and `test:e2e` scripts.
- The Progress UI moved to the top of the main panel, and the output panel is labelled
  "Sqitch Output" and only appears when a command runs.

[unreleased]: https://github.com/ashwamegh/unsqitch/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ashwamegh/unsqitch/releases/tag/v0.1.0
