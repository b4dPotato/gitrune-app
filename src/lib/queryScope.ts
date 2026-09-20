import type { QueryKey } from "@tanstack/react-query";

const REPOSITORY_QUERY_ROOTS = new Set([
  "status",
  "refs",
  "log",
  "graphPages",
  "commitInfo",
  "commitFiles",
  "commitFileDiff",
  "compareFileDiff",
  "syncCommits",
  "outgoingCommits",
  "diff",
  "stashes",
  "stashDetail",
  "worktrees",
  "worktreeInfo",
  "conflict",
  "remotes",
  "tags",
  "recoveries",
  "identity",
  "identityDetails",
  "commitTemplate",
]);

const WORKTREE_QUERY_ROOTS = new Set(["status", "diff", "conflict"]);

export function repositoryQueryMatches(queryKey: QueryKey, path?: string) {
  const [root, queryPath] = queryKey;
  if (root === "oplog") return true;
  if (typeof root !== "string" || !REPOSITORY_QUERY_ROOTS.has(root)) return false;
  return path === undefined || queryPath === path;
}

export function repositoryChangeQueryMatches(
  queryKey: QueryKey,
  path: string,
  scope: "workingTree" | "repository",
) {
  if (scope === "repository") return repositoryQueryMatches(queryKey, path);
  const [root, queryPath] = queryKey;
  return typeof root === "string" && WORKTREE_QUERY_ROOTS.has(root) && queryPath === path;
}
