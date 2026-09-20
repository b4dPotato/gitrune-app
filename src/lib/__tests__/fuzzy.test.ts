import { describe, expect, it } from "vitest";
import { fuzzy, rank } from "../fuzzy";

describe("fuzzy", () => {
  it("matches exact strings with score 0", () => {
    expect(fuzzy("push", "push")).toBe(0);
  });

  it("matches subsequences case-insensitively", () => {
    expect(fuzzy("gtc", "Go to Changes")).toBeGreaterThanOrEqual(0);
    expect(fuzzy("PUSH", "push")).toBe(0);
  });

  it("returns -1 when characters are missing", () => {
    expect(fuzzy("xyz", "push")).toBe(-1);
  });

  it("prefers tighter matches (lower score)", () => {
    const tight = fuzzy("br", "branch");
    const loose = fuzzy("br", "b---r");
    expect(tight).toBeLessThan(loose);
  });

  it("empty query matches everything with score 0", () => {
    expect(fuzzy("", "anything")).toBe(0);
  });
});

describe("rank", () => {
  const items = ["Go to Changes", "Go to Branches", "Push", "Pull with rebase"];

  it("returns all items for empty query, capped at limit", () => {
    expect(rank("", items, (x) => x, 2)).toHaveLength(2);
    expect(rank("", items, (x) => x)).toHaveLength(4);
  });

  it("filters non-matching items", () => {
    const r = rank("push", items, (x) => x);
    expect(r).toEqual(["Push"]);
  });

  it("sorts by score ascending", () => {
    const r = rank("go", items, (x) => x);
    expect(r[0].startsWith("Go")).toBe(true);
  });
});
