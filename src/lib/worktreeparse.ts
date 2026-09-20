/** Parser for `git worktree list --porcelain` output. */

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  prunable: boolean;
  main: boolean;
}

export function parseWorktrees(raw: string): WorktreeInfo[] {
  const out: WorktreeInfo[] = [];
  let cur: Partial<WorktreeInfo> | null = null;

  const flush = () => {
    if (cur && cur.path) {
      out.push({
        path: cur.path,
        head: cur.head ?? "",
        branch: cur.branch ?? "",
        detached: cur.detached ?? false,
        bare: cur.bare ?? false,
        locked: cur.locked ?? false,
        prunable: cur.prunable ?? false,
        main: out.length === 0, // first entry is always the main worktree
      });
    }
    cur = null;
  };

  for (const line of raw.split("\n")) {
    const l = line.trimEnd();
    if (l === "") {
      flush();
      continue;
    }
    if (l.startsWith("worktree ")) {
      flush();
      cur = { path: l.slice(9) };
    } else if (!cur) {
      continue;
    } else if (l.startsWith("HEAD ")) {
      cur.head = l.slice(5, 12);
    } else if (l.startsWith("branch ")) {
      cur.branch = l.slice(7).replace(/^refs\/heads\//, "");
    } else if (l === "detached") {
      cur.detached = true;
    } else if (l === "bare") {
      cur.bare = true;
    } else if (l.startsWith("locked")) {
      cur.locked = true;
    } else if (l.startsWith("prunable")) {
      cur.prunable = true;
    }
  }
  flush();
  return out;
}
