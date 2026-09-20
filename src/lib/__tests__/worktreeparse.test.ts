import { describe, expect, it } from "vitest";
import { parseWorktrees } from "../worktreeparse";

const RAW = `worktree /code/acme/backend-api
HEAD e7c210f9a1b2c3d4e5f60718293a4b5c6d7e8f90
branch refs/heads/feature/auth-tokens

worktree /code/acme/backend-api.wt/pr-138
HEAD 9921fd0a1b2c3d4e5f60718293a4b5c6d7e8f901
detached

worktree /code/acme/backend-api.wt/rate-limits
HEAD 4a91d02b1c2d3e4f5a60718293a4b5c6d7e8f012
branch refs/heads/feature/rate-limits
prunable gitdir file points to non-existent location
`;

describe("parseWorktrees", () => {
  it("parses entries with branch, detached, and prunable state", () => {
    const wts = parseWorktrees(RAW);
    expect(wts).toHaveLength(3);
    expect(wts[0]).toMatchObject({
      path: "/code/acme/backend-api",
      branch: "feature/auth-tokens",
      head: "e7c210f",
      main: true,
      detached: false,
    });
    expect(wts[1]).toMatchObject({ detached: true, branch: "", main: false });
    expect(wts[2]).toMatchObject({ branch: "feature/rate-limits", prunable: true });
  });

  it("handles empty input", () => {
    expect(parseWorktrees("")).toEqual([]);
  });

  it("handles bare and locked flags", () => {
    const wts = parseWorktrees("worktree /repo\nHEAD abcdef012345\nbare\nlocked reason\n");
    expect(wts[0].bare).toBe(true);
    expect(wts[0].locked).toBe(true);
  });
});
