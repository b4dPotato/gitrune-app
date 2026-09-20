import { describe, expect, it } from "vitest";
import type { CommitInfo } from "../gitparse";
import { layoutGraph } from "../graphlayout";

function c(sha: string, parents: string[]): CommitInfo {
  return { sha, parents, author: "t", ini: "T", time: "", msg: sha, refs: [] };
}

describe("layoutGraph", () => {
  it("keeps a linear chain in lane 0", () => {
    const rows = layoutGraph([c("c3", ["c2"]), c("c2", ["c1"]), c("c1", [])]);
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(rows.every((r) => !r.merge)).toBe(true);
    // middle row: full vertical through lane 0
    expect(rows[1].v).toContainEqual([0, 0]);
    // last row (root): only the upper half arrives
    expect(rows[2].v).toContainEqual([0, 2]);
  });

  it("lays out a merge with a side branch", () => {
    // m merges f into main; f branched from b; history: m, f, b(main), root
    const rows = layoutGraph([c("m", ["b", "f"]), c("f", ["b"]), c("b", ["root"]), c("root", [])]);
    // merge commit sits in lane 0, hollow dot, branch leaves downward
    expect(rows[0].lane).toBe(0);
    expect(rows[0].merge).toBe(true);
    expect(rows[0].curves).toContainEqual({ lane: 1, dir: "bottom" });
    expect(rows[0].v).not.toContainEqual([1, 1]);
    // f sits in lane 1
    expect(rows[1].lane).toBe(1);
    // b: lane 1 merges back in from above
    expect(rows[2].lane).toBe(0);
    expect(rows[2].curves).toContainEqual({ lane: 1, dir: "top" });
    expect(rows[2].v).not.toContainEqual([1, 2]);
    // root stays in lane 0
    expect(rows[3].lane).toBe(0);
  });

  it("allocates separate lanes for parallel branches", () => {
    // two heads sharing one root
    const rows = layoutGraph([c("a2", ["r"]), c("b2", ["r"]), c("r", [])]);
    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(1);
    // root: both lanes converge — lane 1 curves in from above
    expect(rows[2].lane).toBe(0);
    expect(rows[2].curves).toContainEqual({ lane: 1, dir: "top" });
  });

  it("never exceeds MAX_LANES in the emitted layout", () => {
    // 20 independent roots
    const commits = Array.from({ length: 20 }, (_, i) => c(`h${i}`, []));
    const rows = layoutGraph(commits);
    expect(Math.max(...rows.map((r) => r.lane))).toBeLessThan(12);
  });
});
