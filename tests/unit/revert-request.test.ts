import { beforeEach, describe, expect, it } from "vitest";
import { useNavigationStore } from "../../src/store/navigation";
import { useProjectStore } from "../../src/store/project";

describe("cross-view revert requests", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useNavigationStore.setState({ section: "status", revertRequest: null, pulsedSections: [] });
  });

  it("requestRevertTo switches to the Revert section carrying the change", () => {
    // Spec: clicking a deployed change in Status/Plan offers "Revert to here".
    useNavigationStore.getState().requestRevertTo("users");
    expect(useNavigationStore.getState().section).toBe("revert");
    expect(useNavigationStore.getState().revertRequest).toBe("users");
  });

  it("carries a tag so reverting to a tag is reachable", () => {
    useNavigationStore.getState().requestRevertTo("@v1.0.0");
    expect(useNavigationStore.getState().revertRequest).toBe("@v1.0.0");
    expect(useNavigationStore.getState().section).toBe("revert");
  });

  it("clears any pending pulse on the revert section when navigating there", () => {
    useNavigationStore.getState().pulseSection("revert");
    useNavigationStore.getState().requestRevertTo("users");
    expect(useNavigationStore.getState().pulsedSections).not.toContain("revert");
  });

  it("clearRevertRequest consumes the request so it fires once", () => {
    useNavigationStore.getState().requestRevertTo("users");
    useNavigationStore.getState().clearRevertRequest();
    expect(useNavigationStore.getState().revertRequest).toBeNull();
  });
});
