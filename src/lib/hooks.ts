/** Data hooks: TanStack Query over the typed IPC boundary. */
import {
  useMutation,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ipc,
  onOperationProgress,
  onRepoChanged,
  type GraphFilters,
  type IdentityProfile,
  type OpResult,
  type OperationProgress,
  type RepoRecord,
} from "./ipc";
import { parseDiff, parseLog, parseRefs, parseStashList } from "./gitparse";
import { parseWorktrees } from "./worktreeparse";
import { useApp } from "../state/store";
import { GRAPH_PAGE_SIZE, MAX_GRAPH_PAGES } from "./limits";
import { repositoryChangeQueryMatches, repositoryQueryMatches } from "./queryScope";

export function useRepos() {
  return useQuery({ queryKey: ["repos"], queryFn: ipc.listRepos });
}

/** Currently selected repository record (falls back to the first). */
export function useCurrentRepo(): RepoRecord | undefined {
  const s = useApp();
  const { data: repos } = useRepos();
  if (!repos || repos.length === 0) return undefined;
  return repos[Math.min(s.repo, repos.length - 1)];
}

export function useStatus(path: string | undefined) {
  return useQuery({
    queryKey: ["status", path],
    queryFn: () => ipc.repoStatus(path!),
    enabled: !!path,
    refetchInterval: 30_000,
  });
}

export function useIdentity(path: string | undefined) {
  return useQuery({
    queryKey: ["identity", path],
    queryFn: () => ipc.getIdentity(path!),
    enabled: !!path,
    staleTime: 60_000,
  });
}

export function useIdentityDetails(path: string | undefined) {
  return useQuery({
    queryKey: ["identityDetails", path],
    queryFn: () => ipc.identityDetails(path!),
    enabled: !!path,
  });
}

export function useIdentityProfiles() {
  return useQuery({ queryKey: ["identityProfiles"], queryFn: ipc.listIdentityProfiles });
}

export function useSshHosts() {
  return useQuery({ queryKey: ["sshHosts"], queryFn: ipc.listSshHosts, staleTime: 60_000 });
}

export function useCommitTemplate(path: string | undefined) {
  return useQuery({
    queryKey: ["commitTemplate", path],
    queryFn: () => ipc.getCommitTemplate(path!),
    enabled: !!path,
    staleTime: 30_000,
  });
}

export function useRefs(path: string | undefined) {
  return useQuery({
    queryKey: ["refs", path],
    queryFn: async () =>
      parseRefs(await ipc.listRefs(path!)).sort(
        (left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
      ),
    enabled: !!path,
  });
}

export function useLog(path: string | undefined, limit: number) {
  return useQuery({
    queryKey: ["log", path, limit],
    queryFn: async () => parseLog(await ipc.commitLog(path!, 0, limit)),
    enabled: !!path,
    placeholderData: (prev) => prev,
  });
}

export function useGraphPages(path: string | undefined, filters: GraphFilters) {
  return useInfiniteQuery({
    queryKey: ["graphPages", path, filters],
    queryFn: ({ pageParam }) => ipc.commitPage(path!, pageParam, GRAPH_PAGE_SIZE, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (last, pages) =>
      pages.length >= MAX_GRAPH_PAGES ? undefined : (last.nextCursor ?? undefined),
    enabled: !!path,
    gcTime: 2 * 60_000,
  });
}

export function useRemotes(path: string | undefined) {
  return useQuery({
    queryKey: ["remotes", path],
    queryFn: () => ipc.listRemotes(path!),
    enabled: !!path,
  });
}

export function useTags(path: string | undefined) {
  return useQuery({
    queryKey: ["tags", path],
    queryFn: () => ipc.listTags(path!),
    enabled: !!path,
  });
}

export function useRecoveries(path: string | undefined) {
  return useQuery({
    queryKey: ["recoveries", path],
    queryFn: () => ipc.listRecoveries(path),
    enabled: !!path,
  });
}

export function useCommitInfo(path: string | undefined, sha: string | null) {
  return useQuery({
    queryKey: ["commitInfo", path, sha],
    queryFn: async () => parseLog(await ipc.commitInfo(path!, sha!))[0],
    enabled: !!path && !!sha,
  });
}

export function useDiff(path: string | undefined, file: string | undefined, staged: boolean) {
  return useQuery({
    queryKey: ["diff", path, file, staged],
    queryFn: async () => parseDiff(await ipc.diffFile(path!, file!, staged)),
    enabled: !!path && !!file,
  });
}

export function useStashes(path: string | undefined) {
  return useQuery({
    queryKey: ["stashes", path],
    queryFn: async () => parseStashList(await ipc.stashList(path!)),
    enabled: !!path,
  });
}

export function useStashDetail(path: string | undefined, index: number | null) {
  return useQuery({
    queryKey: ["stashDetail", path, index],
    queryFn: () => ipc.stashDetail(path!, index!),
    enabled: !!path && index !== null,
  });
}

export function useWorktrees(path: string | undefined) {
  return useQuery({
    queryKey: ["worktrees", path],
    queryFn: async () => parseWorktrees(await ipc.worktreeList(path!)),
    enabled: !!path,
  });
}

export function useWorktreeInfo(path: string | undefined) {
  return useQuery({
    queryKey: ["worktreeInfo", path],
    queryFn: () => ipc.listWorktreeInfo(path!),
    enabled: !!path,
  });
}

export function useConflictVersions(path: string | undefined, file: string | undefined) {
  return useQuery({
    queryKey: ["conflict", path, file],
    queryFn: () => ipc.conflictVersions(path!, file!),
    enabled: !!path && !!file,
  });
}

export function useOpLog() {
  return useQuery({ queryKey: ["oplog"], queryFn: ipc.operationLog, refetchInterval: 15_000 });
}

/** Invalidate only cached data owned by the affected repository. */
export function useInvalidateRepo() {
  const qc = useQueryClient();
  return (path?: string) => {
    qc.invalidateQueries({
      predicate: (query) => repositoryQueryMatches(query.queryKey, path),
    });
  };
}

export function useOperationEvents(onProgress: (progress: OperationProgress) => void) {
  useEffect(() => {
    let un: (() => void) | undefined;
    onOperationProgress(onProgress).then((value) => (un = value));
    return () => un?.();
  }, [onProgress]);
}

/** Wire the backend file watcher into query invalidation (App-level). */
export function useWatcherEvents(path?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    let un: (() => void) | undefined;
    if (path) void ipc.watchRepo(path);
    onRepoChanged((change) =>
      qc.invalidateQueries({
        predicate: (query) =>
          repositoryChangeQueryMatches(query.queryKey, change.path, change.scope),
      }),
    ).then((u) => (un = u));
    return () => un?.();
  }, [path, qc]);
}

type Mut<A> = UseMutationResult<OpResult, unknown, A, unknown>;

function useRepoMutation<A>(path: string | undefined, fn: (args: A) => Promise<OpResult>): Mut<A> {
  const invalidate = useInvalidateRepo();
  return useMutation({
    mutationFn: fn,
    onSettled: () => invalidate(path),
  });
}

export const useStage = (path: string | undefined) =>
  useRepoMutation(path, (files: string[]) => ipc.stageFiles(path!, files));
export const useUnstage = (path: string | undefined) =>
  useRepoMutation(path, (files: string[]) => ipc.unstageFiles(path!, files));
export const useDiscard = (path: string | undefined) =>
  useRepoMutation(path, (files: string[]) => ipc.discardFiles(path!, files));
export const useApplyPatch = (path: string | undefined) =>
  useRepoMutation(path, ({ patch, reverse }: { patch: string; reverse: boolean }) =>
    ipc.applyPatch(path!, patch, reverse),
  );
export const useCommit = (path: string | undefined) =>
  useRepoMutation(
    path,
    ({
      message,
      amend,
      sign,
      allowPublishedAmend = false,
    }: {
      message: string;
      amend: boolean;
      sign: boolean;
      allowPublishedAmend?: boolean;
    }) => ipc.commit(path!, message, amend, sign, allowPublishedAmend),
  );
export const useUndoCommit = (path: string | undefined) =>
  useRepoMutation(path, ({ allowPublished = false }: { allowPublished?: boolean }) =>
    ipc.undoLastCommit(path!, allowPublished),
  );
export const useFetchRepo = (path: string | undefined) =>
  useRepoMutation(path, (_: void) => ipc.fetch(path!));
export const usePull = (path: string | undefined) =>
  useRepoMutation(path, (rebase: boolean) => ipc.pull(path!, rebase));
export const usePush = (path: string | undefined) =>
  useRepoMutation(
    path,
    ({
      setUpstream = false,
      forceWithLease = false,
      branch,
      remote,
    }: {
      setUpstream?: boolean;
      forceWithLease?: boolean;
      branch?: string;
      remote?: string;
    }) => ipc.push(path!, setUpstream, forceWithLease, branch, remote),
  );
export const useCheckout = (path: string | undefined) =>
  useRepoMutation(path, (name: string) => ipc.checkoutBranch(path!, name));
export const useRenameBranch = (path: string | undefined) =>
  useRepoMutation(path, ({ oldName, newName }: { oldName: string; newName: string }) =>
    ipc.renameBranch(path!, oldName, newName),
  );
export const useCreateBranch = (path: string | undefined) =>
  useRepoMutation(
    path,
    ({ name, checkout, at }: { name: string; checkout: boolean; at?: string }) =>
      ipc.createBranch(path!, name, checkout, at),
  );
export const useDeleteBranch = (path: string | undefined) =>
  useRepoMutation(path, ({ name, force }: { name: string; force: boolean }) =>
    ipc.deleteBranch(path!, name, force),
  );
export const useMergeBranch = (path: string | undefined) =>
  useRepoMutation(path, (name: string) => ipc.mergeBranch(path!, name));
export const useRebaseBranch = (path: string | undefined) =>
  useRepoMutation(path, (name: string) => ipc.rebaseBranch(path!, name));
export const useCherryPick = (path: string | undefined) =>
  useRepoMutation(path, (sha: string) => ipc.cherryPick(path!, sha));
export const useRevertCommit = (path: string | undefined) =>
  useRepoMutation(path, (sha: string) => ipc.revertCommit(path!, sha));
export const useCreateTag = (path: string | undefined) =>
  useRepoMutation(path, ({ name, sha }: { name: string; sha: string }) =>
    ipc.createTag(path!, name, sha),
  );
export const useGitContinue = (path: string | undefined) =>
  useRepoMutation(path, (operation: string) => ipc.gitContinue(path!, operation));
export const useGitAbort = (path: string | undefined) =>
  useRepoMutation(path, (operation: string) => ipc.gitAbort(path!, operation));
export const useResolveConflict = (path: string | undefined) =>
  useRepoMutation(path, ({ file, side }: { file: string; side: "ours" | "theirs" }) =>
    ipc.resolveConflict(path!, file, side),
  );
export const useMarkResolved = (path: string | undefined) =>
  useRepoMutation(path, (file: string) => ipc.markResolved(path!, file));
export const useWorktreeAdd = (path: string | undefined) =>
  useRepoMutation(
    path,
    ({ wtPath, branch, create }: { wtPath: string; branch: string; create: boolean }) =>
      ipc.worktreeAdd(path!, wtPath, branch, create),
  );
export const useWorktreeRemove = (path: string | undefined) =>
  useRepoMutation(path, ({ wtPath, force }: { wtPath: string; force: boolean }) =>
    ipc.worktreeRemove(path!, wtPath, force),
  );
export const useWorktreePrune = (path: string | undefined) =>
  useRepoMutation(path, (_: void) => ipc.worktreePrune(path!));
export const useStashPush = (path: string | undefined) =>
  useRepoMutation(
    path,
    ({ message, includeUntracked }: { message: string; includeUntracked: boolean }) =>
      ipc.stashPush(path!, message, includeUntracked),
  );
export const useStashApply = (path: string | undefined) =>
  useRepoMutation(path, (index: number) => ipc.stashApply(path!, index));
export const useStashDrop = (path: string | undefined) =>
  useRepoMutation(path, (index: number) => ipc.stashDrop(path!, index));
export const useStashPop = (path: string | undefined) =>
  useRepoMutation(path, (index: number) => ipc.stashPop(path!, index));
export const useStashBranch = (path: string | undefined) =>
  useRepoMutation(path, ({ index, branch }: { index: number; branch: string }) =>
    ipc.stashBranch(path!, index, branch),
  );
export const useRestoreRecovery = (path: string | undefined) =>
  useRepoMutation(path, (id: number) => ipc.restoreRecovery(id));
export const useAddRemote = (path: string | undefined) =>
  useRepoMutation(path, ({ name, url }: { name: string; url: string }) =>
    ipc.addRemote(path!, name, url),
  );
export const useUpdateRemote = (path: string | undefined) =>
  useRepoMutation(path, ({ name, url }: { name: string; url: string }) =>
    ipc.updateRemote(path!, name, url),
  );
export const useRemoveRemote = (path: string | undefined) =>
  useRepoMutation(path, (name: string) => ipc.removeRemote(path!, name));
export const useSelectDefaultRemote = (path: string | undefined) =>
  useRepoMutation(path, (name: string) => ipc.selectDefaultRemote(path!, name));
export const useFetchRemote = (path: string | undefined) =>
  useRepoMutation(path, (remote?: string) => ipc.fetchRemote(path!, remote));
export const useSetUpstream = (path: string | undefined) =>
  useRepoMutation(
    path,
    ({ branch, remote, remoteBranch }: { branch: string; remote: string; remoteBranch: string }) =>
      ipc.setUpstream(path!, branch, remote, remoteBranch),
  );
export const useUnsetUpstream = (path: string | undefined) =>
  useRepoMutation(path, (branch: string) => ipc.unsetUpstream(path!, branch));
export const useCheckoutRemote = (path: string | undefined) =>
  useRepoMutation(path, ({ remoteRef, localName }: { remoteRef: string; localName: string }) =>
    ipc.checkoutRemoteBranch(path!, remoteRef, localName),
  );
export const useCreateAdvancedTag = (path: string | undefined) =>
  useRepoMutation(path, ({ name, sha, message }: { name: string; sha: string; message?: string }) =>
    ipc.createTagAdvanced(path!, name, sha, message),
  );
export const usePushTag = (path: string | undefined) =>
  useRepoMutation(path, ({ remote, name }: { remote: string; name: string }) =>
    ipc.pushTag(path!, remote, name),
  );
export const useDeleteTag = (path: string | undefined) =>
  useRepoMutation(path, ({ name, remote }: { name: string; remote?: string }) =>
    ipc.deleteTag(path!, name, remote),
  );

export function useSaveIdentityProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: IdentityProfile) => ipc.saveIdentityProfile(profile),
    onSettled: () => qc.invalidateQueries({ queryKey: ["identityProfiles"] }),
  });
}

export function useDeleteIdentityProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteIdentityProfile(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["identityProfiles"] }),
  });
}

export const useApplyIdentityProfile = (path: string | undefined) =>
  useRepoMutation(path, (id: number) => ipc.applyIdentityProfile(path!, id));
export const useClearRepositoryIdentity = (path: string | undefined) =>
  useRepoMutation(path, (_: void) => ipc.clearRepositoryIdentity(path!));
export const useApplyProfileSshHost = (path: string | undefined) =>
  useRepoMutation(path, ({ id, remote }: { id: number; remote: string }) =>
    ipc.applyProfileSshHost(path!, id, remote),
  );

export function useAddRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, color }: { path: string; color?: string }) => ipc.addRepo(path, color),
    onSettled: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export function useRemoveRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path }: { id: number; path: string }) => ipc.removeRepo(id, path),
    onSettled: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export function useUpdateRepoColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, color }: { id: number; color: string }) => ipc.updateRepoColor(id, color),
    onSettled: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export function useCloneRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, parentDir }: { url: string; parentDir: string }) =>
      ipc.cloneRepo(url, parentDir),
    onSettled: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}

export function useInitRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dir: string) => ipc.initRepo(dir),
    onSettled: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });
}
