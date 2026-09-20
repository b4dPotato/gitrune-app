import { describe, expect, it } from "vitest";
import type { RepoStatus } from "../../lib/ipc";
import { syncActionState } from "./syncState";

const status = (changes: Partial<RepoStatus>): RepoStatus => ({
  branch: "main",
  upstream: "origin/main",
  detached: false,
  ahead: 0,
  behind: 0,
  dirty: 0,
  clean: true,
  files: [],
  operation: null,
  ...changes,
});

describe("syncActionState", () => {
  it("describes publish, pull, push, and diverged states", () => {
    expect(syncActionState(status({ upstream: null })).label).toBe("Publish branch");
    expect(syncActionState(status({ behind: 2 })).label).toBe("Pull 2");
    expect(syncActionState(status({ ahead: 3 })).label).toBe("Push 3");
    expect(syncActionState(status({ ahead: 3 })).icon).toBe("push");
    expect(syncActionState(status({ ahead: 1, behind: 1 })).label).toBe("Pull and push");
  });

  it("does not offer publishing for unborn or detached heads", () => {
    expect(syncActionState(status({ branch: "(unborn)", upstream: null })).disabled).toBe(true);
    expect(syncActionState(status({ branch: "(unborn)", upstream: null })).visible).toBe(false);
    expect(syncActionState(status({ detached: true })).visible).toBe(false);
  });

  it("offers setup instead of publish when no remote exists", () => {
    const state = syncActionState(status({ upstream: null }), false);
    expect(state.kind).toBe("setup");
    expect(state.label).toBe("Set up remote");
  });

  it("hides sync when the branch is already up to date", () => {
    expect(syncActionState(status({ ahead: 0, behind: 0 })).visible).toBe(false);
  });
});
