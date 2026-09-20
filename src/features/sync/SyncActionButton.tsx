import { ActionButton } from "../../components/ui/ActionButton";
import { useToast } from "../../components/Toast";
import { type RepoStatus } from "../../lib/ipc";
import { usePull, usePush, useRemotes } from "../../lib/hooks";
import { useDispatch, useSet } from "../../state/store";
import { syncActionState } from "./syncState";

export function SyncActionButton({
  repoPath,
  status,
  size = "md",
}: {
  repoPath?: string;
  status?: RepoStatus;
  size?: "sm" | "md";
}) {
  const toast = useToast();
  const dispatch = useDispatch();
  const set = useSet();
  const push = usePush(repoPath);
  const pull = usePull(repoPath);
  const { data: remotes = [] } = useRemotes(repoPath);
  const busy = push.isPending || pull.isPending;
  const remote = remotes.find((item) => item.isDefault) ?? remotes[0];

  const notifyFailure = (error: unknown) =>
    toast(error || "Git could not complete the sync action", "error");
  const execute = async () => {
    if (!repoPath || !status || busy) return;
    try {
      if (!remote) {
        dispatch({ type: "nav", view: "overview" });
        set({ remoteSetupRequest: Date.now() });
        return;
      }
      if (!status.upstream) {
        const result = await push.mutateAsync({
          setUpstream: true,
          branch: status.branch,
          remote: remote.name,
        });
        if (result.success) toast(`Published ${status.branch} to ${remote.name}`, "ok");
        else notifyFailure(result.stderr);
        return;
      }
      if (status.behind > 0) {
        const pulled = await pull.mutateAsync(true);
        if (!pulled.success) {
          notifyFailure(pulled.stderr);
          if (pulled.stderr.toLowerCase().includes("conflict"))
            dispatch({ type: "nav", view: "conflicts" });
          return;
        }
        if (status.ahead === 0) {
          toast("Pulled with rebase", "ok");
          return;
        }
      }
      if (status.ahead > 0) {
        const pushed = await push.mutateAsync({});
        if (pushed.success)
          toast(status.behind > 0 ? "Pulled with rebase and pushed" : "Pushed", "ok");
        else notifyFailure(pushed.stderr);
      }
    } catch (error) {
      notifyFailure(error);
    }
  };

  const state = syncActionState(status, remotes.length > 0);

  if (!state.visible) return null;

  return (
    <ActionButton
      icon={state.icon}
      variant="primary"
      size={size}
      title={state.title}
      disabled={state.disabled || busy}
      onClick={() => void execute()}
      className="whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55"
    >
      {busy ? "Working…" : state.label}
    </ActionButton>
  );
}
