# Repository hardening

The automated checks live in `.github/workflows/`. A few protections are *repository
settings* rather than code; those are recorded here with the commands that set them, so
the configuration is reviewable and reproducible rather than a series of clicks somebody
made once.

## What runs automatically

| Check | Workflow | When |
| ----- | -------- | ---- |
| Lint, typecheck, unit tests | `ci.yml` | every push and PR |
| Cross-platform build (macOS/Linux/Windows) | `ci.yml` | every push and PR |
| Integration tests against real PostgreSQL + Sqitch | `ci.yml` | every push and PR |
| E2E against the built Electron app | `ci.yml` | every push and PR |
| Dependency audit of shipped deps (fails on high/critical) | `security.yml` | push, PR, weekly |
| Dependency review of PR changes, with a copyleft-licence deny list | `security.yml` | PRs |
| Electron security invariants + workflow permission audit | `security.yml` | push, PR, weekly |
| Single-package-manager check (no stray lockfiles, bun version pins agree) | `security.yml` | push, PR, weekly |
| CodeQL static analysis | `codeql.yml` | push, PR, weekly |
| OpenSSF Scorecard | `scorecard.yml` | push to main, weekly |
| Dependency version updates, grouped | `dependabot.yml` | weekly (bun), monthly (actions) |

Workflow hardening already applied: a top-level least-privilege `permissions` block in
every workflow, all third-party actions pinned to commit SHAs (Dependabot bumps them),
and `persist-credentials: false` on every checkout so the token is not written into
`.git/config`.

## The audit gate, and why it is not just `bun audit`

`bun audit` has no `--omit=dev` equivalent, and its JSON output carries no prod/dev
distinction, so auditing the whole tree would fail the build on advisories in the build
toolchain — which never ship to a user. A whole-tree gate would be permanently red, and a
permanently red gate gets switched off.

[`scripts/audit-prod.mjs`](../scripts/audit-prod.mjs) instead resolves a throwaway tree
containing only the `dependencies` block and audits that (`bun install --lockfile-only`,
so nothing is installed). That reproduces the previous `npm audit --omit=dev
--audit-level=high` behaviour exactly. Dev-dependency advisories are still printed on
every run by `bun run audit:all`, without failing the build.

## Known gap: Dependabot security updates do not cover bun

GitHub's [supported ecosystems table][ecosystems] lists Bun as **Supported** for version
updates and **Not supported** for security updates. Because this project installs with
bun and commits `bun.lock`, Dependabot will not open automatic PRs in response to
advisories, as it does for npm projects.

What still covers that gap:

- **Dependabot alerts** are enabled and unaffected — advisories are still detected and
  reported in the Security tab.
- **The audit gate** in `security.yml` fails the build on high/critical advisories in
  shipped dependencies, so an affected dependency cannot merge unnoticed.
- **Weekly version-update PRs** pull most fixes in as ordinary bumps; the interval is
  weekly rather than monthly for this reason.

The remaining cost is that applying a security fix is a manual step. Revisit if GitHub
adds bun to the security-updates column.

Alerts depend on GitHub parsing `bun.lock` into the dependency graph, and the graph is
built from the **default branch** only. Confirm it after the bun change lands on `main`
— the versions reported should match `bun.lock`, not the deleted `package-lock.json`:

```bash
gh api repos/ashwamegh/unsqitch/dependency-graph/sbom \
  --jq '.sbom.packages[] | select(.name == "@biomejs/biome") | "\(.name) \(.versionInfo)"'
```

If the graph still reports the old versions well after the merge, it is not reading
`bun.lock`; in that case alerts would only see the direct dependencies declared in
`package.json`, and transitive advisories (the majority) would go unreported. The
fallback is to submit the dependency graph explicitly from CI via the
[dependency submission API][submission].

[submission]: https://docs.github.com/en/rest/dependency-graph/dependency-submission

[ecosystems]: https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories

## Settings that are enabled

Applied and verified on the public repository:

```bash
REPO=ashwamegh/unsqitch

# Dependabot alerts, and automatic PRs for vulnerable dependencies where the
# ecosystem supports them (see the gap noted above for bun).
gh api -X PUT "repos/$REPO/vulnerability-alerts"
gh api -X PUT "repos/$REPO/automated-security-fixes"

# Let people report vulnerabilities privately (this is what SECURITY.md links to).
gh api -X PUT "repos/$REPO/private-vulnerability-reporting"

# Secret scanning, and blocking pushes that contain a detected secret.
gh api -X PATCH "repos/$REPO" \
  -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'

# Squash-only merges, with the PR title as the commit subject, and head branches
# deleted on merge. Squash keeps main linear, which required_linear_history enforces.
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY
```

Verify:

```bash
gh api "repos/$REPO" --jq '.security_and_analysis, {squash:.allow_squash_merge, merge:.allow_merge_commit, rebase:.allow_rebase_merge}'
gh api "repos/$REPO/vulnerability-alerts" -i --silent   # 204 = enabled
```

Note that secret scanning, code scanning, private vulnerability reporting and the
dependency graph are only free on **public** repositories; on a private repository
without GitHub Advanced Security the same calls fail (and `secret_scanning` returns
"Secret scanning is not available for this repository"). Branch protection and rulesets
also return 403 on a private repository on a free plan.

Also applied, so a compromised or careless workflow cannot write to the repository:

```bash
# The default GITHUB_TOKEN is read-only; jobs needing more request it explicitly.
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
```

## Protecting `main`

Applied. Status-check contexts must match job names *exactly*: a context that never
reports blocks every merge, so these were taken from a run that had actually reported
them.

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
      "Audit dependencies",
      "Workflow and Electron hardening",
      "Analyze (javascript-typescript)"
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

Four deliberate choices:

- **`enforce_admins: false`** — as the sole maintainer you can still merge your own work
  without a second reviewer, and you are not locked out of your own repository. Set it to
  `true` once there is more than one maintainer.
- **`required_linear_history: true`** pairs with squash-only merging; both would fight a
  merge commit.
- **The audit job is named "Audit dependencies"**, deliberately not "npm audit" or "bun
  audit". Renaming a required check silently blocks every merge, so the name is kept
  free of the package manager.
- **"Dependency review" is deliberately *not* required.** It runs on pull requests and is
  worth reading, but on a pull request from a fork the token is read-only, so requiring it
  risks blocking outside contributors on a check that cannot report. The blocking gate for
  dependencies is the audit job, which has no such constraint.

One caveat to remember: "Analyze (javascript-typescript)" is required, and `codeql.yml`
skips itself if the repository is ever made private again (code scanning needs Advanced
Security there). A skipped required check does not report, which would block all merges —
so if the repository goes private, drop that context from the list at the same time.

Still worth setting by hand under Settings → Actions → General: require approval for
workflows from first-time contributors.

## Release signing

The release workflow is intentionally not included yet: packaging signed macOS and
Windows installers needs your own certificates and secrets
(`CSC_LINK`/`CSC_KEY_PASSWORD` for macOS, `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` for
Windows, plus an Apple ID and app-specific password for notarisation). Add those as
repository secrets before wiring up `electron-builder --publish`.
