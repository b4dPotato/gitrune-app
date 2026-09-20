/** Shared domain types. These mirror the typed command payloads of the Rust
 * backend (src-tauri/src). The UI never builds shell strings — it only calls
 * typed commands through `ipc.ts`. */

export type ViewId =
  | "overview"
  | "changes"
  | "graph"
  | "branches"
  | "prs"
  | "prreview"
  | "worktrees"
  | "stashes"
  | "conflicts"
  | "oplog"
  | "accounts"
  | "workspace";

export type Theme = "dark" | "light" | "dracula" | "nord" | "solarized" | "custom";

export interface CustomTheme {
  background: string;
  panel: string;
  accent: string;
  text: string;
}

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  background: "#111827",
  panel: "#1f2937",
  accent: "#8b5cf6",
  text: "#f3f4f6",
};

export type FileStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?";

export interface Repo {
  name: string;
  path: string;
  branch: string;
  dirty: number;
  ahead: number;
  behind: number;
  /** repository color shown in sidebar / switcher */
  c: string;
  /** profile mismatch warning (identity vs matched profile) */
  warn: boolean;
}

export interface ChangedFile {
  st: FileStatus;
  dir: string;
  name: string;
}

export type DiffLineKind = "ctx" | "add" | "del";

export interface DiffRow {
  hunk?: string;
  n1?: string;
  n2?: string;
  t?: DiffLineKind;
  text?: string;
  /** a review thread is anchored under this line (PR diff) */
  thread?: boolean;
  hunkIdx?: number;
  rawIndex?: number;
}

export type RefKind = "local" | "remote" | "tag";

export interface GraphCommit {
  lane: number;
  refs: { n: string; k: RefKind }[];
  msg: string;
  au: string;
  ini: string;
  time: string;
  sha: string;
  merge?: boolean;
}

export interface Branch {
  n: string;
  cur: boolean;
  sync: string;
  act: string;
  pr: string;
  wt: string;
  stale?: boolean;
}

export interface RemoteBranch {
  n: string;
  act: string;
  gone?: boolean;
}

export type ReviewState = "approved" | "changes" | "requested" | "none";
export type CiState = "pass" | "fail" | "run" | "queue";

export interface PullRequest {
  t: string;
  num: number;
  au: string;
  ini: string;
  repo: string;
  from: string;
  to: string;
  review: ReviewState;
  ci: CiState;
  draft: boolean;
  merged?: boolean;
  upd: string;
  com: number;
}

export interface PrFile {
  st: FileStatus;
  dir: string;
  name: string;
  rev: boolean;
  threads: number;
}

export interface CiCheck {
  n: string;
  s: CiState;
  d: string;
}

export interface Worktree {
  path: string;
  branch: string;
  main: boolean;
  dirty: number;
  pr: string;
  act: string;
  temp: boolean;
}

export interface ConflictFile {
  dir: string;
  name: string;
  state: "active" | "done";
  count: number;
}

export type OpState = "pass" | "fail" | "run";

export interface Operation {
  s: OpState;
  type: string;
  repo: string;
  cmd: string;
  dur: string;
  time: string;
  exit: number | null;
  out: string;
  prev: string;
  next: string;
  /** recovery hint shown for destructive/failed operations */
  rec?: string;
}

export interface WorkspaceRepo {
  n: string;
  br: string;
  dirty: number;
  sync: string;
  pr: string;
  ci: CiState;
  prof: string;
  fetch: string;
}

export interface CommitFile {
  st: FileStatus;
  dir: string;
  name: string;
  pm: string;
}

export interface FileHistoryEntry {
  sha: string;
  msg: string;
  who: string;
  time: string;
}

export interface PaletteCommand {
  label: string;
  glyph: string;
  group: "Navigate" | "Git" | "Repository" | "Identity" | "App";
  key?: string;
  warn?: boolean;
  act: () => void;
}
