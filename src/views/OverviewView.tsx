import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../components/Toast";
import { ConfirmActionModal } from "../components/ui/ConfirmActionModal";
import { RemoteSetupCard } from "../features/remotes/RemoteSetupCard";
import { RepositoryOverviewCards } from "../features/repositories/RepositoryOverviewCards";
import { RepositoryOverviewHeader } from "../features/repositories/RepositoryOverviewHeader";
import { useIdentity, usePull, useRefs, useRemotes, useRemoveRepo, useStashes } from "../lib/hooks";
import { ipc, type RepoRecord, type RepoStatus } from "../lib/ipc";
import { useApp, useDispatch } from "../state/store";
import { useOperationRunner } from "../lib/useOperationRunner";

export function OverviewView({
  repo,
  status,
}: {
  repo: RepoRecord | undefined;
  status: RepoStatus | undefined;
}) {
  const dispatch = useDispatch();
  const app = useApp();
  const toast = useToast();
  const run = useOperationRunner();
  const { data: refs = [] } = useRefs(repo?.path);
  const { data: remotes = [], isLoading: remotesLoading } = useRemotes(repo?.path);
  const { data: identity } = useIdentity(repo?.path);
  const { data: stashes = [] } = useStashes(repo?.path);
  const pull = usePull(repo?.path);
  const removeRepo = useRemoveRepo();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { data: syncCommits } = useQuery({
    queryKey: [
      "syncCommits",
      repo?.path,
      status?.upstream,
      status?.branch,
      status?.ahead,
      status?.behind,
    ],
    queryFn: async () => {
      const [outgoing, incoming] = await Promise.all([
        ipc.compareCommits(repo!.path, status!.upstream!, "HEAD"),
        ipc.compareCommits(repo!.path, "HEAD", status!.upstream!),
      ]);
      return { outgoing: outgoing.commits, incoming: incoming.commits };
    },
    enabled:
      !!repo && !!status?.upstream && ((status?.ahead ?? 0) > 0 || (status?.behind ?? 0) > 0),
  });

  const localBranches = refs.filter((ref) => ref.kind === "local").slice(0, 4);
  const hasRemote = remotes.length > 0;
  const runPullMerge = async () => {
    await run(pull.mutateAsync(false), "Pulled with merge");
  };

  return (
    <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
      <RepositoryOverviewHeader
        repo={repo}
        status={status}
        hasRemote={hasRemote}
        onOpenTerminal={() =>
          repo && ipc.openPath(repo.path, "terminal").catch((error) => toast(error, "error"))
        }
        onRemove={() => setConfirmRemove(true)}
      />
      {repo && !remotesLoading && !hasRemote && (
        <div className="mb-3">
          <RemoteSetupCard
            repoPath={repo.path}
            identity={identity}
            focusRequest={app.remoteSetupRequest}
          />
        </div>
      )}
      <RepositoryOverviewCards
        repoPath={repo?.path}
        status={status}
        hasRemote={hasRemote}
        localBranches={localBranches}
        stashes={stashes}
        syncCommits={syncCommits}
        pulling={pull.isPending}
        onPullMerge={() => void runPullMerge()}
        onNavigate={(view) => dispatch({ type: "nav", view })}
      />
      {repo && (
        <ConfirmActionModal
          open={confirmRemove}
          title={`Remove ${repo.name} from Gitrune?`}
          description="This unregisters the repository from the app. Files and Git history remain untouched on disk."
          confirmLabel="Remove repository"
          busy={removeRepo.isPending}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            removeRepo.mutate({ id: repo.id, path: repo.path });
            toast(`${repo.name} removed from the app — files untouched`, "ok");
          }}
        />
      )}
    </div>
  );
}
