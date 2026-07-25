import { type ChildProcess, spawn as defaultSpawn } from "node:child_process";
import { type AppError, createAppError } from "../../src/types/error";

export interface SqitchResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StreamCallbacks {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export class SqitchService {
  private _binaryPath: string;
  private activeProcess: ChildProcess | null = null;
  /** Set when cancel() kills the child, so the close handler can say so. */
  private cancelled = false;
  private _spawn: typeof defaultSpawn;

  constructor(binaryPath: string, spawnImpl: typeof defaultSpawn = defaultSpawn) {
    this._binaryPath = binaryPath;
    this._spawn = spawnImpl;
  }

  get binaryPath(): string {
    return this._binaryPath;
  }

  set binaryPath(path: string) {
    this._binaryPath = path;
  }

  public runCommand(
    args: string[],
    cwd: string,
    timeout?: number,
    streams?: StreamCallbacks,
    /**
     * Exit codes to treat as success in addition to 0. `sqitch status` exits 1
     * when a project simply has nothing deployed yet, which is a normal state
     * rather than a failure (a real failure, e.g. an unreachable database, exits 2).
     */
    allowExitCodes: number[] = [],
  ): Promise<SqitchResult> {
    return new Promise((resolve, reject) => {
      // `--chdir` is a top-level sqitch option; passing it (in addition to the
      // spawn cwd) matches the spec's command templates and keeps sqitch pointed
      // at the project directory regardless of the child's inherited cwd.
      const fullArgs = ["--chdir", cwd, ...args];
      const child = this._spawn(this._binaryPath, fullArgs, { cwd });
      this.activeProcess = child;
      this.cancelled = false;

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        streams?.onStdout?.(chunk);
      });

      child.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        streams?.onStderr?.(chunk);
      });

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          child.kill();
          this.activeProcess = null;
          reject(createAppError("command_timeout", `Command timed out after ${timeout}ms`));
        }, timeout);
      }

      child.on("close", (code: number) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.activeProcess = null;

        if (code === 0 || allowExitCodes.includes(code)) {
          resolve({ stdout, stderr, exitCode: code });
        } else if (this.cancelled) {
          // A user-initiated cancel is not a failure; report it as its own type so
          // the UI does not show a crash panel for something the user asked for.
          this.cancelled = false;
          reject({
            ...createAppError("command_cancelled", "Command cancelled", stderr || stdout),
            exitCode: code,
            stdout,
            stderr,
          });
        } else {
          const error: AppError & {
            exitCode: number;
            stdout: string;
            stderr: string;
          } = {
            ...createAppError("sqitch_crash", `sqitch exited with code ${code}`, stderr || stdout),
            exitCode: code,
            stdout,
            stderr,
          };
          reject(error);
        }
      });
    });
  }

  async deploy(
    projectPath: string,
    target: string,
    toChange?: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    const args = ["deploy", target];
    if (toChange) args.push("--to", toChange);
    args.push("--verify");
    return this.runCommand(args, projectPath, timeout, streams);
  }

  async revert(
    projectPath: string,
    target: string,
    toChange?: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    const args = ["revert", target];
    if (toChange) args.push("--to", toChange);
    args.push("-y");
    return this.runCommand(args, projectPath, timeout, streams);
  }

  async verify(
    projectPath: string,
    target: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    return this.runCommand(["verify", target], projectPath, timeout, streams);
  }

  async status(projectPath: string, target: string, timeout?: number): Promise<SqitchResult> {
    return this.runCommand(
      ["status", target, "--show-changes", "--show-tags", "--date-format", "raw"],
      projectPath,
      timeout,
      undefined,
      // Exit 1 means "no changes deployed" — an empty status, not an error.
      [1],
    );
  }

  async log(projectPath: string, target: string, timeout?: number): Promise<SqitchResult> {
    return this.runCommand(["log", target], projectPath, timeout);
  }

  async plan(projectPath: string, timeout?: number): Promise<SqitchResult> {
    return this.runCommand(["plan"], projectPath, timeout);
  }

  async add(
    projectPath: string,
    name: string,
    note: string,
    requires: string[],
    conflicts: string[],
    timeout?: number,
  ): Promise<SqitchResult> {
    const args = ["add", name, "-n", note];
    for (const req of requires) args.push("-r", req);
    for (const conf of conflicts) args.push("-x", conf);
    return this.runCommand(args, projectPath, timeout);
  }

  async init(
    directory: string,
    name: string,
    engine: string,
    uri: string,
    topDir: string,
    planFile: string,
    timeout?: number,
  ): Promise<SqitchResult> {
    const args = ["init", name, "--engine", engine, "--uri", uri, "--top-dir", topDir];
    if (planFile && planFile !== "sqitch.plan") args.push("--plan-file", planFile);
    return this.runCommand(args, directory, timeout);
  }

  cancel(): void {
    if (this.activeProcess) {
      this.cancelled = true;
      this.activeProcess.kill();
      this.activeProcess = null;
    }
  }
}
