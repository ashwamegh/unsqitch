# Releasing

Releases are produced by [`.github/workflows/release.yml`](../.github/workflows/release.yml)
when a `v*` tag is pushed. It builds installers on four runners, checks each package is
actually usable, attaches signed build provenance, and publishes a **pre-release**.

## Cutting a release

```bash
# 1. Update the version and the changelog in the same commit.
#    package.json "version" and a "## [x.y.z] - YYYY-MM-DD" section in CHANGELOG.md,
#    because the workflow extracts the release notes from that section by version.
git switch -c release/0.2.0
# ...edit package.json and CHANGELOG.md...
git commit -m "chore(release): 0.2.0"

# 2. Merge it to main through a PR as usual, then tag the merge commit.
git switch main && git pull
git tag -a v0.2.0 -m "UnSqitch 0.2.0"
git push origin v0.2.0
```

The tag drives everything, and `gh release create --verify-tag` refuses to invent one, so a
mistyped tag fails loudly instead of publishing something unexpected.

To rebuild an existing tag (a runner failure, say) use the **Run workflow** button and give
it the tag name.

## What the workflow guards against

Two defects in the packaging configuration survived until the first real packaging attempt,
and both produced an installer that looked fine:

- `files` excluded `out/renderer/**/*`, while `electron/main.ts` loads
  `out/renderer/index.html` at runtime — the app would have opened a blank window.
- `mac.universalBuild` is not a valid electron-builder 26 option, so packaging failed
  outright with a schema error.

So the workflow asserts, on every platform, that the built `app.asar` contains
`renderer/index.html` and that `better-sqlite3` was unpacked where the app can `dlopen` it.
A green build therefore means "this package can open a window and its database", not merely
"electron-builder exited 0".

## Signing

Builds are currently **unsigned**. The workflow already passes the signing environment
through to electron-builder, so adding the secrets below switches signing on with no change
to the workflow:

| Secret | Purpose |
| ------ | ------- |
| `CSC_LINK` | base64 of your macOS Developer ID `.p12` |
| `CSC_KEY_PASSWORD` | password for that `.p12` |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | notarisation |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Windows code-signing certificate |

Until then, users see a Gatekeeper prompt on macOS and SmartScreen on Windows. The release
notes explain both, and every artifact carries provenance that can be verified:

```bash
gh attestation verify UnSqitch-0.1.0-arm64.dmg --repo ashwamegh/unsqitch
```

That is not a substitute for code signing — it proves which workflow, commit and runner
built the file, not that an OS vendor trusts it — but it is checkable by anyone.

## Architectures

| Runner | Produces |
| ------ | -------- |
| `macos-latest` | macOS **arm64** (`.dmg`, `.zip`) |
| `ubuntu-latest` | Linux x64 (`.AppImage`, `.deb`) |
| `windows-latest` | Windows x64 (`.exe` installer) |

**There is no Intel macOS build**, and that is deliberate. Two things were tried:

- The `macos-13` Intel runner queued indefinitely without starting — it has been retired.
- Cross-building with `electron-builder --mac --x64` on an arm64 runner *succeeds*, and
  produces an x64 app containing an **arm64** `better-sqlite3`
  (`Mach-O 64-bit bundle arm64` under `bin/darwin-arm64-148/`). That app would crash on an
  Intel Mac as soon as it opened its database.

Shipping nothing is better than shipping that, so Intel users build from source for now.
Wiring up a current Intel runner is the fix; the release workflow already asserts on macOS
that the bundled native module's architecture matches the target, so a future Intel job
cannot quietly reintroduce the mismatch.

Windows arm64 and Linux arm64 are also not built — stated plainly rather than shipping an
x64 binary under an arm64 name.

## After publishing

The release is a **pre-release**, so it is downloadable but not presented as the latest
stable version. Promote it in the GitHub UI when you are happy with it.

Worth doing once per release: download one artifact per platform and actually open it. The
workflow checks the package contents, but nothing in CI clicks through the app on Windows.
