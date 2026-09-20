/** Demo data ported 1:1 from the design prototype (Gitrune.dc.html).
 * Served through `ipc.ts` when the app runs outside Tauri (browser dev) or
 * before the corresponding backend command is implemented. */
import type {
  Branch,
  ChangedFile,
  CiCheck,
  CommitFile,
  ConflictFile,
  DiffRow,
  FileHistoryEntry,
  GraphCommit,
  Operation,
  PrFile,
  PullRequest,
  RemoteBranch,
  Repo,
  Worktree,
  WorkspaceRepo,
} from "./types";

export const REPOS: Repo[] = [
  {
    name: "backend-api",
    path: "~/code/acme/backend-api",
    branch: "feature/auth-tokens",
    dirty: 8,
    ahead: 2,
    behind: 1,
    warn: false,
    c: "#5f9df6",
  },
  {
    name: "web-app",
    path: "~/code/acme/web-app",
    branch: "main",
    dirty: 0,
    ahead: 0,
    behind: 3,
    warn: false,
    c: "#34c0a2",
  },
  {
    name: "dotfiles",
    path: "~/personal/dotfiles",
    branch: "main",
    dirty: 1,
    ahead: 1,
    behind: 0,
    warn: true,
    c: "#a98bf2",
  },
];

export const UNSTAGED: ChangedFile[] = [
  { st: "M", dir: "src/api/", name: "client.ts" },
  { st: "A", dir: "src/auth/", name: "refresh.ts" },
  { st: "M", dir: "", name: "README.md" },
  { st: "D", dir: "src/legacy/", name: "old-auth.ts" },
  { st: "M", dir: "", name: ".env.example" },
];

export const STAGED: ChangedFile[] = [
  { st: "M", dir: "src/auth/", name: "token.ts" },
  { st: "M", dir: "src/auth/", name: "session.ts" },
  { st: "M", dir: "", name: "package.json" },
];

export const DIFF: DiffRow[] = [
  { hunk: "@@ -12,7 +12,9 @@ export class ApiClient {" },
  { n1: "12", n2: "12", t: "ctx", text: "  constructor(config: ClientConfig) {" },
  { n1: "13", n2: "13", t: "ctx", text: "    this.baseUrl = config.baseUrl;" },
  { n1: "14", n2: "", t: "del", text: "    this.timeout = 5000;" },
  { n1: "", n2: "14", t: "add", text: "    this.timeout = config.timeout ?? 5000;" },
  { n1: "", n2: "15", t: "add", text: "    this.retryBudget = config.retryBudget ?? 3;" },
  { n1: "15", n2: "16", t: "ctx", text: "    this.headers = buildHeaders(config);" },
  { n1: "16", n2: "17", t: "ctx", text: "  }" },
  { n1: "17", n2: "18", t: "ctx", text: "" },
  { hunk: "@@ -41,10 +43,18 @@ export class ApiClient {" },
  {
    n1: "41",
    n2: "43",
    t: "ctx",
    text: "  async request<T>(path: string, init?: RequestInit): Promise<T> {",
  },
  { n1: "42", n2: "", t: "del", text: "    const res = await fetch(this.baseUrl + path, init);" },
  { n1: "43", n2: "", t: "del", text: "    return res.json();" },
  { n1: "", n2: "44", t: "add", text: "    let attempt = 0;" },
  { n1: "", n2: "45", t: "add", text: "    while (true) {" },
  {
    n1: "",
    n2: "46",
    t: "add",
    text: "      const res = await fetch(this.baseUrl + path, this.withAuth(init));",
  },
  {
    n1: "",
    n2: "47",
    t: "add",
    text: "      if (res.status !== 401 || attempt >= this.retryBudget) {",
  },
  { n1: "", n2: "48", t: "add", text: "        return this.parse<T>(res);" },
  { n1: "", n2: "49", t: "add", text: "      }" },
  { n1: "", n2: "50", t: "add", text: "      await this.refreshToken();" },
  { n1: "", n2: "51", t: "add", text: "      attempt += 1;" },
  { n1: "", n2: "52", t: "add", text: "    }" },
  { n1: "44", n2: "53", t: "ctx", text: "  }" },
  { n1: "45", n2: "54", t: "ctx", text: "}" },
];

export const FILE_HISTORY: FileHistoryEntry[] = [
  { sha: "c41d9ae", msg: "Add retry budget to API client", who: "Marta V.", time: "3w" },
  { sha: "98b02f1", msg: "Extract header builder", who: "Alex M.", time: "5w" },
  { sha: "2fe61c0", msg: "Initial API client", who: "Alex M.", time: "3mo" },
];

export const GRAPH: GraphCommit[] = [
  {
    lane: 1,
    refs: [{ n: "feature/auth-tokens", k: "local" }],
    msg: "Rotate refresh tokens on use",
    au: "Alex Morgan",
    ini: "EK",
    time: "25 min ago",
    sha: "e7c210f",
  },
  {
    lane: 1,
    refs: [],
    msg: "Add session revocation endpoint",
    au: "Alex Morgan",
    ini: "EK",
    time: "2 h ago",
    sha: "b90d3a2",
  },
  {
    lane: 1,
    refs: [{ n: "origin/feature/auth-tokens", k: "remote" }],
    msg: "Refactor token refresh & session rotation",
    au: "Alex Morgan",
    ini: "EK",
    time: "5 h ago",
    sha: "41c88d2",
  },
  {
    lane: 0,
    refs: [
      { n: "main", k: "local" },
      { n: "origin/main", k: "remote" },
    ],
    msg: "Merge pull request #139 from acme/fix-session-leak",
    au: "Marta Villanueva",
    ini: "MV",
    time: "1 d ago",
    sha: "a3f8c21",
    merge: true,
  },
  {
    lane: 2,
    refs: [],
    msg: "Fix session leak on logout",
    au: "Marta Villanueva",
    ini: "MV",
    time: "1 d ago",
    sha: "77e01bc",
  },
  {
    lane: 2,
    refs: [],
    msg: "Add regression test for logout",
    au: "Marta Villanueva",
    ini: "MV",
    time: "1 d ago",
    sha: "5d20c9e",
  },
  {
    lane: 0,
    refs: [],
    msg: "Bump dependencies (renovate)",
    au: "acme-ci",
    ini: "CI",
    time: "2 d ago",
    sha: "9c4be70",
  },
  {
    lane: 1,
    refs: [],
    msg: "Add auth token scaffolding",
    au: "Alex Morgan",
    ini: "EK",
    time: "2 d ago",
    sha: "1f7ac03",
  },
  {
    lane: 0,
    refs: [{ n: "v2.4.0", k: "tag" }],
    msg: "Release 2.4.0",
    au: "Priya Nair",
    ini: "PN",
    time: "3 d ago",
    sha: "f30d1b8",
    merge: true,
  },
  {
    lane: 0,
    refs: [],
    msg: "Harden rate limiter defaults",
    au: "Priya Nair",
    ini: "PN",
    time: "3 d ago",
    sha: "84a2e11",
  },
  {
    lane: 0,
    refs: [],
    msg: "Document webhook retries",
    au: "Jonas Weber",
    ini: "JW",
    time: "4 d ago",
    sha: "6b90dd4",
  },
  {
    lane: 0,
    refs: [],
    msg: "Fix flaky integration test",
    au: "Marta Villanueva",
    ini: "MV",
    time: "4 d ago",
    sha: "02c77af",
  },
  {
    lane: 0,
    refs: [],
    msg: "Extract signing middleware",
    au: "Alex Morgan",
    ini: "EK",
    time: "5 d ago",
    sha: "d19e3c5",
  },
  {
    lane: 0,
    refs: [],
    msg: "Migrate config loader to zod",
    au: "Jonas Weber",
    ini: "JW",
    time: "6 d ago",
    sha: "4e8bb02",
  },
];

/** graph topology: v = vertical segments [lane, 0=full|1=lower-half|2=upper-half];
 * curves = other lane joining/leaving this row's dot */
export const GRAPH_TOPO: {
  v: [number, number][];
  curves?: { lane: number; dir: "top" | "bottom" }[];
}[] = [
  {
    v: [
      [0, 0],
      [1, 1],
    ],
  },
  {
    v: [
      [0, 0],
      [1, 0],
    ],
  },
  {
    v: [
      [0, 0],
      [1, 0],
    ],
  },
  {
    v: [
      [0, 0],
      [1, 0],
    ],
    curves: [{ lane: 2, dir: "bottom" }],
  },
  {
    v: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  {
    v: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  {
    v: [
      [0, 0],
      [1, 0],
    ],
    curves: [{ lane: 2, dir: "top" }],
  },
  {
    v: [
      [0, 0],
      [1, 0],
    ],
  },
  { v: [[0, 0]], curves: [{ lane: 1, dir: "top" }] },
  { v: [[0, 0]] },
  { v: [[0, 0]] },
  { v: [[0, 0]] },
  { v: [[0, 0]] },
  { v: [[0, 0]] },
];

export const COMMIT_FILES: CommitFile[] = [
  { st: "M", dir: "src/auth/", name: "token.ts", pm: "+38 −12" },
  { st: "M", dir: "src/auth/", name: "session.ts", pm: "+21 −9" },
  { st: "A", dir: "src/auth/", name: "rotation.ts", pm: "+64" },
  { st: "M", dir: "test/", name: "session.test.ts", pm: "+40 −2" },
];

export const BRANCHES: Branch[] = [
  {
    n: "feature/auth-tokens",
    cur: true,
    sync: "↑2 ↓1",
    act: "25 min ago",
    pr: "#142",
    wt: "main worktree",
  },
  { n: "main", cur: false, sync: "↓3", act: "1 d ago", pr: "", wt: "" },
  {
    n: "fix/session-leak",
    cur: false,
    sync: "merged",
    act: "1 d ago",
    pr: "#139",
    wt: "",
    stale: true,
  },
  { n: "feature/rate-limits", cur: false, sync: "↑5 unpublished", act: "1 w ago", pr: "", wt: "" },
  {
    n: "pr-138-review",
    cur: false,
    sync: "detached",
    act: "2 d ago",
    pr: "#138",
    wt: "⧉ review worktree",
  },
];

export const RBRANCHES: RemoteBranch[] = [
  { n: "origin/main", act: "1 d ago" },
  { n: "origin/feature/auth-tokens", act: "5 h ago" },
  { n: "origin/feature/webhook-v2", act: "2 d ago" },
  { n: "origin/fix/session-leak", act: "1 d ago", gone: true },
];

export const PRS: PullRequest[] = [
  {
    t: "Refactor token refresh & session rotation",
    num: 142,
    au: "alex",
    ini: "EK",
    repo: "backend-api",
    from: "feature/auth-tokens",
    to: "main",
    review: "changes",
    ci: "fail",
    draft: false,
    upd: "25 min ago",
    com: 12,
  },
  {
    t: "Webhook delivery v2 with signed payloads",
    num: 141,
    au: "jweber",
    ini: "JW",
    repo: "backend-api",
    from: "feature/webhook-v2",
    to: "main",
    review: "requested",
    ci: "run",
    draft: false,
    upd: "1 h ago",
    com: 3,
  },
  {
    t: "Design tokens for dark mode",
    num: 87,
    au: "mvilla",
    ini: "MV",
    repo: "web-app",
    from: "feat/dark-tokens",
    to: "main",
    review: "approved",
    ci: "pass",
    draft: false,
    upd: "3 h ago",
    com: 5,
  },
  {
    t: "Spike: edge cache for session lookups",
    num: 140,
    au: "pnair",
    ini: "PN",
    repo: "backend-api",
    from: "spike/edge-cache",
    to: "main",
    review: "none",
    ci: "pass",
    draft: true,
    upd: "1 d ago",
    com: 0,
  },
  {
    t: "Migrate CI to reusable workflows",
    num: 138,
    au: "alex",
    ini: "EK",
    repo: "backend-api",
    from: "chore/ci-reuse",
    to: "main",
    review: "requested",
    ci: "pass",
    draft: false,
    upd: "2 d ago",
    com: 8,
  },
  {
    t: "Fix session leak on logout",
    num: 139,
    au: "mvilla",
    ini: "MV",
    repo: "backend-api",
    from: "fix/session-leak",
    to: "main",
    review: "approved",
    ci: "pass",
    merged: true,
    draft: false,
    upd: "1 d ago",
    com: 4,
  },
];

export const PR_FILES: PrFile[] = [
  { st: "M", dir: "src/auth/", name: "token.ts", rev: true, threads: 0 },
  { st: "M", dir: "src/auth/", name: "session.ts", rev: false, threads: 2 },
  { st: "A", dir: "src/auth/", name: "rotation.ts", rev: false, threads: 0 },
  { st: "M", dir: "src/api/", name: "client.ts", rev: true, threads: 0 },
  { st: "M", dir: "test/", name: "session.test.ts", rev: false, threads: 0 },
  { st: "D", dir: "src/legacy/", name: "old-auth.ts", rev: true, threads: 0 },
];

export const PR_DIFF: DiffRow[] = [
  { hunk: "@@ -18,6 +18,14 @@ export class SessionStore {" },
  { n1: "18", n2: "18", t: "ctx", text: "  async rotate(sessionId: string): Promise<Session> {" },
  { n1: "19", n2: "", t: "del", text: "    const session = this.cache.get(sessionId);" },
  { n1: "", n2: "19", t: "add", text: "    const session = await this.load(sessionId);" },
  { n1: "", n2: "20", t: "add", text: "    if (session.revoked) {" },
  { n1: "", n2: "21", t: "add", text: "      throw new SessionRevokedError(sessionId);" },
  { n1: "", n2: "22", t: "add", text: "    }", thread: true },
  { n1: "20", n2: "23", t: "ctx", text: "    const next = session.withRotatedToken();" },
  { n1: "21", n2: "24", t: "ctx", text: "    await this.persist(next);" },
  { n1: "22", n2: "25", t: "ctx", text: "    return next;" },
  { n1: "23", n2: "26", t: "ctx", text: "  }" },
];

export const CHECKS: CiCheck[] = [
  { n: "build / compile", s: "pass", d: "1m 42s" },
  { n: "test / unit", s: "pass", d: "3m 08s" },
  { n: "test / integration", s: "fail", d: "4m 51s" },
  { n: "lint / eslint", s: "pass", d: "58s" },
  { n: "security / codeql", s: "run", d: "running" },
  { n: "deploy-preview", s: "queue", d: "queued" },
];

export const WORKTREES: Worktree[] = [
  {
    path: "~/code/acme/backend-api",
    branch: "feature/auth-tokens",
    main: true,
    dirty: 8,
    pr: "#142",
    act: "now",
    temp: false,
  },
  {
    path: "~/code/acme/backend-api.wt/pr-138",
    branch: "pr-138-review",
    main: false,
    dirty: 0,
    pr: "#138",
    act: "2 d ago",
    temp: true,
  },
  {
    path: "~/code/acme/backend-api.wt/rate-limits",
    branch: "feature/rate-limits",
    main: false,
    dirty: 3,
    pr: "",
    act: "1 w ago",
    temp: false,
  },
];

export const CONFLICT_FILES: ConflictFile[] = [
  { dir: "src/auth/", name: "session.ts", state: "active", count: 2 },
  { dir: "src/auth/", name: "token.ts", state: "done", count: 1 },
  { dir: "test/", name: "session.test.ts", state: "done", count: 1 },
];

export const OPS: Operation[] = [
  {
    s: "fail",
    type: "Push",
    repo: "backend-api",
    cmd: "git push origin feature/auth-tokens",
    dur: "1.8s",
    time: "2 min ago",
    exit: 1,
    out: "! [rejected]  feature/auth-tokens -> feature/auth-tokens (non-fast-forward)\nerror: failed to push some refs to github.com/acme-inc/backend-api.git\nhint: Updates were rejected because the remote contains work you do not have.",
    prev: "e7c210f",
    next: "e7c210f",
    rec: "Pull with rebase, then push — or push with --force-with-lease after review.",
  },
  {
    s: "pass",
    type: "Fetch",
    repo: "backend-api",
    cmd: "git fetch --all --prune",
    dur: "0.9s",
    time: "2 min ago",
    exit: 0,
    out: "From github.com/acme-inc/backend-api\n   a3f8c21..c90aa1e  main -> origin/main",
    prev: "—",
    next: "—",
  },
  {
    s: "pass",
    type: "Commit",
    repo: "backend-api",
    cmd: 'git commit -S -m "Rotate refresh tokens on use"',
    dur: "0.3s",
    time: "25 min ago",
    exit: 0,
    out: "[feature/auth-tokens e7c210f] Rotate refresh tokens on use\n 3 files changed, 64 insertions(+), 18 deletions(-)",
    prev: "b90d3a2",
    next: "e7c210f",
  },
  {
    s: "run",
    type: "Rebase",
    repo: "backend-api",
    cmd: "git rebase main",
    dur: "—",
    time: "in progress",
    exit: null,
    out: 'Stopped at 41c88d2… Refactor token refresh\nresolve conflicts, then run "git rebase --continue"',
    prev: "e7c210f",
    next: "(pending)",
  },
  {
    s: "pass",
    type: "Stash",
    repo: "dotfiles",
    cmd: 'git stash push -u -m "WIP: rate limiter spike"',
    dur: "0.2s",
    time: "1 d ago",
    exit: 0,
    out: "Saved working directory and index state on feature/rate-limits",
    prev: "—",
    next: "—",
  },
];

export const WS_REPOS: WorkspaceRepo[] = [
  {
    n: "backend-api",
    br: "feature/auth-tokens",
    dirty: 8,
    sync: "↑2 ↓1",
    pr: "#142",
    ci: "fail",
    prof: "Work",
    fetch: "2 min",
  },
  {
    n: "web-app",
    br: "main",
    dirty: 0,
    sync: "↓3",
    pr: "#87",
    ci: "pass",
    prof: "Work",
    fetch: "2 min",
  },
  {
    n: "admin-panel",
    br: "feature/auth-tokens",
    dirty: 2,
    sync: "↑1",
    pr: "",
    ci: "pass",
    prof: "Work",
    fetch: "1 h",
  },
  {
    n: "shared-packages",
    br: "main",
    dirty: 0,
    sync: "✓",
    pr: "",
    ci: "pass",
    prof: "Work",
    fetch: "2 min",
  },
];

export const UNPUSHED = [
  { sha: "e7c210f", msg: "Rotate refresh tokens on use", time: "25 min" },
  { sha: "b90d3a2", msg: "Add session revocation endpoint", time: "2 h" },
];

export const STASH_ROWS = [
  { id: "stash@{0}", msg: "WIP: rate limiter spike", time: "1 d" },
  { id: "stash@{1}", msg: "debug logging for auth", time: "4 d" },
];

export const WT_ROWS = [
  { branch: "feature/auth-tokens", dirty: true, temp: false, time: "now" },
  { branch: "pr-138-review", dirty: false, temp: true, time: "2 d" },
];

export const RECENT_BRANCHES = [
  { name: "feature/auth-tokens", sync: "↑2 ↓1", time: "now" },
  { name: "main", sync: "↓3", time: "1 d" },
  { name: "fix/session-leak", sync: "✓", time: "3 d" },
  { name: "feature/rate-limits", sync: "↑5", time: "1 w" },
];
