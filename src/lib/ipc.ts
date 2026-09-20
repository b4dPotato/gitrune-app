/** Typed boundary between the React UI and the Rust backend.
 *
 * Every backend capability is a named, typed command (see src-tauri/src/lib.rs).
 * The UI can never run arbitrary shell commands — arguments are structured
 * data and the Rust side passes them to git as an argv array.
 *
 * Outside Tauri (plain browser dev) calls fall back to demo data so the whole
 * UI stays explorable; `isDemo()` tells the UI which mode it is in. */
import * as mock from "./mock";

export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const demoEnabled = () => import.meta.env.VITE_DEMO_MODE === "true";
export const isDemo = () => !inTauri() && demoEnabled();
export const desktopRuntimeRequired = () => !inTauri() && !demoEnabled();

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import("@tauri-apps/api/core");
  return core.invoke<T>(cmd, args);
}

/** Central error model mirrored from src-tauri/src/error.rs */
export interface AppError {
  code: string;
  category:
    | "git"
    | "filesystem"
    | "authentication"
    | "authorization"
    | "network"
    | "validation"
    | "conflict"
    | "provider"
    | "internal";
  title: string;
  message: string;
  technicalDetails?: string;
  suggestedActions: { label: string; action: string }[];
  retryable: boolean;
  command?: string;
  exitCode?: number;
}

export function isAppError(e: unknown): e is AppError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

export function errorText(e: unknown): string {
  if (isAppError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Convert backend payloads, failed operation results, and ordinary errors to
 * one display model so every screen can preserve suggestions and diagnostics. */
export function normalizeAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const technicalDetails = errorText(error);
  const lower = technicalDetails.toLowerCase();
  if (lower.includes("non-fast-forward") || lower.includes("fetch first")) {
    return {
      code: "git.non_fast_forward",
      category: "conflict",
      title: "Push was rejected",
      message: "The remote branch contains commits that are not available locally.",
      technicalDetails,
      suggestedActions: [{ label: "Fetch and review incoming commits", action: "fetch" }],
      retryable: true,
    };
  }
  if (
    lower.includes("permission denied") ||
    lower.includes("authentication failed") ||
    lower.includes("publickey")
  ) {
    return {
      code: "git.authentication_failed",
      category: "authentication",
      title: "Authentication failed",
      message: "Git could not authenticate with the remote.",
      technicalDetails,
      suggestedActions: [
        { label: "Check the configured SSH key or credential helper", action: "check_credentials" },
      ],
      retryable: true,
    };
  }
  if (lower.includes("conflict")) {
    return {
      code: "git.conflict",
      category: "conflict",
      title: "Git operation has conflicts",
      message: "Resolve the conflicted files before continuing.",
      technicalDetails,
      suggestedActions: [{ label: "Open conflict resolution", action: "open_conflicts" }],
      retryable: true,
    };
  }
  if (
    lower.includes("no configured push destination") ||
    lower.includes("no upstream branch") ||
    lower.includes("does not appear to be a git repository")
  ) {
    return {
      code: "git.remote_not_configured",
      category: "validation",
      title: "Remote setup required",
      message: "This branch does not have a usable remote destination.",
      technicalDetails,
      suggestedActions: [
        { label: "Configure a remote and publish the branch", action: "setup_remote" },
      ],
      retryable: true,
    };
  }
  return {
    code: "git.operation_failed",
    category: "git",
    title: "Git operation failed",
    message: technicalDetails || "Git could not complete the operation.",
    technicalDetails: technicalDetails || undefined,
    suggestedActions: [{ label: "Review the operation log", action: "open_operation_log" }],
    retryable: true,
  };
}

export function operationError(
  result: OpResult,
  fallback = "Git could not complete the operation",
): AppError {
  const error = normalizeAppError(result.stderr || result.stdout || fallback);
  return { ...error, command: result.command, exitCode: result.exitCode };
}

export interface GitInfo {
  path: string;
  version: string;
}

export interface RepoRecord {
  id: number;
  name: string;
  path: string;
  color: string;
  lastOpenedAt: string;
}

export interface StatusFile {
  st: string;
  path: string;
  origPath: string | null;
  staged: boolean;
  conflicted: boolean;
  untracked: boolean;
}

export interface RepoStatus {
  branch: string;
  upstream: string | null;
  detached: boolean;
  ahead: number;
  behind: number;
  dirty: number;
  clean: boolean;
  files: StatusFile[];
  operation: string | null;
}

export interface OpResult {
  operationId: number;
  status: "succeeded" | "failed" | "cancelled";
  command: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  previousHead: string;
  resultingHead: string;
  durationMs: number;
  recoveryId: number | null;
}

export interface UndoCommitPreview {
  sha: string;
  subject: string;
  initialCommit: boolean;
  published: boolean;
  remoteRefs: string[];
  command: string;
}

export interface AppSettings {
  theme: import("./types").Theme;
  language: import("../i18n").SupportedLanguage;
  uiZoom: number;
  customTheme: import("./types").CustomTheme;
  rightPanelWidth: number;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  graphCommitWidth: number;
  graphFilesWidth: number;
  changesPanelWidth: number;
  diffMode: "inline" | "side";
  editor: EditorId | "auto";
  editorAssociations: Record<string, EditorId>;
  terminal: "auto" | "wt" | "cmd" | "powershell";
}

export type EditorId = "code" | "codium" | "notepad" | "system";

export interface EditorOption {
  id: EditorId;
  label: string;
  recommended: boolean;
  icon: "code" | "codium" | "notepad" | "system" | "folder";
  detail?: string | null;
}

export interface RecoveryEntry {
  id: number;
  repo: string;
  kind: string;
  paths: string[];
  checkpoint: string | null;
  backupPath: string | null;
  createdAt: string;
  restoredAt: string | null;
}

export interface IdentityDetails {
  effectiveName: string | null;
  effectiveEmail: string | null;
  localName: string | null;
  localEmail: string | null;
  signingKey: string | null;
  signCommits: boolean;
  nameSource: "local" | "global" | "system" | "unset";
  emailSource: "local" | "global" | "system" | "unset";
  localConfigured: boolean;
}

export interface IdentityProfile {
  id: number;
  label: string;
  name: string;
  email: string;
  signingKey: string | null;
  sshHost: string | null;
  signCommits: boolean;
}

export interface OpEntry {
  id: number;
  opType: string;
  repo: string;
  cmd: string;
  exit: number | null;
  out: string;
  prevHead: string;
  nextHead: string;
  startedAt: string;
  durationMs: number;
  status: "running" | "succeeded" | "failed" | "cancelled";
  recoveryId: number | null;
}

export interface Remote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  isDefault: boolean;
}

export interface Upstream {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export interface CommitRecord {
  sha: string;
  parents: string[];
  author: string;
  email: string;
  authoredAt: string;
  relativeTime: string;
  subject: string;
  decorations: string[];
}

export interface GraphFilters {
  message?: string;
  author?: string;
  since?: string;
  until?: string;
  revision?: string;
  filePath?: string;
}

export interface CommitPage {
  commits: CommitRecord[];
  nextCursor: string | null;
}

export interface CompareFile {
  status: string;
  path: string;
  oldPath: string | null;
}

export interface CommitComparison {
  base: string;
  head: string;
  ahead: number;
  behind: number;
  commits: CommitRecord[];
  files: CompareFile[];
}

export interface StashDetail {
  reference: string;
  patch: string;
  files: CompareFile[];
}

export interface Tag {
  name: string;
  target: string;
  kind: string;
  message: string;
}

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
  dirty: number;
}

export interface BlameLine {
  sha: string;
  originalLine: number;
  finalLine: number;
  author: string;
  authoredAt: number;
  summary: string;
  text: string;
}

export interface LineHistoryEntry {
  sha: string;
  author: string;
  authoredAt: string;
  subject: string;
  patch: string;
}

export interface OperationProgress {
  operationId: number;
  repository: string;
  phase: "started" | "output" | "succeeded" | "failed" | "cancelled";
  stream: "stdout" | "stderr" | "system";
  message: string;
}

export interface ConflictVersions {
  base: string;
  ours: string;
  theirs: string;
  result: string;
}

// ---------- demo fallbacks ----------

const demoOk: OpResult = {
  operationId: 0,
  status: "succeeded",
  command: "demo",
  success: true,
  exitCode: 0,
  stdout: "(demo mode — no git executed)",
  stderr: "",
  previousHead: "e7c210f",
  resultingHead: "e7c210f",
  durationMs: 12,
  recoveryId: null,
};

function demoRepos(): RepoRecord[] {
  return mock.REPOS.map((r, i) => ({
    id: i + 1,
    name: r.name,
    path: r.path,
    color: r.c,
    lastOpenedAt: "",
  }));
}

function demoStatus(path: string): RepoStatus {
  const r = mock.REPOS.find((x) => x.path === path) ?? mock.REPOS[0];
  const files: StatusFile[] = [
    ...mock.UNSTAGED.map((f) => ({
      st: f.st,
      path: f.dir + f.name,
      origPath: null,
      staged: false,
      conflicted: false,
      untracked: f.st === "?",
    })),
    ...mock.STAGED.map((f) => ({
      st: f.st,
      path: f.dir + f.name,
      origPath: null,
      staged: true,
      conflicted: false,
      untracked: false,
    })),
  ];
  return {
    branch: r.branch,
    upstream: `origin/${r.branch}`,
    detached: false,
    ahead: r.ahead,
    behind: r.behind,
    dirty: r.dirty,
    clean: r.dirty === 0,
    files: r.name === "backend-api" ? files : files.slice(0, r.dirty),
    operation: null,
  };
}

const US = "\x1f";
const RS = "\x1e";

const DEMO_REFS = [
  [
    "feature/auth-tokens",
    "e7c210f",
    "*",
    "origin/feature/auth-tokens",
    "[ahead 2, behind 1]",
    "25 minutes ago",
    "1760000000",
    "refs/heads/feature/auth-tokens",
  ],
  [
    "main",
    "a3f8c21",
    "",
    "origin/main",
    "[behind 3]",
    "1 day ago",
    "1759900000",
    "refs/heads/main",
  ],
  [
    "fix/session-leak",
    "77e01bc",
    "",
    "origin/fix/session-leak",
    "",
    "1 day ago",
    "1759800000",
    "refs/heads/fix/session-leak",
  ],
  [
    "feature/rate-limits",
    "4a91d02",
    "",
    "",
    "",
    "1 week ago",
    "1759000000",
    "refs/heads/feature/rate-limits",
  ],
  ["pr-138-review", "9921fd0", "", "", "", "2 days ago", "1759700000", "refs/heads/pr-138-review"],
  ["origin/main", "c90aa1e", "", "", "", "1 day ago", "1759900000", "refs/remotes/origin/main"],
  [
    "origin/feature/auth-tokens",
    "41c88d2",
    "",
    "",
    "",
    "5 hours ago",
    "1759990000",
    "refs/remotes/origin/feature/auth-tokens",
  ],
  [
    "origin/feature/webhook-v2",
    "d01c3aa",
    "",
    "",
    "",
    "2 days ago",
    "1759700000",
    "refs/remotes/origin/feature/webhook-v2",
  ],
  [
    "origin/fix/session-leak",
    "77e01bc",
    "",
    "",
    "",
    "1 day ago",
    "1759800000",
    "refs/remotes/origin/fix/session-leak",
  ],
  ["v2.4.0", "f30d1b8", "", "", "", "3 days ago", "1759600000", "refs/tags/v2.4.0"],
]
  .map((f) => f.join(US))
  .join("\n");

function demoLog(): string {
  // parents chosen so the demo graph mirrors the design prototype's shape
  const parents: Record<string, string> = {
    e7c210f: "b90d3a2",
    b90d3a2: "41c88d2",
    "41c88d2": "1f7ac03",
    a3f8c21: "9c4be70 5d20c9e",
    "77e01bc": "5d20c9e",
    "5d20c9e": "9c4be70",
    "9c4be70": "f30d1b8",
    "1f7ac03": "9c4be70",
    f30d1b8: "84a2e11",
    "84a2e11": "6b90dd4",
    "6b90dd4": "02c77af",
    "02c77af": "d19e3c5",
    d19e3c5: "4e8bb02",
    "4e8bb02": "",
  };
  return (
    mock.GRAPH.map((g) => {
      const deco = g.refs.map((r) => (r.k === "tag" ? `tag: ${r.n}` : r.n)).join(", ");
      return [g.sha, parents[g.sha] ?? "", g.au, g.time, g.msg, deco].join(US);
    }).join(RS + "\n") + RS
  );
}

const DEMO_DIFF = `diff --git a/src/api/client.ts b/src/api/client.ts
index 3b18e51..8f2a1c3 100644
--- a/src/api/client.ts
+++ b/src/api/client.ts
@@ -12,7 +12,9 @@ export class ApiClient {
   constructor(config: ClientConfig) {
     this.baseUrl = config.baseUrl;
-    this.timeout = 5000;
+    this.timeout = config.timeout ?? 5000;
+    this.retryBudget = config.retryBudget ?? 3;
     this.headers = buildHeaders(config);
   }

@@ -41,10 +43,18 @@ export class ApiClient {
   async request<T>(path: string, init?: RequestInit): Promise<T> {
-    const res = await fetch(this.baseUrl + path, init);
-    return res.json();
+    let attempt = 0;
+    while (true) {
+      const res = await fetch(this.baseUrl + path, this.withAuth(init));
+      if (res.status !== 401 || attempt >= this.retryBudget) {
+        return this.parse<T>(res);
+      }
+      await this.refreshToken();
+      attempt += 1;
+    }
   }
 }
`;

const DEMO_STASHES =
  ["stash@{0}", "WIP: rate limiter spike", "1 day ago"].join(US) +
  "\n" +
  ["stash@{1}", "debug logging for auth", "4 days ago"].join(US);

const DEMO_WORKTREES = `worktree /code/acme/backend-api
HEAD e7c210f9a1b2c3d4e5f60718293a4b5c6d7e8f90
branch refs/heads/feature/auth-tokens

worktree /code/acme/backend-api.wt/pr-138
HEAD 9921fd0a1b2c3d4e5f60718293a4b5c6d7e8f901
detached

worktree /code/acme/backend-api.wt/rate-limits
HEAD 4a91d02b1c2d3e4f5a60718293a4b5c6d7e8f012
branch refs/heads/feature/rate-limits
`;

const DEMO_CONFLICT: ConflictVersions = {
  base: "  async rotate(sessionId: string) {\n    const session = this.sessions.get(sessionId);\n    const next = session.withRotatedToken();\n",
  ours: "  async rotate(sessionId: string) {\n    const session = await this.load(sessionId);\n    if (session.revoked) throw new SessionRevokedError();\n    const next = session.withRotatedToken();\n",
  theirs:
    "  async rotate(sessionId: string) {\n    const session = this.cache.get(sessionId);\n    audit.log('session.rotate', sessionId);\n    const next = session.withRotatedToken();\n",
  result:
    "  async rotate(sessionId: string) {\n<<<<<<< HEAD\n    const session = await this.load(sessionId);\n    if (session.revoked) throw new SessionRevokedError();\n=======\n    const session = this.cache.get(sessionId);\n    audit.log('session.rotate', sessionId);\n>>>>>>> main\n    const next = session.withRotatedToken();\n",
};

async function call<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => T,
): Promise<T> {
  if (!inTauri()) {
    if (demoEnabled()) return fallback();
    throw new Error("The live Git client requires the Tauri desktop runtime.");
  }
  return invoke<T>(cmd, args);
}

// ---------- API ----------

export const ipc = {
  // environment
  detectGit: () => call<GitInfo>("detect_git", undefined, () => ({ path: "git", version: "demo" })),
  openPath: (path: string, target: "files" | "editor" | "terminal") =>
    call<void>("open_path", { path, target }, () => undefined),
  listEditors: (file?: string) =>
    call<EditorOption[]>("list_editors", { file: file ?? null }, () => [
      { id: "code", label: "Visual Studio Code", recommended: true, icon: "code" },
      {
        id: "system",
        label: "System default",
        recommended: false,
        icon: "system",
        detail: "Uses the application configured in your operating system",
      },
    ]),
  openInEditor: (path: string, file: string | undefined, editor: EditorId) =>
    call<void>("open_in_editor", { path, file: file ?? null, editor }, () => undefined),
  getSettings: () =>
    call<AppSettings>("get_settings", undefined, () => ({
      theme: "dark",
      language: "en",
      uiZoom: 100,
      customTheme: { background: "#111827", panel: "#1f2937", accent: "#8b5cf6", text: "#f3f4f6" },
      rightPanelWidth: 312,
      sidebarCollapsed: false,
      sidebarWidth: 236,
      graphCommitWidth: 340,
      graphFilesWidth: 250,
      changesPanelWidth: 290,
      diffMode: "inline",
      editor: "auto",
      editorAssociations: {},
      terminal: "auto",
    })),
  saveSettings: (settings: AppSettings) =>
    call<void>("save_settings", { settings }, () => undefined),
  listRecoveries: (path?: string) =>
    call<RecoveryEntry[]>("list_recoveries", { path: path ?? null }, () => []),
  restoreRecovery: (id: number) => call<OpResult>("restore_recovery", { id }, () => demoOk),

  // repositories
  listRepos: () => call<RepoRecord[]>("list_repos", undefined, demoRepos),
  addRepo: (path: string, color?: string) =>
    call<RepoRecord>("add_repo", { path, color }, () => ({
      id: 99,
      name: path.split(/[\\/]/).pop() ?? path,
      path,
      color: color ?? "#5f9df6",
      lastOpenedAt: "",
    })),
  removeRepo: (id: number, path: string) =>
    call<void>("remove_repo", { id, path }, () => undefined),
  updateRepoColor: (id: number, color: string) =>
    call<void>("update_repo_color", { id, color }, () => undefined),
  touchRepo: (id: number) => call<void>("touch_repo", { id }, () => undefined),
  watchRepo: (path: string) => call<void>("watch_repo", { path }, () => undefined),
  cloneRepo: (url: string, parentDir: string) =>
    call<OpResult>("clone_repo", { url, parentDir }, () => demoOk),
  initRepo: (dir: string) => call<OpResult>("init_repo", { dir }, () => demoOk),

  // reads
  repoStatus: (path: string) => call<RepoStatus>("repo_status", { path }, () => demoStatus(path)),
  getIdentity: (path: string) =>
    call<string>("get_identity", { path }, () => "Alex Morgan <alex@example.com>"),
  identityDetails: (path: string) =>
    call<IdentityDetails>("identity_details", { path }, () => ({
      effectiveName: "Demo User",
      effectiveEmail: "demo@example.com",
      localName: null,
      localEmail: null,
      signingKey: null,
      signCommits: false,
      nameSource: "global",
      emailSource: "global",
      localConfigured: false,
    })),
  listIdentityProfiles: () =>
    call<IdentityProfile[]>("list_identity_profiles", undefined, () => []),
  saveIdentityProfile: (profile: IdentityProfile) =>
    call<IdentityProfile>("save_identity_profile", { profile }, () => ({
      ...profile,
      id: profile.id || Date.now(),
    })),
  deleteIdentityProfile: (id: number) =>
    call<void>("delete_identity_profile", { id }, () => undefined),
  applyIdentityProfile: (path: string, id: number) =>
    call<OpResult>("apply_identity_profile", { path, id }, () => demoOk),
  clearRepositoryIdentity: (path: string) =>
    call<OpResult>("clear_repository_identity", { path }, () => demoOk),
  applyProfileSshHost: (path: string, id: number, remote: string) =>
    call<OpResult>("apply_profile_ssh_host", { path, id, remote }, () => demoOk),
  listSshHosts: () => call<string[]>("list_ssh_hosts", undefined, () => []),
  getCommitTemplate: (path: string) =>
    call<string | null>("get_commit_template", { path }, () => null),
  listRefs: (path: string) => call<string>("list_refs", { path }, () => DEMO_REFS),
  commitLog: (path: string, skip: number, limit: number) =>
    call<string>("commit_log", { path, skip, limit }, () => (skip === 0 ? demoLog() : "")),
  commitInfo: (path: string, sha: string) =>
    call<string>("commit_info", { path, sha }, () => {
      const record = demoLog()
        .split(RS)
        .find((item) => item.trimStart().startsWith(sha));
      return record ? `${record}${RS}` : "";
    }),
  diffFile: (path: string, file: string, staged: boolean) =>
    call<string>("diff_file", { path, file, staged }, () => DEMO_DIFF),
  commitFiles: (path: string, sha: string) =>
    call<string>("commit_files", { path, sha }, () =>
      mock.COMMIT_FILES.map((f) => `${f.st}\t${f.dir}${f.name}`).join("\n"),
    ),
  commitFileDiff: (path: string, sha: string, file: string) =>
    call<string>("commit_file_diff", { path, sha, file }, () => DEMO_DIFF),
  compareFileDiff: (path: string, base: string, head: string, file: string) =>
    call<string>("compare_file_diff", { path, base, head, file }, () => DEMO_DIFF),
  stashList: (path: string) => call<string>("stash_list", { path }, () => DEMO_STASHES),
  worktreeList: (path: string) => call<string>("worktree_list", { path }, () => DEMO_WORKTREES),
  conflictVersions: (path: string, file: string) =>
    call<ConflictVersions>("conflict_versions", { path, file }, () => DEMO_CONFLICT),
  operationLog: () =>
    call<OpEntry[]>("operation_log", undefined, () =>
      mock.OPS.map((o, i) => ({
        id: i + 1,
        opType: o.type,
        repo: o.repo,
        cmd: o.cmd,
        exit: o.exit,
        out: o.out,
        prevHead: o.prev,
        nextHead: o.next,
        startedAt: o.time,
        durationMs: 0,
        status: o.exit === null ? "running" : o.exit === 0 ? "succeeded" : "failed",
        recoveryId: null,
      })),
    ),

  // mutations
  stageFiles: (path: string, files: string[]) =>
    call<OpResult>("stage_files", { path, files }, () => demoOk),
  unstageFiles: (path: string, files: string[]) =>
    call<OpResult>("unstage_files", { path, files }, () => demoOk),
  discardFiles: (path: string, files: string[]) =>
    call<OpResult>("discard_files", { path, files }, () => demoOk),
  applyPatch: (path: string, patch: string, reverse: boolean) =>
    call<OpResult>("apply_patch", { path, patch, reverse }, () => demoOk),
  commit: (
    path: string,
    message: string,
    amend: boolean,
    sign: boolean,
    allowPublishedAmend = false,
  ) => call<OpResult>("commit", { path, message, amend, sign, allowPublishedAmend }, () => demoOk),
  undoCommitPreview: (path: string) =>
    call<UndoCommitPreview>("undo_commit_preview", { path }, () => ({
      sha: "7d9a4c1",
      subject: "Demo commit",
      initialCommit: false,
      published: false,
      remoteRefs: [],
      command: "git reset --soft HEAD~1",
    })),
  undoLastCommit: (path: string, allowPublished = false) =>
    call<OpResult>("undo_last_commit", { path, allowPublished }, () => demoOk),
  fetch: (path: string) => call<OpResult>("git_fetch", { path }, () => demoOk),
  pull: (path: string, rebase: boolean) =>
    call<OpResult>("git_pull", { path, rebase }, () => demoOk),
  push: (
    path: string,
    setUpstream: boolean,
    forceWithLease: boolean,
    branch?: string,
    remote?: string,
  ) =>
    call<OpResult>(
      "git_push",
      { path, setUpstream, forceWithLease, branch: branch ?? null, remote: remote ?? null },
      () => demoOk,
    ),
  createBranch: (path: string, name: string, checkout: boolean, at?: string) =>
    call<OpResult>("create_branch", { path, name, checkout, at: at ?? null }, () => demoOk),
  checkoutBranch: (path: string, name: string) =>
    call<OpResult>("checkout_branch", { path, name }, () => demoOk),
  renameBranch: (path: string, oldName: string, newName: string) =>
    call<OpResult>("rename_branch", { path, oldName, newName }, () => demoOk),
  deleteBranch: (path: string, name: string, force: boolean) =>
    call<OpResult>("delete_branch", { path, name, force }, () => demoOk),
  mergeBranch: (path: string, name: string) =>
    call<OpResult>("merge_branch", { path, name }, () => demoOk),
  rebaseBranch: (path: string, name: string) =>
    call<OpResult>("rebase_branch", { path, name }, () => demoOk),
  cherryPick: (path: string, sha: string) =>
    call<OpResult>("cherry_pick", { path, sha }, () => demoOk),
  revertCommit: (path: string, sha: string) =>
    call<OpResult>("revert_commit", { path, sha }, () => demoOk),
  createTag: (path: string, name: string, sha: string) =>
    call<OpResult>("create_tag", { path, name, sha }, () => demoOk),
  gitContinue: (path: string, operation: string) =>
    call<OpResult>("git_continue", { path, operation }, () => demoOk),
  gitAbort: (path: string, operation: string) =>
    call<OpResult>("git_abort", { path, operation }, () => demoOk),
  resolveConflict: (path: string, file: string, side: "ours" | "theirs") =>
    call<OpResult>("resolve_conflict", { path, file, side }, () => demoOk),
  markResolved: (path: string, file: string) =>
    call<OpResult>("mark_resolved", { path, file }, () => demoOk),
  worktreeAdd: (path: string, wtPath: string, branch: string, create: boolean) =>
    call<OpResult>("worktree_add", { path, wtPath, branch, create }, () => demoOk),
  worktreeRemove: (path: string, wtPath: string, force: boolean) =>
    call<OpResult>("worktree_remove", { path, wtPath, force }, () => demoOk),
  worktreePrune: (path: string) => call<OpResult>("worktree_prune", { path }, () => demoOk),
  stashPush: (path: string, message: string, includeUntracked: boolean) =>
    call<OpResult>("stash_push", { path, message, includeUntracked }, () => demoOk),
  stashApply: (path: string, index: number) =>
    call<OpResult>("stash_apply", { path, index }, () => demoOk),
  stashDrop: (path: string, index: number) =>
    call<OpResult>("stash_drop", { path, index }, () => demoOk),

  // reliable local MVP additions
  listRemotes: (path: string) => call<Remote[]>("list_remotes", { path }, () => []),
  currentUpstream: (path: string) =>
    call<Upstream>("current_upstream", { path }, () => ({
      branch: "main",
      upstream: "origin/main",
      ahead: 0,
      behind: 0,
    })),
  commitPage: (path: string, cursor: string | null, limit: number, filters: GraphFilters) =>
    call<CommitPage>("commit_page", { path, cursor, limit, filters }, () => ({
      commits: [],
      nextCursor: null,
    })),
  compareCommits: (path: string, base: string, head: string) =>
    call<CommitComparison>("compare_commits", { path, base, head }, () => ({
      base,
      head,
      ahead: 0,
      behind: 0,
      commits: [],
      files: [],
    })),
  fileHistory: (path: string, file: string, limit = 200) =>
    call<CommitRecord[]>("file_history", { path, file, limit }, () => []),
  blameFile: (path: string, file: string) =>
    call<BlameLine[]>("blame_file", { path, file }, () => []),
  lineHistory: (path: string, file: string, start: number, end: number) =>
    call<LineHistoryEntry[]>("line_history", { path, file, start, end }, () => []),
  stashDetail: (path: string, index: number) =>
    call<StashDetail>("stash_detail", { path, index }, () => ({
      reference: `stash@{${index}}`,
      patch: "",
      files: [],
    })),
  listTags: (path: string) => call<Tag[]>("list_tags", { path }, () => []),
  listWorktreeInfo: (path: string) =>
    call<WorktreeInfo[]>("list_worktree_info", { path }, () => []),
  addRemote: (path: string, name: string, url: string) =>
    call<OpResult>("add_remote", { path, name, url }, () => demoOk),
  updateRemote: (path: string, name: string, url: string) =>
    call<OpResult>("update_remote", { path, name, url }, () => demoOk),
  removeRemote: (path: string, name: string) =>
    call<OpResult>("remove_remote", { path, name }, () => demoOk),
  selectDefaultRemote: (path: string, name: string) =>
    call<OpResult>("select_default_remote", { path, name }, () => demoOk),
  fetchRemote: (path: string, remote?: string) =>
    call<OpResult>("fetch_remote", { path, remote: remote ?? null }, () => demoOk),
  setUpstream: (path: string, branch: string, remote: string, remoteBranch: string) =>
    call<OpResult>("set_upstream", { path, branch, remote, remoteBranch }, () => demoOk),
  unsetUpstream: (path: string, branch: string) =>
    call<OpResult>("unset_upstream", { path, branch }, () => demoOk),
  checkoutRemoteBranch: (path: string, remoteRef: string, localName: string) =>
    call<OpResult>("checkout_remote_branch", { path, remoteRef, localName }, () => demoOk),
  stashPop: (path: string, index: number) =>
    call<OpResult>("stash_pop", { path, index }, () => demoOk),
  stashBranch: (path: string, index: number, branch: string) =>
    call<OpResult>("stash_branch", { path, index, branch }, () => demoOk),
  createTagAdvanced: (path: string, name: string, sha: string, message?: string) =>
    call<OpResult>(
      "create_tag_advanced",
      { path, name, sha, message: message ?? null },
      () => demoOk,
    ),
  pushTag: (path: string, remote: string, name: string) =>
    call<OpResult>("push_tag", { path, remote, name }, () => demoOk),
  deleteTag: (path: string, name: string, remote?: string) =>
    call<OpResult>("delete_tag", { path, name, remote: remote ?? null }, () => demoOk),
  cancelOperation: (operationId: number) =>
    call<void>("cancel_operation", { operationId }, () => undefined),
};

/** Open the OS folder picker. Browser demos never pretend to return local paths. */
export async function pickFolder(): Promise<string | null> {
  if (inTauri()) {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const dir = await dialog.open({ directory: true, multiple: false });
    return typeof dir === "string" ? dir : null;
  }
  throw new Error("Folder selection requires the Tauri desktop runtime.");
}

export interface RepoChangedEvent {
  path: string;
  scope: "workingTree" | "repository";
}

/** Subscribe to backend `repo-changed` events (fired by the file watcher). */
export async function onRepoChanged(cb: (change: RepoChangedEvent) => void): Promise<() => void> {
  if (!inTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<RepoChangedEvent>("repo-changed", (e) => cb(e.payload));
  return un;
}

export async function onOperationProgress(
  cb: (progress: OperationProgress) => void,
): Promise<() => void> {
  if (!inTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<OperationProgress>("operation-progress", (event) => cb(event.payload));
}
