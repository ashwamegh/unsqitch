import { beforeEach, describe, expect, it } from "vitest";
import { useNavigationStore } from "../../src/store/navigation";
import { useProjectStore } from "../../src/store/project";

describe("navigation store <-> project store sync", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useNavigationStore.setState({ view: "home", projectId: null, section: null });
  });

  it("openProject sets the project store's currentProjectId (regression)", () => {
    // Regression: opening a project must populate the PROJECT store, not only
    // the navigation store — otherwise every project view can't find its project.
    useNavigationStore.getState().openProject("proj-42");
    expect(useNavigationStore.getState().projectId).toBe("proj-42");
    expect(useNavigationStore.getState().view).toBe("project");
    expect(useNavigationStore.getState().section).toBe("plan");
    expect(useProjectStore.getState().currentProjectId).toBe("proj-42");
  });

  it("goHome clears the project store's currentProjectId", () => {
    useNavigationStore.getState().openProject("proj-42");
    useNavigationStore.getState().goHome();
    expect(useNavigationStore.getState().view).toBe("home");
    expect(useProjectStore.getState().currentProjectId).toBeNull();
  });

  it("opening a section clears that section's pulse", () => {
    useNavigationStore.getState().openProject("proj-42");
    useNavigationStore.getState().pulseSection("status");
    expect(useNavigationStore.getState().pulsedSections).toContain("status");
    useNavigationStore.getState().setSection("status");
    expect(useNavigationStore.getState().pulsedSections).not.toContain("status");
  });
});
