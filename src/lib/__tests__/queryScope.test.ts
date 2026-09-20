import { describe, expect, it } from "vitest";
import { repositoryChangeQueryMatches, repositoryQueryMatches } from "../queryScope";

describe("repository query invalidation", () => {
  it("matches only the affected repository plus the global operation log", () => {
    expect(repositoryQueryMatches(["status", "C:/repo-a"], "C:/repo-a")).toBe(true);
    expect(repositoryQueryMatches(["graphPages", "C:/repo-b", {}], "C:/repo-a")).toBe(false);
    expect(repositoryQueryMatches(["repos"], "C:/repo-a")).toBe(false);
    expect(repositoryQueryMatches(["oplog"], "C:/repo-a")).toBe(true);
  });
});

describe("repositoryChangeQueryMatches", () => {
  it("limits worktree events to status, diff, and conflict data", () => {
    expect(repositoryChangeQueryMatches(["status", "C:/one"], "C:/one", "workingTree")).toBe(true);
    expect(repositoryChangeQueryMatches(["diff", "C:/one", "a.ts"], "C:/one", "workingTree")).toBe(
      true,
    );
    expect(repositoryChangeQueryMatches(["refs", "C:/one"], "C:/one", "workingTree")).toBe(false);
    expect(repositoryChangeQueryMatches(["status", "C:/two"], "C:/one", "workingTree")).toBe(false);
  });

  it("keeps full invalidation for ref and configuration events", () => {
    expect(repositoryChangeQueryMatches(["refs", "C:/one"], "C:/one", "repository")).toBe(true);
    expect(repositoryChangeQueryMatches(["identity", "C:/one"], "C:/one", "repository")).toBe(true);
  });
});
