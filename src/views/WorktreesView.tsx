import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/Toast";
import { EmptyState } from "../components/layout/EmptyState";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { ActionButton } from "../components/ui/ActionButton";
import { ConfirmActionModal } from "../components/ui/ConfirmActionModal";
import { OpenInEditor } from "../features/editor/OpenInEditor";
import { CreateWorktreeModal } from "../features/worktrees/CreateWorktreeModal";
import { ipc } from "../lib/ipc";
import {
  useCurrentRepo,
  useRefs,
  useWorktreeAdd,
  useWorktreeInfo,
  useWorktreePrune,
  useWorktreeRemove,
} from "../lib/hooks";
import { useOperationRunner } from "../lib/useOperationRunner";

export function WorktreesView() {
  const { t } = useTranslation();
  const repo = useCurrentRepo();
  const toast = useToast();
  const run = useOperationRunner();
  const { data: worktrees = [] } = useWorktreeInfo(repo?.path);
  const { data: refs = [] } = useRefs(repo?.path);
  const add = useWorktreeAdd(repo?.path);
  const remove = useWorktreeRemove(repo?.path);
  const prune = useWorktreePrune(repo?.path);
  const [createOpen, setCreateOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ path: string; dirty: number } | null>(null);
  const [confirmPrune, setConfirmPrune] = useState(false);

  const create = async (value: { wtPath: string; branch: string; create: boolean }) => {
    if (await run(add.mutateAsync(value), `Worktree created at ${value.wtPath}`)) {
      setCreateOpen(false);
    }
  };

  const mainPath = worktrees[0]?.path;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        meta={t("worktrees.count", { count: worktrees.length })}
        actions={
          <>
            <ActionButton icon="trash" variant="danger" onClick={() => setConfirmPrune(true)}>
              Prune stale metadata
            </ActionButton>
            <ActionButton icon="plus" variant="primary" onClick={() => setCreateOpen(true)}>
              Create worktree
            </ActionButton>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto px-[14px] py-3">
        <div className="card">
          {worktrees.map((worktree) => {
            const main = worktree.path === mainPath;
            return (
              <div
                key={worktree.path}
                className="flex min-h-12 items-center gap-3 border-b border-bd px-[14px] py-1.5 hover:bg-hov"
              >
                <span className="text-tx3">⧉</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-[12px]">{worktree.path}</span>
                    {main && (
                      <span className="rounded border border-bd2 px-1 text-[10px] text-tx3">
                        main
                      </span>
                    )}
                    {worktree.locked && (
                      <span className="rounded bg-wnbg px-1 text-[10px] text-wn">locked</span>
                    )}
                    {worktree.prunable && (
                      <span className="rounded bg-erbg px-1 text-[10px] text-er">prunable</span>
                    )}
                  </div>
                  <div className="text-[11px] text-tx3">
                    {worktree.detached
                      ? `detached @ ${worktree.head.slice(0, 10)}`
                      : `⎇ ${worktree.branch}`}
                    {worktree.dirty > 0 && (
                      <span className="ml-2 text-wn">● {worktree.dirty} dirty</span>
                    )}
                  </div>
                </div>
                <OpenInEditor repoPath={worktree.path} compact />
                <ActionButton
                  icon="terminal"
                  size="sm"
                  onClick={() =>
                    ipc.openPath(worktree.path, "terminal").catch((error) => toast(error, "error"))
                  }
                >
                  Terminal
                </ActionButton>
                {!main && (
                  <ActionButton
                    icon="trash"
                    size="sm"
                    variant="danger"
                    onClick={() => setRemoveTarget({ path: worktree.path, dirty: worktree.dirty })}
                  >
                    Remove
                  </ActionButton>
                )}
              </div>
            );
          })}
          {worktrees.length === 0 && <EmptyState>{t("worktrees.empty")}</EmptyState>}
        </div>
      </div>
      <ConfirmActionModal
        open={!!removeTarget}
        title={removeTarget?.dirty ? "Force-remove dirty worktree?" : "Remove worktree?"}
        description={
          removeTarget?.dirty
            ? `This worktree has ${removeTarget.dirty} uncommitted change(s). Force removal permanently deletes its working directory changes.`
            : "The clean linked worktree directory and Git worktree registration will be removed."
        }
        command={
          removeTarget
            ? `git worktree remove ${removeTarget.dirty ? "--force " : ""}${removeTarget.path}`
            : undefined
        }
        confirmLabel={removeTarget?.dirty ? "Force-remove worktree" : "Remove worktree"}
        busy={remove.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          const target = removeTarget;
          setRemoveTarget(null);
          void run(
            remove.mutateAsync({ wtPath: target.path, force: target.dirty > 0 }),
            target.dirty ? "Worktree force-removed" : "Worktree removed",
          );
        }}
      />
      <ConfirmActionModal
        open={confirmPrune}
        title="Prune stale worktree metadata?"
        description="Git will remove administrative records for worktrees whose directories are already missing. Existing worktree directories are not deleted."
        command="git worktree prune"
        confirmLabel="Prune metadata"
        busy={prune.isPending}
        onCancel={() => setConfirmPrune(false)}
        onConfirm={() => {
          setConfirmPrune(false);
          void run(prune.mutateAsync(undefined), "Pruned stale worktree metadata");
        }}
      />
      {repo && (
        <CreateWorktreeModal
          open={createOpen}
          repoPath={repo.path}
          localBranches={refs.filter((ref) => ref.kind === "local").map((ref) => ref.name)}
          busy={add.isPending}
          onCancel={() => setCreateOpen(false)}
          onCreate={(value) => void create(value)}
        />
      )}
    </div>
  );
}
