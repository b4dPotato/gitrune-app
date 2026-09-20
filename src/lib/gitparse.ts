/** Parsers for machine-readable git output returned by the typed backend
 * commands. Kept on the TS side so they are covered by vitest. Formats:
 *   list_refs:   %1F-separated fields, one ref per line
 *   commit_log:  %x1f-separated fields, records terminated by %x1e
 *   diff_file:   standard unified diff (--no-ext-diff --no-color)
 */
import type { DiffRow, RefKind } from "./types";

const US = "\x1f"; // unit separator
const RS = "\x1e"; // record separator

// ---------- refs ----------

export interface RefInfo {
  name: string;
  sha: string;
  isHead: boolean;
  upstream: string;
  /** e.g. "[ahead 2, behind 1]" or "[gone]" */
  track: string;
  time: string;
  updatedAt: number;
  kind: "local" | "remote" | "tag";
}

export function parseRefs(raw: string): RefInfo[] {
  const out: RefInfo[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split(US);
    const [short, sha, head, upstream, track, time] = fields;
    // The timestamp was added after the original format. Keeping this fallback
    // makes old demo fixtures and cached responses harmless during upgrades.
    const hasTimestamp = fields.length >= 8;
    const updatedAt = hasTimestamp ? Number(fields[6]) || 0 : 0;
    const full = fields[hasTimestamp ? 7 : 6];
    if (short === undefined || full === undefined) continue;
    const kind: RefInfo["kind"] = full.startsWith("refs/tags/")
      ? "tag"
      : full.startsWith("refs/remotes/")
        ? "remote"
        : "local";
    out.push({
      name: short,
      sha: sha ?? "",
      isHead: head === "*",
      upstream: upstream ?? "",
      track: track ?? "",
      time: time ?? "",
      updatedAt,
      kind,
    });
  }
  return out;
}

/** "[ahead 2, behind 1]" → "↑2 ↓1", "[gone]" → "gone", "" → "" */
export function trackToSync(track: string): string {
  if (!track) return "";
  if (track.includes("gone")) return "gone";
  const ahead = /ahead (\d+)/.exec(track);
  const behind = /behind (\d+)/.exec(track);
  const parts: string[] = [];
  if (ahead) parts.push(`↑${ahead[1]}`);
  if (behind) parts.push(`↓${behind[1]}`);
  return parts.join(" ");
}

// ---------- log ----------

export interface CommitInfo {
  sha: string;
  parents: string[];
  author: string;
  ini: string;
  time: string;
  msg: string;
  refs: { n: string; k: RefKind }[];
}

export function initials(author: string): string {
  const words = author.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function parseDecorations(d: string): { n: string; k: RefKind }[] {
  if (!d.trim()) return [];
  const refs: { n: string; k: RefKind }[] = [];
  for (let part of d.split(",").map((s) => s.trim())) {
    if (!part) continue;
    if (part.startsWith("HEAD ->")) part = part.slice(7).trim();
    else if (part === "HEAD") continue;
    if (part.startsWith("tag: ")) {
      refs.push({ n: part.slice(5), k: "tag" });
    } else {
      // heuristic: refs under the default remote are remote-tracking; local
      // branches may contain slashes too (feature/x), so only match origin/
      refs.push({ n: part, k: part.startsWith("origin/") ? "remote" : "local" });
    }
  }
  return refs;
}

export function parseLog(raw: string): CommitInfo[] {
  const out: CommitInfo[] = [];
  for (const rec of raw.split(RS)) {
    const t = rec.replace(/^\n/, "");
    if (!t.trim()) continue;
    const [sha, parents, author, time, msg, deco] = t.split(US);
    if (!sha) continue;
    out.push({
      sha: sha.trim(),
      parents: (parents ?? "").trim().split(/\s+/).filter(Boolean),
      author: author ?? "",
      ini: initials(author ?? ""),
      time: time ?? "",
      msg: msg ?? "",
      refs: parseDecorations(deco ?? ""),
    });
  }
  return out;
}

// ---------- stash list ----------

export interface StashInfo {
  id: string;
  msg: string;
  time: string;
}

export function parseStashList(raw: string): StashInfo[] {
  const out: StashInfo[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [id, msg, time] = line.split(US);
    if (!id) continue;
    out.push({ id, msg: msg ?? "", time: time ?? "" });
  }
  return out;
}

// ---------- unified diff ----------

export interface DiffHunk {
  header: string;
  /** raw patch lines including the +/-/space prefix, exactly as emitted */
  rawLines: string[];
}

export interface ParsedDiff {
  /** file header lines (diff --git, index, ---, +++ …) for patch rebuild */
  fileHeader: string[];
  hunks: DiffHunk[];
  /** display rows; hunk rows carry hunkIdx to map buttons back to hunks */
  rows: (DiffRow & { hunkIdx?: number })[];
  add: number;
  del: number;
  binary: boolean;
}

export function parseDiff(raw: string): ParsedDiff {
  const res: ParsedDiff = {
    fileHeader: [],
    hunks: [],
    rows: [],
    add: 0,
    del: 0,
    binary: false,
  };
  let n1 = 0;
  let n2 = 0;
  let inHunk = false;

  for (const line of raw.split("\n")) {
    if (line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (!m) continue;
      n1 = parseInt(m[1], 10);
      n2 = parseInt(m[2], 10);
      inHunk = true;
      res.hunks.push({ header: line, rawLines: [] });
      res.rows.push({ hunk: line, hunkIdx: res.hunks.length - 1 });
      continue;
    }
    if (!inHunk) {
      if (line.startsWith("Binary files")) res.binary = true;
      if (line.trim()) res.fileHeader.push(line);
      continue;
    }
    if (line.startsWith("+")) {
      const rawIndex = res.hunks[res.hunks.length - 1].rawLines.length;
      res.hunks[res.hunks.length - 1].rawLines.push(line);
      res.rows.push({
        n1: "",
        n2: String(n2),
        t: "add",
        text: line.slice(1),
        hunkIdx: res.hunks.length - 1,
        rawIndex,
      });
      n2 += 1;
      res.add += 1;
    } else if (line.startsWith("-")) {
      const rawIndex = res.hunks[res.hunks.length - 1].rawLines.length;
      res.hunks[res.hunks.length - 1].rawLines.push(line);
      res.rows.push({
        n1: String(n1),
        n2: "",
        t: "del",
        text: line.slice(1),
        hunkIdx: res.hunks.length - 1,
        rawIndex,
      });
      n1 += 1;
      res.del += 1;
    } else if (line.startsWith(" ") || line === "") {
      // context (trailing empty split artifact is ignored below)
      if (line === "") continue;
      res.hunks[res.hunks.length - 1].rawLines.push(line);
      res.rows.push({ n1: String(n1), n2: String(n2), t: "ctx", text: line.slice(1) });
      n1 += 1;
      n2 += 1;
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file"
      res.hunks[res.hunks.length - 1].rawLines.push(line);
    } else if (line.startsWith("diff ")) {
      inHunk = false;
      res.fileHeader.push(line);
    }
  }
  return res;
}

/** Rebuild a single-hunk patch that `git apply --cached` accepts. */
export function hunkPatch(diff: ParsedDiff, hunkIdx: number): string {
  const h = diff.hunks[hunkIdx];
  if (!h) throw new Error(`no hunk ${hunkIdx}`);
  return [...diff.fileHeader, h.header, ...h.rawLines].join("\n") + "\n";
}

/** Build zero-context hunks containing only selected +/- lines. */
export function linePatch(
  diff: ParsedDiff,
  selected: { hunkIdx: number; rawIndex: number }[],
): string {
  if (selected.length === 0) throw new Error("no lines selected");
  const chosen = new Set(selected.map((item) => `${item.hunkIdx}:${item.rawIndex}`));
  const hunks: string[] = [];

  diff.hunks.forEach((hunk, hunkIdx) => {
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(hunk.header);
    if (!match) return;
    let oldLine = Number(match[1]);
    let newLine = Number(match[3]);
    let group: { oldStart: number; newStart: number; lines: string[] } | null = null;

    const flush = () => {
      if (!group || group.lines.length === 0) return;
      const oldCount = group.lines.filter((line) => line.startsWith("-")).length;
      const newCount = group.lines.filter((line) => line.startsWith("+")).length;
      const oldStart = oldCount === 0 ? Math.max(0, group.oldStart - 1) : group.oldStart;
      const newStart = newCount === 0 ? Math.max(0, group.newStart - 1) : group.newStart;
      hunks.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`, ...group.lines);
      group = null;
    };

    hunk.rawLines.forEach((line, rawIndex) => {
      const isChange = line.startsWith("+") || line.startsWith("-");
      const isSelected = isChange && chosen.has(`${hunkIdx}:${rawIndex}`);
      if (isSelected) {
        group ??= { oldStart: oldLine, newStart: newLine, lines: [] };
        group.lines.push(line);
      } else if (isChange || line.startsWith(" ")) {
        flush();
      }
      if (line.startsWith("-") || line.startsWith(" ")) oldLine += 1;
      if (line.startsWith("+") || line.startsWith(" ")) newLine += 1;
    });
    flush();
  });

  if (hunks.length === 0) throw new Error("selected lines are not patch changes");
  return [...diff.fileHeader, ...hunks].join("\n") + "\n";
}
