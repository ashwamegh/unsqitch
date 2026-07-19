import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPage } from "../../src/pages/ProjectPage/ProjectPage";
import type { Section } from "../../src/store/navigation";
import { useNavigationStore } from "../../src/store/navigation";
import { useProjectStore } from "../../src/store/project";

// Minimal window.unsqitch stub so useIpc() does not throw and effects no-op.
const noop = () => () => {};
const ipcStub = {
  sqitchPlan: vi.fn().mockResolvedValue({
    entries: [],
    pragmas: {},
    changes: [],
    tags: [],
    unparseableLines: [],
  }),
  sqitchStatus: vi.fn().mockResolvedValue({ deployed: [], pending: [] }),
  sqitchLog: vi.fn().mockResolvedValue([]),
  configList: vi.fn().mockResolvedValue([]),
  engineList: vi.fn().mockResolvedValue([]),
  targetList: vi.fn().mockResolvedValue([]),
  targetGetLabel: vi.fn().mockResolvedValue({ label: null }),
  settingsGet: vi.fn().mockResolvedValue({ value: null }),
  onStatusStale: noop,
  onWatchEvent: noop,
  onSqitchStream: noop,
  onSqitchComplete: noop,
  onSqitchError: noop,
};

beforeEach(() => {
  (window as unknown as { unsqitch: unknown }).unsqitch = ipcStub;
  useProjectStore.setState({
    projects: [
      {
        id: "p1",
        name: "demo",
        path: "/tmp/demo",
        engine: "pg",
        changeCount: 0,
        lastOpened: "2026-01-01T00:00:00Z",
      },
    ],
    currentProjectId: "p1",
    plan: null,
    status: null,
    isRunning: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderSection(section: Section) {
  useNavigationStore.setState({ view: "project", section });
  return render(<ProjectPage />);
}

describe("ProjectPage section routing", () => {
  // Every sidebar section must resolve to a real view, never the
  // "<section> view - coming soon" fallback.
  const sections: Section[] = [
    "plan",
    "deploy",
    "revert",
    "status",
    "verify",
    "log",
    "engine",
    "target",
    "config",
  ];

  for (const section of sections) {
    it(`renders a real view for "${section}" (not the coming-soon fallback)`, () => {
      renderSection(section);
      expect(screen.queryByText(/view - coming soon/i)).toBeNull();
    });
  }

  it("routes the revert section to the RevertView (regression)", () => {
    renderSection("revert");
    expect(screen.getByText(/Revert Settings/i)).toBeInTheDocument();
  });
});
