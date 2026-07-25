export type ErrorType =
  | "sqitch_crash"
  | "db_connection"
  | "file_permission"
  | "binary_not_found"
  | "partial_deployment"
  | "command_timeout"
  | "unknown";

export interface ErrorAction {
  label: string;
  action:
    | "retry"
    | "revert"
    | "view_log"
    | "check_connection"
    | "open_settings"
    | "open_file_manager"
    | "refresh";
}

export interface AppError {
  type: ErrorType;
  message: string;
  sqitchOutput?: string;
  recoverable: boolean;
  actions: ErrorAction[];
}

/**
 * Infer the most specific ErrorType from sqitch stderr + exit code so the UI can
 * offer the right recovery actions (spec "Error Handling" table). Falls back to
 * sqitch_crash for a generic non-zero exit, or unknown when nothing matches.
 */
export function classifyError(
  stderr: string | undefined,
  exitCode: number | null,
  stdout?: string,
): ErrorType {
  // sqitch reports some failures (notably connection errors) on stdout, so both
  // streams must be considered.
  const s = `${stderr || ""}\n${stdout || ""}`.toLowerCase();
  if (
    /command not found|no such file or directory|enoent|is not recognized|cannot find the path/.test(
      s,
    ) &&
    /sqitch/.test(s)
  ) {
    return "binary_not_found";
  }
  if (
    /could not connect|connection refused|could not translate host|authentication failed|password authentication|role .* does not exist|database .* does not exist|access denied for user|can't connect|no such host|timeout expired|server closed the connection/.test(
      s,
    )
  ) {
    return "db_connection";
  }
  if (/permission denied|eacces|read-only file system|operation not permitted/.test(s)) {
    return "file_permission";
  }
  if (
    /is not the last change|requires .* to be deployed|cannot revert|partially deployed|middle of a deploy/.test(
      s,
    )
  ) {
    return "partial_deployment";
  }
  if (exitCode !== null && exitCode !== 0) return "sqitch_crash";
  return "unknown";
}

const ERROR_TYPES: ErrorType[] = [
  "sqitch_crash",
  "db_connection",
  "file_permission",
  "binary_not_found",
  "partial_deployment",
  "command_timeout",
  "unknown",
];

/**
 * Rebuild an AppError from an error thrown across Electron IPC.
 *
 * Electron drops custom properties and prefixes the message with
 * "Error invoking remote method '<channel>':", so the type is encoded into the
 * message as "<type>: <message>" by the main process and recovered here.
 */
export function parseIpcError(err: unknown, fallbackMessage = "Command failed"): AppError {
  const raw = (err as { message?: string })?.message ?? String(err ?? "");
  const withoutChannel = raw.replace(/^Error invoking remote method '[^']*':\s*/, "");
  const cleaned = withoutChannel.replace(/^(?:Error|UnhandledError):\s*/, "");

  const match = cleaned.match(/^([a-z_]+):\s*([\s\S]*)$/);
  const type =
    match && (ERROR_TYPES as string[]).includes(match[1]) ? (match[1] as ErrorType) : null;

  const explicitType = (err as { type?: ErrorType })?.type;
  return createAppError(
    type ?? (explicitType && ERROR_TYPES.includes(explicitType) ? explicitType : "sqitch_crash"),
    (type ? match?.[2] : cleaned) || fallbackMessage,
    (err as { sqitchOutput?: string })?.sqitchOutput,
  );
}

export function createAppError(type: ErrorType, message: string, sqitchOutput?: string): AppError {
  const actionMap: Record<ErrorType, ErrorAction[]> = {
    sqitch_crash: [
      { label: "View Log", action: "view_log" },
      { label: "Revert Successful", action: "revert" },
      { label: "Retry", action: "retry" },
    ],
    db_connection: [
      { label: "Check Connection", action: "check_connection" },
      { label: "Retry", action: "retry" },
    ],
    file_permission: [{ label: "Open File Manager", action: "open_file_manager" }],
    binary_not_found: [{ label: "Open Settings", action: "open_settings" }],
    partial_deployment: [
      { label: "Deploy Remaining", action: "retry" },
      { label: "Revert All", action: "revert" },
    ],
    command_timeout: [
      { label: "Retry", action: "retry" },
      { label: "Open Settings", action: "open_settings" },
    ],
    unknown: [{ label: "Refresh", action: "refresh" }],
  };

  return {
    type,
    message,
    sqitchOutput,
    recoverable: type !== "binary_not_found",
    actions: actionMap[type],
  };
}
