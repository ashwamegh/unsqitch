// IPC channel definitions — shared between main and renderer via @shared alias

// Sqitch commands
export const IPC_CHANNELS = {
  // Project management
  PROJECT_OPEN: "project:open",
  PROJECT_LIST: "project:list",
  PROJECT_REMOVE: "project:remove",
  PROJECT_GET: "project:get",

  // Sqitch operations
  SQITCH_DEPLOY: "sqitch:deploy",
  SQITCH_REVERT: "sqitch:revert",
  SQITCH_VERIFY: "sqitch:verify",
  SQITCH_STATUS: "sqitch:status",
  SQITCH_LOG: "sqitch:log",
  SQITCH_PLAN: "sqitch:plan",
  SQITCH_ADD: "sqitch:add",
  SQITCH_INIT: "sqitch:init",

  // Engine/Target/Config
  ENGINE_ADD: "engine:add",
  ENGINE_REMOVE: "engine:remove",
  ENGINE_LIST: "engine:list",
  TARGET_ADD: "target:add",
  TARGET_REMOVE: "target:remove",
  TARGET_LIST: "target:list",
  TARGET_GET_LABEL: "target:getLabel",
  TARGET_SET_LABEL: "target:setLabel",
  CONFIG_LIST: "config:list",
  CONFIG_SET: "config:set",
  CONFIG_UNSET: "config:unset",

  // Sqitch binary
  SQITCH_DETECT: "sqitch:detect",
  SQITCH_VERSION: "sqitch:version",
  SQITCH_CANCEL: "sqitch:cancel",

  // File watching
  WATCH_START: "watch:start",
  WATCH_STOP: "watch:stop",
  WATCH_EVENT: "watch:event", // main → renderer

  // Native dialogs (main → renderer request, main handles)
  DIALOG_OPEN_DIRECTORY: "dialog:openDirectory",
  DIALOG_OPEN_FILE: "dialog:openFile",

  // Stream events (main → renderer)
  SQITCH_STREAM: "sqitch:stream",
  SQITCH_COMPLETE: "sqitch:complete",
  SQITCH_ERROR: "sqitch:error",
  STATUS_STALE: "status:stale",

  // Settings
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",

  // Editor integration
  EDITOR_OPEN_FILE: "editor:openFile",
  EDITOR_DETECT: "editor:detect",

  // Read-only script content + command history
  SCRIPT_READ: "script:read",
  SCRIPT_PATH: "script:path",
  RECENT_COMMANDS: "commands:recent",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// Request/Response types per channel
export interface ProjectOpenRequest {
  path: string;
}

export interface ProjectOpenResponse {
  project: {
    id: string;
    name: string;
    path: string;
    engine: string;
    changeCount: number;
  } | null;
  error?: string;
}

export interface ProjectListResponse {
  projects: Array<{
    id: string;
    name: string;
    path: string;
    engine: string;
    changeCount: number;
    lastDeployment?: string;
    lastOpened: string;
  }>;
}

export interface SqitchDeployRequest {
  projectPath: string;
  target: string;
  toChange?: string;
}

export interface SqitchRevertRequest {
  projectPath: string;
  target: string;
  toChange?: string;
}

export interface SqitchVerifyRequest {
  projectPath: string;
  target: string;
}

export interface SqitchStatusRequest {
  projectPath: string;
  target: string;
}

export interface SqitchLogRequest {
  projectPath: string;
  target: string;
}

export interface SqitchPlanRequest {
  projectPath: string;
}

export interface SqitchAddRequest {
  projectPath: string;
  name: string;
  note: string;
  requires: string[];
  conflicts: string[];
}

export interface SqitchInitRequest {
  directory: string;
  name: string;
  engine: string;
  uri: string;
  topDir: string;
  planFile: string;
}

export interface SqitchStreamEvent {
  projectPath: string;
  data: string;
  type: "stdout" | "stderr";
}

export interface SqitchCompleteEvent {
  projectPath: string;
  exitCode: number;
  command: string;
}

export interface SqitchErrorEvent {
  projectPath: string;
  error: string;
  type: string;
  sqitchOutput?: string;
}

export interface TargetAddRequest {
  projectPath: string;
  name: string;
  uri: string;
}

export interface TargetGetLabelRequest {
  projectId: string;
  targetName: string;
}

export interface TargetSetLabelRequest {
  projectId: string;
  targetName: string;
  label: string;
}

export interface EngineAddRequest {
  projectPath: string;
  name: string;
  uri: string;
  client?: string;
}

export interface SettingsGetRequest {
  key: string;
}

export interface SettingsSetRequest {
  key: string;
  value: string;
}

export interface DialogOpenDirectoryResponse {
  canceled: boolean;
  path: string | null;
}

export interface EditorOpenFileRequest {
  filePath: string;
}

export interface EditorOpenFileResponse {
  editorName: string;
}

export interface EditorDetectResponse {
  command: string | null;
  name: string;
}

export interface WatchEventPayload {
  projectPath: string;
  type: "plan" | "script";
  filePath: string;
  action: "change" | "add" | "unlink";
}
