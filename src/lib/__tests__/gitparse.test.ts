import { describe, expect, it } from "vitest";
import {
  hunkPatch,
  linePatch,
  initials,
  parseDiff,
  parseLog,
  parseRefs,
  parseStashList,
  trackToSync,
} from "../gitparse";

const US = "\x1f";
const RS = "\x1e";

describe("parseRefs", () => {
  const raw = [
    [
      "main",
      "a3f8c21",
      "*",
      "origin/main",
      "[behind 3]",
      "1 day ago",
      "1700000000",
      "refs/heads/main",
    ].join(US),
    [
      "feature/auth-tokens",
      "e7c210f",
      "",
      "origin/feature/auth-tokens",
      "[ahead 2, behind 1]",
      "25 minutes ago",
      "1700100000",
      "refs/heads/feature/auth-tokens",
    ].join(US),
    [
      "origin/main",
      "c90aa1e",
      "",
      "",
      "",
      "1 day ago",
      "1700000000",
      "refs/remotes/origin/main",
    ].join(US),
    ["v2.4.0", "f30d1b8", "", "", "", "3 days ago", "1699800000", "refs/tags/v2.4.0"].join(US),
  ].join("\n");

  it("classifies local, remote, and tag refs", () => {
    const refs = parseRefs(raw);
    expect(refs).toHaveLength(4);
    expect(refs[0].kind).toBe("local");
    expect(refs[0].isHead).toBe(true);
    expect(refs[2].kind).toBe("remote");
    expect(refs[3].kind).toBe("tag");
    expect(refs[1].updatedAt).toBe(1700100000);
  });

  it("keeps upstream and track info", () => {
    const refs = parseRefs(raw);
    expect(refs[1].upstream).toBe("origin/feature/auth-tokens");
    expect(trackToSync(refs[1].track)).toBe("↑2 ↓1");
    expect(trackToSync(refs[0].track)).toBe("↓3");
    expect(trackToSync("[gone]")).toBe("gone");
    expect(trackToSync("")).toBe("");
  });
});

describe("parseLog", () => {
  const raw =
    [
      "e7c210f",
      "b90d3a2",
      "Alex Morgan",
      "25 minutes ago",
      "Rotate refresh tokens on use",
      "HEAD -> feature/auth-tokens",
    ].join(US) +
    RS +
    "\n" +
    [
      "a3f8c21",
      "9c4be70 77e01bc",
      "Marta Villanueva",
      "1 day ago",
      "Merge pull request #139",
      "main, origin/main, tag: v2.4.0",
    ].join(US) +
    RS;

  it("parses records, parents, and initials", () => {
    const log = parseLog(raw);
    expect(log).toHaveLength(2);
    expect(log[0].sha).toBe("e7c210f");
    expect(log[0].parents).toEqual(["b90d3a2"]);
    expect(log[1].parents).toEqual(["9c4be70", "77e01bc"]);
    expect(log[0].ini).toBe("AM");
    expect(initials("acme-ci")).toBe("AC");
  });

  it("parses decorations incl. HEAD ->, remote, and tags", () => {
    const log = parseLog(raw);
    expect(log[0].refs).toEqual([{ n: "feature/auth-tokens", k: "local" }]);
    expect(log[1].refs).toEqual([
      { n: "main", k: "local" },
      { n: "origin/main", k: "remote" },
      { n: "v2.4.0", k: "tag" },
    ]);
  });
});

describe("parseStashList", () => {
  it("parses id, message, time", () => {
    const raw = ["stash@{0}", "WIP: rate limiter spike", "1 day ago"].join(US) + "\n";
    const st = parseStashList(raw);
    expect(st).toEqual([{ id: "stash@{0}", msg: "WIP: rate limiter spike", time: "1 day ago" }]);
  });
});

const DIFF_FIXTURE = `diff --git a/src/api/client.ts b/src/api/client.ts
index 3b18e51..8f2a1c3 100644
--- a/src/api/client.ts
+++ b/src/api/client.ts
@@ -12,7 +12,8 @@ export class ApiClient {
   constructor(config: ClientConfig) {
     this.baseUrl = config.baseUrl;
-    this.timeout = 5000;
+    this.timeout = config.timeout ?? 5000;
+    this.retryBudget = config.retryBudget ?? 3;
     this.headers = buildHeaders(config);
   }

@@ -41,3 +42,4 @@ export class ApiClient {
   async request(path) {
     return fetch(path);
   }
+  // end
`;

describe("parseDiff", () => {
  it("extracts header, hunks, and counts", () => {
    const d = parseDiff(DIFF_FIXTURE);
    expect(d.fileHeader[0]).toMatch(/^diff --git/);
    expect(d.hunks).toHaveLength(2);
    expect(d.add).toBe(3);
    expect(d.del).toBe(1);
    expect(d.binary).toBe(false);
  });

  it("produces display rows with correct line numbers", () => {
    const d = parseDiff(DIFF_FIXTURE);
    const rows = d.rows.filter((r) => !r.hunk);
    // first hunk starts at 12/12
    expect(rows[0]).toMatchObject({ n1: "12", n2: "12", t: "ctx" });
    const del = rows.find((r) => r.t === "del");
    expect(del).toMatchObject({ n1: "14", n2: "" });
    const adds = rows.filter((r) => r.t === "add");
    expect(adds[0]).toMatchObject({ n1: "", n2: "14" });
    expect(adds[1]).toMatchObject({ n1: "", n2: "15" });
  });

  it("maps hunk rows back to hunk indices", () => {
    const d = parseDiff(DIFF_FIXTURE);
    const hunkRows = d.rows.filter((r) => r.hunk);
    expect(hunkRows.map((r) => r.hunkIdx)).toEqual([0, 1]);
  });

  it("detects binary diffs", () => {
    const d = parseDiff("diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ\n");
    expect(d.binary).toBe(true);
    expect(d.hunks).toHaveLength(0);
  });
});

describe("hunkPatch", () => {
  it("rebuilds a valid single-hunk patch", () => {
    const d = parseDiff(DIFF_FIXTURE);
    const p = hunkPatch(d, 0);
    expect(p).toContain("diff --git a/src/api/client.ts");
    expect(p).toContain("@@ -12,7 +12,8 @@");
    expect(p).toContain("-    this.timeout = 5000;");
    expect(p).toContain("+    this.retryBudget = config.retryBudget ?? 3;");
    // second hunk must not leak into the first patch
    expect(p).not.toContain("// end");
    expect(p.endsWith("\n")).toBe(true);
  });

  it("throws for a missing hunk", () => {
    const d = parseDiff(DIFF_FIXTURE);
    expect(() => hunkPatch(d, 9)).toThrow();
  });
});

describe("linePatch", () => {
  it("creates a zero-context patch for only the selected addition", () => {
    const diff = parseDiff(`diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,4 @@
 one
+selected
+not selected
 two
`);
    const patch = linePatch(diff, [{ hunkIdx: 0, rawIndex: 1 }]);
    expect(patch).toContain("@@ -1,0 +2,1 @@");
    expect(patch).toContain("+selected");
    expect(patch).not.toContain("+not selected");
  });

  it("rejects an empty selection", () => {
    expect(() => linePatch(parseDiff(""), [])).toThrow("no lines selected");
  });
});
