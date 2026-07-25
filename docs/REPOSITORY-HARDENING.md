# Repository hardening

The automated checks live in `.github/workflows/`. A few protections are *repository
settings* rather than code, and several of them are only available once the repository
is **public** (on a free account, secret scanning, code scanning, private vulnerability
reporting and the dependency graph for private repos all require GitHub Advanced
Security). The workflows that depend on those are written to skip themselves while the
repository is private and to start working the moment it is public — no edit needed.

## What runs automatically

| Check | Workflow | When |
| ----- | -------- | ---- |
| Lint, typecheck, unit tests | `ci.yml` | every push and PR |
| Cross-platform build (macOS/Linux/Windows) | `ci.yml` | every push and PR |
| Integration tests against real PostgreSQL + Sqitch | `ci.yml` | every push and PR |
| E2E against the built Electron app | `ci.yml` | every push and PR |
| `npm audit` (fails on high/critical) | `security.yml` | push, PR, weekly |
| Dependency review of PR changes, with a copyleft-licence deny list | `security.yml` | PRs, once public |
| Electron security invariants + workflow permission audit | `security.yml` | push, PR, weekly |
| CodeQL static analysis | `codeql.yml` | push, PR, weekly, once public |
| OpenSSF Scorecard | `scorecard.yml` | push to main, weekly, once public |
| Dependency updates, grouped | `dependabot.yml` | weekly (npm), monthly (actions) |

Workflow hardening already applied: a top-level least-privilege `permissions` block in
every workflow, all third-party actions pinned to commit SHAs (Dependabot bumps them),
and `persist-credentials: false` on every checkout so the token is not written into
`.git/config`.

## Settings to enable after making the repository public

These need to be turned on once — from the web UI (Settings → Code security) or with the
commands below.

```bash
REPO=ashwamegh/unsqitch

# Dependabot alerts, and automatic PRs for vulnerable dependencies.
gh api -X PUT "repos/$REPO/vulnerability-alerts"
gh api -X PUT "repos/$REPO/automated-security-fixes"

# Let people report vulnerabilities privately (this is what SECURITY.md links to).
gh api -X PUT "repos/$REPO/private-vulnerability-reporting"

# Secret scanning, and blocking pushes that contain a detected secret.
gh api -X PATCH "repos/$REPO" \
  -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
```

Verify afterwards:

```bash
gh api "repos/$REPO" --jq '.security_and_analysis'
gh api "repos/$REPO/vulnerability-alerts" -i --silent   # 204 = enabled
```

## Protecting `main`

Requires a public repository on a free account. Run this **after** the first CI run on
`main`, so the status-check names already exist:

```bash
REPO=ashwamegh/unsqitch

gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint, typecheck and unit tests",
      "Build (ubuntu-latest)",
      "Build (macos-latest)",
      "Build (windows-latest)",
      "Integration tests (PostgreSQL + Sqitch)",
      "E2E (Electron)",
      "npm audit",
      "Workflow and Electron hardening"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": false
  },
  "required_conversation_resolution": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": null
}
JSON
```

Two deliberate choices there:

- **`enforce_admins: false`** — as the sole maintainer you can still merge your own work
  without a second reviewer. Set it to `true` once there is more than one maintainer.
- **`contexts` must match job names exactly.** A context that never reports blocks every
  merge, so add new required checks only after you have seen them run green once.

Also worth setting under Settings → General:

- Allow squash merging only, and enable "automatically delete head branches".
- Under Actions → General, set workflow permissions to **read-only** by default and
  require approval for workflows from outside collaborators.

## Release signing

The release workflow is intentionally not included yet: packaging signed macOS and
Windows installers needs your own certificates and secrets
(`CSC_LINK`/`CSC_KEY_PASSWORD` for macOS, `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` for
Windows, plus an Apple ID and app-specific password for notarisation). Add those as
repository secrets before wiring up `electron-builder --publish`.
