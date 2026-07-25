# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/ashwamegh/unsqitch/security/advisories/new)
(Security → Report a vulnerability). If that is unavailable to you, open a normal issue
containing only "security report, please contact me" and no details, and a maintainer
will arrange a private channel.

Please include, where you can:

- what an attacker can achieve, and what access they need to start
- steps to reproduce, ideally against `tests/fixtures/test-project`
- affected version (`package.json` version or commit SHA), OS, and Sqitch version

You can expect an acknowledgement within a few days and an assessment of severity and
a fix plan after that. Timelines are best-effort — this is a volunteer-maintained
project. We will credit you in the release notes unless you prefer otherwise.

## Supported versions

The project is pre-1.0 in practice: only the latest `main` receives fixes. There are no
backports to older tags.

## What is in scope

UnSqitch is a desktop GUI that wraps the Sqitch CLI. The interesting attack surface is
mostly about **credentials, process execution, and untrusted project files**:

- leaking database credentials — to disk, to logs, to the terminal panel, or into the
  recorded command history
- command injection through a project path, target URI, change name, or config value
  that reaches a spawned process
- reading or writing files outside the opened project directory
- Electron hardening failures (renderer gaining Node access, navigation to remote
  content, unsafe `webPreferences`)
- anything that lets an opened project execute code without the user deploying it

Vulnerabilities in Sqitch itself, or in a database server, belong upstream — but tell
us anyway if UnSqitch makes them materially easier to exploit.

## Design notes relevant to security

These are deliberate properties of the current implementation. If you find any of them
to be untrue, that is a bug worth reporting:

- **Passwords are session-only.** Target URIs containing credentials are held in memory
  for the session and are never written to the app database (`~/.unsqitch/app.db`).
- **Command history is redacted.** Entries in `recent_commands` pass through
  `redactCommand()`, which masks `user:password@` in URIs before storage.
- **The renderer is sandboxed from the system.** `contextIsolation` is on,
  `nodeIntegration` is off, and the renderer reaches the filesystem and the CLI only
  through the explicitly enumerated IPC channels in `electron/shared/ipc-types.ts`.
- **Sqitch is invoked with an argument array**, never through a shell string, so values
  are not word-split or interpreted by a shell.
- **Sqitch stores target URIs itself.** If a user embeds a password in a URI, Sqitch
  will write it into `sqitch.conf`. UnSqitch cannot prevent that and warns against it
  in the target form; prefer `.pgpass`, environment variables, or engine auth files.

## Automated checks

These properties are not just documented, they are enforced on every push and pull
request: `tests/unit/electron-security.test.ts` asserts context isolation, the absence
of Node integration, that Sqitch is spawned with an argument array rather than a shell
string, and that command history goes through the redacting helper. CodeQL, `npm audit`
and dependency review run alongside it — see
[docs/REPOSITORY-HARDENING.md](docs/REPOSITORY-HARDENING.md).

## Out of scope

- The app trusts the local user; it is not a multi-tenant boundary.
- Anything requiring an attacker who already has code execution as your user.
- Opening a project whose SQL scripts are malicious: reviewing scripts before deploying
  them is the user's responsibility, though we do not execute them until you deploy.
