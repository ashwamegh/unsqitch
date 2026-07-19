import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { parseLogOutput } from "../src/lib/log-parser";
import { parsePlanFile } from "../src/lib/plan-parser";
import { parseSqitchOutput } from "../src/lib/sqitch-parser";
import { parseStatusOutput } from "../src/lib/status-parser";
import { classifyError, createAppError, type ErrorType } from "../src/types/error";
import { checkSqitchVersion, detectSqitchBinary } from "./services/binary-detector";
import { ConfigService } from "./services/config.service";
import { EditorService } from "./services/editor.service";
import { EngineService } from "./services/engine.service";
import { FileWatcherService } from "./services/file-watcher.service";
import { ProjectService } from "./services/project.service";
import { SqitchService } from "./services/sqitch.service";
import { TargetService } from "./services/target.service";
import { IPC_CHANNELS } from "./shared/ipc-types";

let mainWindow: BrowserWindow | null = null;
let sqitchService: SqitchService;
let projectService: ProjectService;
let configService: ConfigService;
let engineService: EngineService;
let targetService: TargetService;
let fileWatcherService: FileWatcherService;
let editorService: EditorService;

const DEFAULT_TIMEOUT = 5 * 60 * 1000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function getTimeout(): number {
  const timeoutStr = projectService.getSetting("commandTimeout");
  return timeoutStr ? parseInt(timeoutStr, 10) : DEFAULT_TIMEOUT;
}

// Derive display metadata for a project directory without a DB connection:
// engine from sqitch.conf's `engine = X`, change count from the plan file.
function deriveProjectMeta(projectPath: string): { engine: string; changeCount: number } {
  let engine = "unknown";
  let changeCount = 0;
  try {
    const conf = fs.readFileSync(path.join(projectPath, "sqitch.conf"), "utf-8");
    const match = conf.match(/^\s*engine\s*=\s*(\S+)/m);
    if (match) engine = match[1];
  } catch {
    // no sqitch.conf — leave engine as "unknown"
  }
  try {
    const plan = fs.readFileSync(path.join(projectPath, "sqitch.plan"), "utf-8");
    changeCount = parsePlanFile(plan).changes.length;
  } catch {
    // no plan file — leave changeCount at 0
  }
  return { engine, changeCount };
}

// Spec: quick-check the binary exists at the cached path before every command.
function ensureBinary(): void {
  const found = detectSqitchBinary(sqitchService.binaryPath);
  if (!found) {
    throw createAppError(
      "binary_not_found",
      `Sqitch binary not found at "${sqitchService.binaryPath}". Set the correct path in Settings.`,
    );
  }
}

// Record a (credential-redacted) command in the project's history.
function recordSqitchCommand(
  projectPath: string,
  commandArgs: string[],
  exitCode: number | null,
): void {
  const project = projectService.getProjectByPath(projectPath);
  if (!project) return;
  projectService.recordCommand(project.id, `sqitch ${commandArgs.join(" ")}`, exitCode);
}

// Reuse a specific error type thrown upstream (timeout, binary_not_found); otherwise
// infer the type from the sqitch stderr so the UI can offer the right recovery actions.
function resolveErrorType(err: {
  type?: ErrorType;
  stderr?: string;
  sqitchOutput?: string;
  exitCode?: number;
}): ErrorType {
  if (err.type && err.type !== "sqitch_crash") return err.type;
  return classifyError(err.stderr || err.sqitchOutput, err.exitCode ?? null);
}

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.SQITCH_DETECT, async () => {
    const customPath = projectService.getSetting("sqitchPath");
    const binaryPath = detectSqitchBinary(customPath || undefined);
    if (!binaryPath) {
      return { found: false, path: null, version: null, meetsMinimum: false };
    }
    const versionInfo = checkSqitchVersion(binaryPath);
    if (sqitchService) {
      sqitchService.binaryPath = binaryPath;
    }
    return {
      found: true,
      path: binaryPath,
      version: versionInfo?.version ?? null,
      meetsMinimum: versionInfo?.meetsMinimum ?? false,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_VERSION, async () => {
    const binaryPath = sqitchService.binaryPath;
    return checkSqitchVersion(binaryPath);
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_CANCEL, async () => {
    sqitchService.cancel();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    });
    return { canceled: result.canceled, path: result.filePaths[0] || null };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, request: { path: string }) => {
    const hasPlan = fs.existsSync(path.join(request.path, "sqitch.plan"));
    const hasConf = fs.existsSync(path.join(request.path, "sqitch.conf"));
    if (!hasPlan && !hasConf) {
      return {
        project: null,
        error: "Not a Sqitch project: no sqitch.plan or sqitch.conf found in directory",
      };
    }
    const existing = projectService.getProjectByPath(request.path);
    const id =
      existing?.id ??
      projectService.addProject({
        name: path.basename(request.path),
        path: request.path,
        engine: "unknown",
      });
    // Populate engine + change count from the project files (no DB connection).
    projectService.updateProjectMeta(id, deriveProjectMeta(request.path));
    fileWatcherService.start(request.path);
    return { project: projectService.getProject(id) };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return { projects: projectService.listProjects() };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_REMOVE, async (_event, request: { id: string }) => {
    const project = projectService.getProject(request.id);
    if (project) {
      fileWatcherService.stop(project.path);
    }
    projectService.removeProject(request.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_event, request: { id: string }) => {
    return projectService.getProject(request.id);
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_DEPLOY, async (event, request) => {
    const cmdArgs = ["deploy", request.target];
    if (request.toChange) cmdArgs.push("--to", request.toChange);
    cmdArgs.push("--verify");
    try {
      ensureBinary();
      const sender = event.sender;
      const result = await sqitchService.deploy(
        request.projectPath,
        request.target,
        request.toChange,
        getTimeout(),
        {
          onStdout: (data) =>
            sender.send(IPC_CHANNELS.SQITCH_STREAM, {
              projectPath: request.projectPath,
              data,
              type: "stdout",
            }),
          onStderr: (data) =>
            sender.send(IPC_CHANNELS.SQITCH_STREAM, {
              projectPath: request.projectPath,
              data,
              type: "stderr",
            }),
        },
      );
      recordSqitchCommand(request.projectPath, cmdArgs, result.exitCode);
      const project = projectService.getProjectByPath(request.projectPath);
      if (project) {
        projectService.updateProjectMeta(project.id, {
          lastDeployment: new Date().toISOString(),
        });
      }
      const parsed = parseSqitchOutput(result.stdout);
      sender.send(IPC_CHANNELS.SQITCH_COMPLETE, {
        projectPath: request.projectPath,
        exitCode: result.exitCode,
        command: "deploy",
      });
      return parsed;
    } catch (err: any) {
      recordSqitchCommand(request.projectPath, cmdArgs, err.exitCode ?? null);
      const error = createAppError(
        resolveErrorType(err),
        err.message,
        err.stderr || err.sqitchOutput,
      );
      event.sender.send(IPC_CHANNELS.SQITCH_ERROR, {
        projectPath: request.projectPath,
        error: error.message,
        type: error.type,
        sqitchOutput: error.sqitchOutput,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_REVERT, async (event, request) => {
    const cmdArgs = ["revert", request.target];
    if (request.toChange) cmdArgs.push("--to", request.toChange);
    cmdArgs.push("-y");
    try {
      ensureBinary();
      const sender = event.sender;
      const result = await sqitchService.revert(
        request.projectPath,
        request.target,
        request.toChange,
        getTimeout(),
        {
          onStdout: (data) =>
            sender.send(IPC_CHANNELS.SQITCH_STREAM, {
              projectPath: request.projectPath,
              data,
              type: "stdout",
            }),
          onStderr: (data) =>
            sender.send(IPC_CHANNELS.SQITCH_STREAM, {
              projectPath: request.projectPath,
              data,
              type: "stderr",
            }),
        },
      );
      recordSqitchCommand(request.projectPath, cmdArgs, result.exitCode);
      sender.send(IPC_CHANNELS.SQITCH_COMPLETE, {
        projectPath: request.projectPath,
        exitCode: result.exitCode,
        command: "revert",
      });
      return parseSqitchOutput(result.stdout);
    } catch (err: any) {
      recordSqitchCommand(request.projectPath, cmdArgs, err.exitCode ?? null);
      const error = createAppError(
        resolveErrorType(err),
        err.message,
        err.stderr || err.sqitchOutput,
      );
      event.sender.send(IPC_CHANNELS.SQITCH_ERROR, {
        projectPath: request.projectPath,
        error: error.message,
        type: error.type,
        sqitchOutput: error.sqitchOutput,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_VERIFY, async (event, request) => {
    try {
      ensureBinary();
      const sender = event.sender;
      const result = await sqitchService.verify(request.projectPath, request.target, getTimeout(), {
        onStdout: (data) =>
          sender.send(IPC_CHANNELS.SQITCH_STREAM, {
            projectPath: request.projectPath,
            data,
            type: "stdout",
          }),
        onStderr: (data) =>
          sender.send(IPC_CHANNELS.SQITCH_STREAM, {
            projectPath: request.projectPath,
            data,
            type: "stderr",
          }),
      });
      recordSqitchCommand(request.projectPath, ["verify", request.target], result.exitCode);
      sender.send(IPC_CHANNELS.SQITCH_COMPLETE, {
        projectPath: request.projectPath,
        exitCode: result.exitCode,
        command: "verify",
      });
      return parseSqitchOutput(result.stdout);
    } catch (err: any) {
      const error = createAppError(
        resolveErrorType(err),
        err.message,
        err.stderr || err.sqitchOutput,
      );
      event.sender.send(IPC_CHANNELS.SQITCH_ERROR, {
        projectPath: request.projectPath,
        error: error.message,
        type: error.type,
        sqitchOutput: error.sqitchOutput,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_STATUS, async (_event, request) => {
    try {
      ensureBinary();
      const result = await sqitchService.status(request.projectPath, request.target, getTimeout());
      return parseStatusOutput(result.stdout);
    } catch (err: any) {
      throw createAppError(resolveErrorType(err), err.message, err.stderr || err.sqitchOutput);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_LOG, async (_event, request) => {
    try {
      ensureBinary();
      const result = await sqitchService.log(request.projectPath, request.target, getTimeout());
      return parseLogOutput(result.stdout);
    } catch (err: any) {
      throw createAppError(resolveErrorType(err), err.message, err.stderr || err.sqitchOutput);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_PLAN, async (_event, request) => {
    try {
      const planPath = path.join(request.projectPath, "sqitch.plan");
      const content = fs.readFileSync(planPath, "utf-8");
      return parsePlanFile(content);
    } catch (err: any) {
      throw createAppError("file_permission", `Failed to read plan file: ${err.message}`);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SCRIPT_READ,
    async (_event, request: { projectPath: string; changeName: string; kind: string }) => {
      const kind = ["deploy", "revert", "verify"].includes(request.kind) ? request.kind : "deploy";
      const scriptPath = path.join(request.projectPath, kind, `${request.changeName}.sql`);
      try {
        const content = fs.readFileSync(scriptPath, "utf-8");
        return { content, path: scriptPath, error: null };
      } catch (err: any) {
        return { content: null, path: scriptPath, error: err.message };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.SQITCH_ADD, async (_event, request) => {
    try {
      ensureBinary();
      const result = await sqitchService.add(
        request.projectPath,
        request.name,
        request.note,
        request.requires,
        request.conflicts,
        getTimeout(),
      );
      recordSqitchCommand(request.projectPath, ["add", request.name], result.exitCode);
      // Change count changed — refresh cached project metadata.
      const project = projectService.getProjectByPath(request.projectPath);
      if (project)
        projectService.updateProjectMeta(project.id, deriveProjectMeta(request.projectPath));
      return { success: true, stdout: result.stdout };
    } catch (err: any) {
      throw createAppError(resolveErrorType(err), err.message, err.stderr || err.sqitchOutput);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_INIT, async (_event, request) => {
    try {
      ensureBinary();
      if (!fs.existsSync(request.directory)) {
        fs.mkdirSync(request.directory, { recursive: true });
      }
      const result = await sqitchService.init(
        request.directory,
        request.name,
        request.engine,
        request.uri,
        request.topDir,
        request.planFile,
        getTimeout(),
      );
      return { success: true, stdout: result.stdout };
    } catch (err: any) {
      throw createAppError(resolveErrorType(err), err.message, err.stderr || err.sqitchOutput);
    }
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_COMMANDS, async (_event, request: { projectPath: string }) => {
    const project = projectService.getProjectByPath(request.projectPath);
    if (!project) return { commands: [] };
    return { commands: projectService.getRecentCommands(project.id) };
  });

  ipcMain.handle(IPC_CHANNELS.ENGINE_ADD, async (_event, request) => {
    await engineService.add(request.projectPath, request.name, request.uri, request.client);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ENGINE_REMOVE, async (_event, request) => {
    await engineService.remove(request.projectPath, request.name);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ENGINE_LIST, async (_event, request) => {
    return engineService.list(request.projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_ADD, async (_event, request) => {
    await targetService.add(request.projectPath, request.name, request.uri);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_REMOVE, async (_event, request) => {
    await targetService.remove(request.projectPath, request.name);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_LIST, async (_event, request) => {
    return targetService.list(request.projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_GET_LABEL, async (_event, request) => {
    const label = projectService.getTargetLabel(request.projectId, request.targetName);
    return { label: label ?? null };
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_SET_LABEL, async (_event, request) => {
    projectService.setTargetLabel(request.projectId, request.targetName, request.label);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LIST, async (_event, request) => {
    return configService.list(request.projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, request) => {
    await configService.set(request.projectPath, request.key, request.value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_UNSET, async (_event, request) => {
    await configService.unset(request.projectPath, request.key);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, request) => {
    return { value: projectService.getSetting(request.key) };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, request) => {
    projectService.setSetting(request.key, request.value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EDITOR_DETECT, async () => {
    return editorService.detectEditor();
  });

  ipcMain.handle(IPC_CHANNELS.EDITOR_OPEN_FILE, async (_event, request: { filePath: string }) => {
    const editorName = editorService.openFile(request.filePath);
    return { editorName };
  });

  ipcMain.handle(IPC_CHANNELS.WATCH_START, async (_event, request: { projectPath: string }) => {
    fileWatcherService.start(request.projectPath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.WATCH_STOP, async (_event, request: { projectPath: string }) => {
    fileWatcherService.stop(request.projectPath);
    return { success: true };
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const binaryPath = detectSqitchBinary() || "sqitch";
    sqitchService = new SqitchService(binaryPath);
    projectService = new ProjectService();
    configService = new ConfigService(sqitchService);
    engineService = new EngineService(sqitchService);
    targetService = new TargetService(sqitchService);
    editorService = new EditorService();
    fileWatcherService = new FileWatcherService((event) => {
      mainWindow?.webContents.send(IPC_CHANNELS.WATCH_EVENT, event);
    });

    registerIpcHandlers();
    createWindow();

    app.on("browser-window-focus", () => {
      mainWindow?.webContents.send(IPC_CHANNELS.STATUS_STALE, {
        threshold: 5 * 60 * 1000,
      });
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  fileWatcherService?.stopAll();
});
