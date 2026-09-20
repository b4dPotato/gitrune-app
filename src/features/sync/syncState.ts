import type { RepoStatus } from "../../lib/ipc";
import type { IconName } from "../../components/ui/Icon";

export interface SyncActionState {
  label: string;
  icon: IconName;
  disabled: boolean;
  visible: boolean;
  kind: "none" | "setup" | "publish" | "pull" | "push" | "pull-push";
  title: string;
}

export function hasActiveBranch(status?: RepoStatus): boolean {
  return !!status && !status.detached && !!status.branch && status.branch !== "(unborn)";
}

export function syncActionState(status?: RepoStatus, hasRemote = true): SyncActionState {
  if (!status)
    return {
      label: "Sync",
      icon: "sync",
      disabled: true,
      visible: false,
      kind: "none",
      title: "Repository status is loading",
    };
  if (!hasActiveBranch(status))
    return {
      label: "Sync",
      icon: "sync",
      disabled: true,
      visible: false,
      kind: "none",
      title: "Switch to a branch before syncing",
    };
  if (!hasRemote)
    return {
      label: "Set up remote",
      icon: "plus",
      disabled: false,
      visible: true,
      kind: "setup",
      title: "Add a Git remote URL to this repository",
    };
  if (!status.upstream)
    return {
      label: "Publish branch",
      icon: "publish",
      disabled: false,
      visible: true,
      kind: "publish",
      title: "Push this branch and configure its upstream",
    };
  if (status.behind > 0 && status.ahead > 0)
    return {
      label: "Pull and push",
      icon: "sync",
      disabled: false,
      visible: true,
      kind: "pull-push",
      title: "Rebase local commits onto the upstream branch, then push",
    };
  if (status.behind > 0)
    return {
      label: `Pull ${status.behind}`,
      icon: "pull",
      disabled: false,
      visible: true,
      kind: "pull",
      title: "Pull upstream commits with rebase",
    };
  if (status.ahead > 0)
    return {
      label: `Push ${status.ahead}`,
      icon: "push",
      disabled: false,
      visible: true,
      kind: "push",
      title: "Push local commits to the configured upstream",
    };
  return {
    label: "Up to date",
    icon: "check",
    disabled: true,
    visible: false,
    kind: "none",
    title: "Local and upstream branches match",
  };
}
