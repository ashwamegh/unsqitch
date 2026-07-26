// Setup storage helpers
const getStorage = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
};

const setStorage = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Types corresponding to internal schemas
interface Project {
  id: string;
  name: string;
  path: string;
  engine: string;
  changeCount: number;
  lastDeployment?: string;
  lastOpened: string;
}

interface Engine {
  name: string;
  uri: string;
  client?: string;
  registry?: string;
}

interface Target {
  name: string;
  uri: string;
}

interface ConfigItem {
  section: string;
  subsection?: string;
  key: string;
  value: string;
}

// Initial Mock Seed Data
const defaultProjects: Project[] = [
  {
    id: "proj-test",
    name: "test-project",
    path: "/tmp/unsqitch-test-project",
    engine: "pg",
    changeCount: 3,
    lastDeployment: new Date().toISOString(),
    lastOpened: new Date().toISOString(),
  },
];

const planner = { name: "Test User", email: "test@example.com" };
const planChanges = [
  {
    name: "appschema",
    requires: [] as string[],
    conflicts: [] as string[],
    note: "Add schema for all application objects",
    timestamp: "2026-05-31T06:00:00Z",
    planner,
  },
  {
    name: "users",
    requires: ["appschema"] as string[],
    conflicts: [] as string[],
    note: "Add users table with auth tokens",
    timestamp: "2026-05-31T06:10:00Z",
    planner,
  },
  {
    name: "orders",
    requires: ["users"] as string[],
    conflicts: ["legacy_orders"] as string[],
    note: "Add orders table with foreign key to users",
    timestamp: "2026-05-31T06:30:00Z",
    planner,
  },
];
const planTags = [
  { name: "v1.0.0", timestamp: "2026-05-31T06:15:00Z", planner, note: "First release" },
];

// A full PlanFile shape (entries preserve file order for the timeline).
const defaultPlan = {
  entries: [
    { type: "pragma", index: 0, pragma: { key: "syntax-version", value: "1.0.0" } },
    { type: "pragma", index: 1, pragma: { key: "project", value: "test-project" } },
    {
      type: "pragma",
      index: 2,
      pragma: { key: "uri", value: "https://github.com/example/test-project" },
    },
    { type: "change", index: 3, change: planChanges[0] },
    { type: "change", index: 4, change: planChanges[1] },
    { type: "tag", index: 5, tag: planTags[0] },
    { type: "change", index: 6, change: planChanges[2] },
  ],
  pragmas: {
    "syntax-version": "1.0.0",
    project: "test-project",
    uri: "https://github.com/example/test-project",
  },
  changes: planChanges,
  tags: planTags,
  unparseableLines: [] as Array<{ line: string; index: number }>,
};

const defaultLog = [
  {
    change: "appschema",
    changeId: "a1b2c3d4e5f6",
    action: "deploy",
    committer: { name: "Test User", email: "test@example.com" },
    timestamp: "2026-05-31T06:20:00Z",
    tags: [],
    note: "Add schema for all application objects",
  },
  {
    change: "users",
    changeId: "f6e5d4c3b2a1",
    action: "deploy",
    committer: { name: "Test User", email: "test@example.com" },
    timestamp: "2026-05-31T06:25:00Z",
    tags: ["v1.0.0"],
    note: "Add users table with auth tokens",
  },
];

const defaultEngines = [
  { name: "pg", uri: "db:pg://sqitch:sqitch@localhost:54231/sqitch_test", client: "psql" },
];

const defaultTargets = [
  { name: "local_pg", uri: "db:pg://sqitch:sqitch@localhost:54231/sqitch_test" },
];

const defaultConfigs = [
  { section: "core", key: "engine", value: "pg" },
  { section: "core", key: "plan_file", value: "sqitch.plan" },
  { section: "core", key: "top_dir", value: "." },
  { section: "engine", subsection: "pg", key: "target", value: "local_pg" },
];

// Callbacks lists
let streamCallbacks: Array<
  (event: { projectPath: string; data: string; type: "stdout" | "stderr" }) => void
> = [];
let completeCallbacks: Array<
  (event: { projectPath: string; exitCode: number; command: string }) => void
> = [];
let errorCallbacks: Array<(event: { projectPath: string; error: string; type: string }) => void> =
  [];
let staleCallbacks: Array<(payload: { threshold?: number }) => void> = [];
let watchCallbacks: Array<(event: any) => void> = [];

export const mockUnsqitchAPI: any = {
  // Project management
  projectOpen: async (path: string) => {
    const projects = getStorage<Project[]>("unsqitch_projects", defaultProjects);
    const existing = projects.find((p) => p.path === path);
    if (existing) {
      existing.lastOpened = new Date().toISOString();
      setStorage("unsqitch_projects", projects);
      return { project: existing };
    }
    const name = path.split("/").pop() || "new-project";
    const newProj: Project = {
      id: `proj-${Math.random().toString(36).substr(2, 9)}`,
      name,
      path,
      engine: "pg",
      changeCount: 0,
      lastOpened: new Date().toISOString(),
    };
    projects.push(newProj);
    setStorage("unsqitch_projects", projects);
    return { project: newProj };
  },

  projectList: async () => {
    const projects = getStorage<Project[]>("unsqitch_projects", defaultProjects);
    return { projects };
  },

  projectRemove: async (id: string) => {
    const projects = getStorage<Project[]>("unsqitch_projects", defaultProjects);
    const filtered = projects.filter((p) => p.id !== id);
    setStorage("unsqitch_projects", filtered);
    return { success: true };
  },

  projectGet: async (id: string) => {
    const projects = getStorage<Project[]>("unsqitch_projects", defaultProjects);
    return projects.find((p) => p.id === id) || null;
  },

  // Sqitch operations
  sqitchDeploy: async (projectPath: string, target: string, _toChange?: string) => {
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `Deploying changes to target '${target}'...\n`, type: "stdout" }),
      );
    }, 100);
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `  + appschema .. ok\n`, type: "stdout" }),
      );
    }, 500);
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `  + users .. ok\n`, type: "stdout" }),
      );
    }, 1000);
    setTimeout(() => {
      completeCallbacks.forEach((cb) => cb({ projectPath, exitCode: 0, command: "deploy" }));
    }, 1500);
    return {
      events: [
        { type: "deploy", change: "appschema", status: "ok" },
        { type: "deploy", change: "users", status: "ok" },
      ],
    } as any;
  },

  sqitchRevert: async (projectPath: string, target: string, _toChange?: string) => {
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `Reverting changes from target '${target}'...\n`, type: "stdout" }),
      );
    }, 100);
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `  - users .. ok\n`, type: "stdout" }),
      );
    }, 500);
    setTimeout(() => {
      completeCallbacks.forEach((cb) => cb({ projectPath, exitCode: 0, command: "revert" }));
    }, 1000);
    return { events: [{ type: "revert", change: "users", status: "ok" }] } as any;
  },

  sqitchVerify: async (projectPath: string, target: string) => {
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({
          projectPath,
          data: `Verifying database schema against target '${target}'...\n`,
          type: "stdout",
        }),
      );
    }, 100);
    setTimeout(() => {
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `  * appschema .. ok\n`, type: "stdout" }),
      );
      streamCallbacks.forEach((cb) =>
        cb({ projectPath, data: `  * users .. ok\n`, type: "stdout" }),
      );
    }, 600);
    setTimeout(() => {
      completeCallbacks.forEach((cb) => cb({ projectPath, exitCode: 0, command: "verify" }));
    }, 1100);
    return {
      events: [
        { type: "verify", change: "appschema", status: "ok" },
        { type: "verify", change: "users", status: "ok" },
      ],
    } as any;
  },

  sqitchStatus: async (_projectPath: string, target: string) => {
    return {
      target: target || "local_pg",
      engine: "pg",
      deployed: [
        {
          name: "appschema",
          changeId: "a1b2c3d4e5f6",
          deployedAt: "2026-05-31T06:20:00Z",
          deployedBy: "Test User",
          tags: [],
          note: "Add schema for all application objects",
          requires: [],
          conflicts: [],
        },
        {
          name: "users",
          changeId: "f6e5d4c3b2a1",
          deployedAt: "2026-05-31T06:25:00Z",
          deployedBy: "Test User",
          tags: ["v1.0.0"],
          note: "Add users table with auth tokens",
          requires: ["appschema"],
          conflicts: [],
        },
      ],
      pending: ["orders"],
      lastChange: "users",
      lastTag: ["v1.0.0"],
      lastDeployTime: new Date().toISOString(),
    } as any;
  },

  sqitchLog: async (projectPath: string, _target: string) => {
    return getStorage(`unsqitch_logs_${projectPath}`, defaultLog);
  },

  sqitchPlan: async (projectPath: string) => {
    return getStorage(`unsqitch_plan_${projectPath}`, defaultPlan) as any;
  },

  sqitchAdd: async (
    projectPath: string,
    name: string,
    note: string,
    requires: string[],
    conflicts: string[],
  ) => {
    const plan = getStorage(`unsqitch_plan_${projectPath}`, defaultPlan);
    const newChange = {
      name,
      requires,
      conflicts,
      note,
      timestamp: new Date().toISOString(),
      planner: { name: "Mock User", email: "mock@example.com" },
    };
    plan.changes.push(newChange);
    plan.entries.push({ type: "change", index: plan.entries.length, change: newChange } as any);
    setStorage(`unsqitch_plan_${projectPath}`, plan);
    return { success: true, stdout: `Created ${name}` };
  },

  sqitchInit: async (
    _directory: string,
    name: string,
    _engine: string,
    _uri: string,
    _topDir: string,
    _planFile: string,
  ) => {
    return { success: true, stdout: `Initialized sqitch project ${name}` };
  },

  // Engine/Target/Config
  engineAdd: async (
    projectPath: string,
    name: string,
    uri: string,
    client?: string,
    registry?: string,
  ) => {
    const key = `unsqitch_engines_${projectPath}`;
    const list = getStorage<Engine[]>(key, defaultEngines);
    list.push({ name, uri, client, registry });
    setStorage(key, list);
    return { success: true };
  },

  engineRemove: async (projectPath: string, name: string) => {
    const key = `unsqitch_engines_${projectPath}`;
    const list = getStorage<Engine[]>(key, defaultEngines);
    setStorage(
      key,
      list.filter((e) => e.name !== name),
    );
    return { success: true };
  },

  engineList: async (projectPath: string) => {
    return getStorage<Engine[]>(`unsqitch_engines_${projectPath}`, defaultEngines);
  },

  targetAdd: async (projectPath: string, name: string, uri: string) => {
    const key = `unsqitch_targets_${projectPath}`;
    const list = getStorage<Target[]>(key, defaultTargets);
    list.push({ name, uri });
    setStorage(key, list);
    return { success: true };
  },

  targetRemove: async (projectPath: string, name: string) => {
    const key = `unsqitch_targets_${projectPath}`;
    const list = getStorage<Target[]>(key, defaultTargets);
    setStorage(
      key,
      list.filter((t) => t.name !== name),
    );
    return { success: true };
  },

  targetList: async (projectPath: string) => {
    return getStorage<Target[]>(`unsqitch_targets_${projectPath}`, defaultTargets);
  },

  targetGetLabel: async (projectId: string, targetName: string) => {
    const label = getStorage<string | null>(`unsqitch_label_${projectId}_${targetName}`, null);
    return { label };
  },

  targetSetLabel: async (projectId: string, targetName: string, label: string) => {
    setStorage(`unsqitch_label_${projectId}_${targetName}`, label);
    return { success: true };
  },

  configList: async (projectPath: string) => {
    return getStorage<ConfigItem[]>(`unsqitch_config_${projectPath}`, defaultConfigs);
  },

  configSet: async (projectPath: string, key: string, value: string) => {
    const storageKey = `unsqitch_config_${projectPath}`;
    const list = getStorage<ConfigItem[]>(storageKey, defaultConfigs);
    const existing = list.find((c) => {
      const matchKey = c.subsection
        ? `${c.section}.${c.subsection}.${c.key}`
        : `${c.section}.${c.key}`;
      return matchKey === key;
    });
    if (existing) {
      existing.value = value;
    } else {
      const parts = key.split(".");
      if (parts.length === 3) {
        list.push({ section: parts[0], subsection: parts[1], key: parts[2], value });
      } else if (parts.length === 2) {
        list.push({ section: parts[0], key: parts[1], value });
      }
    }
    setStorage(storageKey, list);
    return { success: true };
  },

  configUnset: async (projectPath: string, key: string) => {
    const storageKey = `unsqitch_config_${projectPath}`;
    const list = getStorage<ConfigItem[]>(storageKey, defaultConfigs);
    const filtered = list.filter((c) => {
      const matchKey = c.subsection
        ? `${c.section}.${c.subsection}.${c.key}`
        : `${c.section}.${c.key}`;
      return matchKey !== key;
    });
    setStorage(storageKey, filtered);
    return { success: true };
  },

  // Sqitch binary
  sqitchDetect: async () => {
    return { found: true, path: "/usr/local/bin/sqitch", version: "1.4.1", meetsMinimum: true };
  },

  sqitchVersion: async () => {
    return { version: "1.4.1", meetsMinimum: true };
  },

  sqitchCancel: async () => {
    return { success: true };
  },

  isMock: true,

  // Native dialogs
  dialogOpenDirectory: async () => {
    const defaultPath = "tests/fixtures/test-project";
    const path = window.prompt(
      "UnSqitch Mock API (Browser Mode)\nEnter directory path for mock database project:",
      defaultPath,
    );
    if (path === null) {
      return { canceled: true, path: null };
    }
    return { canceled: false, path: path || defaultPath };
  },

  dialogOpenFile: async () => {
    const path = window.prompt("UnSqitch Mock API (Browser Mode)\nEnter a file path:", "");
    if (path === null) return { canceled: true, path: null };
    return { canceled: false, path };
  },

  // Stream listeners
  onSqitchStream: (callback) => {
    streamCallbacks.push(callback);
    return () => {
      streamCallbacks = streamCallbacks.filter((cb) => cb !== callback);
    };
  },

  onSqitchComplete: (callback) => {
    completeCallbacks.push(callback);
    return () => {
      completeCallbacks = completeCallbacks.filter((cb) => cb !== callback);
    };
  },

  onSqitchError: (callback) => {
    errorCallbacks.push(callback);
    return () => {
      errorCallbacks = errorCallbacks.filter((cb) => cb !== callback);
    };
  },

  onStatusStale: (callback) => {
    staleCallbacks.push(callback);
    return () => {
      staleCallbacks = staleCallbacks.filter((cb) => cb !== callback);
    };
  },

  // File watching
  watchStart: async (_projectPath: string) => {
    return { success: true };
  },

  watchStop: async (_projectPath: string) => {
    return { success: true };
  },

  onWatchEvent: (callback) => {
    watchCallbacks.push(callback);
    return () => {
      watchCallbacks = watchCallbacks.filter((cb) => cb !== callback);
    };
  },

  // Settings
  // Browser mode has no main process; open the guide directly.
  openDocs: async () => {
    window.open("https://github.com/ashwamegh/unsqitch/wiki", "_blank", "noopener,noreferrer");
    return { success: true };
  },

  settingsGet: async (key: string) => {
    const value = getStorage<string | null>(`unsqitch_setting_${key}`, null);
    return { value };
  },

  settingsSet: async (key: string, value: string) => {
    setStorage(`unsqitch_setting_${key}`, value);
    return { success: true };
  },

  // Editor integration
  editorOpenFile: async (filePath: string) => {
    console.log("Opening file in editor:", filePath);
    return { editorName: "VS Code" };
  },

  editorDetect: async () => {
    return { command: "code", name: "VS Code" };
  },

  scriptPath: async (projectPath: string, changeName: string, kind: string) => {
    return { path: `${projectPath}/${kind}/${changeName}.sql` };
  },

  scriptRead: async (_projectPath: string, changeName: string, kind: string) => {
    return {
      content: `-- ${kind} script for ${changeName}\nBEGIN;\n\n-- (mock content)\n\nCOMMIT;\n`,
      path: `${kind}/${changeName}.sql`,
      error: null,
    };
  },

  projectTargets: async (_projectPath: string) => {
    return {
      defaultTarget: "local_pg",
      engine: "pg",
      targets: [{ name: "local_pg", uri: "db:pg://sqitch:sqitch@localhost:54231/sqitch_test" }],
    };
  },

  recentCommands: async (projectPath: string) => {
    return { commands: getStorage(`unsqitch_recent_${projectPath}`, []) };
  },
};
