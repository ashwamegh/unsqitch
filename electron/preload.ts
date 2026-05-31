import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, WatchEventPayload } from "@shared/ipc-types";

const api = {
  // Project management
  projectOpen: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, { path }),

  projectList: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  projectRemove: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE, { id }),

  projectGet: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, { id }),

  // Sqitch operations
  sqitchDeploy: (projectPath: string, target: string, toChange?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_DEPLOY, {
      projectPath,
      target,
      toChange,
    }),

  sqitchRevert: (projectPath: string, target: string, toChange?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_REVERT, {
      projectPath,
      target,
      toChange,
    }),

  sqitchVerify: (projectPath: string, target: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_VERIFY, { projectPath, target }),

  sqitchStatus: (projectPath: string, target: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_STATUS, { projectPath, target }),

  sqitchLog: (projectPath: string, target: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_LOG, { projectPath, target }),

  sqitchPlan: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_PLAN, { projectPath }),

  sqitchAdd: (
    projectPath: string,
    name: string,
    note: string,
    requires: string[],
    conflicts: string[],
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_ADD, {
      projectPath,
      name,
      note,
      requires,
      conflicts,
    }),

  sqitchInit: (
    directory: string,
    name: string,
    engine: string,
    uri: string,
    topDir: string,
    planFile: string,
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_INIT, {
      directory,
      name,
      engine,
      uri,
      topDir,
      planFile,
    }),

  // Engine/Target/Config
  engineAdd: (
    projectPath: string,
    name: string,
    uri: string,
    client?: string,
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_ADD, {
      projectPath,
      name,
      uri,
      client,
    }),

  engineRemove: (projectPath: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_REMOVE, { projectPath, name }),

  engineList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_LIST, { projectPath }),

  targetAdd: (projectPath: string, name: string, uri: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_ADD, { projectPath, name, uri }),

  targetRemove: (projectPath: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_REMOVE, { projectPath, name }),

  targetList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_LIST, { projectPath }),

  targetGetLabel: (projectId: string, targetName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_GET_LABEL, {
      projectId,
      targetName,
    }),

  targetSetLabel: (projectId: string, targetName: string, label: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_SET_LABEL, {
      projectId,
      targetName,
      label,
    }),

  configList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LIST, { projectPath }),

  configSet: (projectPath: string, key: string, value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, { projectPath, key, value }),

  configUnset: (projectPath: string, key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UNSET, { projectPath, key }),

  // Sqitch binary
  sqitchDetect: () => ipcRenderer.invoke(IPC_CHANNELS.SQITCH_DETECT),

  sqitchVersion: () => ipcRenderer.invoke(IPC_CHANNELS.SQITCH_VERSION),

  sqitchCancel: () => ipcRenderer.invoke(IPC_CHANNELS.SQITCH_CANCEL),

  // Native dialogs
  dialogOpenDirectory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),

  // Stream listeners
  onSqitchStream: (
    callback: (event: {
      projectPath: string;
      data: string;
      type: "stdout" | "stderr";
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { projectPath: string; data: string; type: "stdout" | "stderr" },
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SQITCH_STREAM, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.SQITCH_STREAM, handler);
  },

  onSqitchComplete: (
    callback: (event: {
      projectPath: string;
      exitCode: number;
      command: string;
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { projectPath: string; exitCode: number; command: string },
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SQITCH_COMPLETE, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.SQITCH_COMPLETE, handler);
  },

  onSqitchError: (
    callback: (event: {
      projectPath: string;
      error: string;
      type: string;
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { projectPath: string; error: string; type: string },
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SQITCH_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SQITCH_ERROR, handler);
  },

  onStatusStale: (callback: (payload: { threshold?: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { threshold?: number },
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.STATUS_STALE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STATUS_STALE, handler);
  },

  // File watching
  watchStart: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_START, { projectPath }),

  watchStop: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_STOP, { projectPath }),

  onWatchEvent: (callback: (event: WatchEventPayload) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: WatchEventPayload,
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WATCH_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WATCH_EVENT, handler);
  },

  // Settings
  settingsGet: (key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, { key }),

  settingsSet: (key: string, value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),

  // Editor integration
  editorOpenFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EDITOR_OPEN_FILE, { filePath }),

  editorDetect: () => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_DETECT),
};

contextBridge.exposeInMainWorld("unsqitch", api);

export type UnsqitchAPI = typeof api;
