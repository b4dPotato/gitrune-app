import { useState } from "react";
import { useStashApply, useStashDrop, useStashPop } from "../../lib/hooks";
import { ActionButton } from "../../components/ui/ActionButton";
import { ConfirmActionModal } from "../../components/ui/ConfirmActionModal";
import { useOperationRunner } from "../../lib/useOperationRunner";

export function StashActions({
  repoPath,
  index,
  stashId,
}: {
  repoPath?: string;
  index: number;
  stashId: string;
}) {
  const apply = useStashApply(repoPath);
  const pop = useStashPop(repoPath);
  const drop = useStashDrop(repoPath);
  const run = useOperationRunner();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <ActionButton
        icon="apply"
        size="sm"
        variant="primary"
        onClick={() => void run(apply.mutateAsync(index), "Stash applied and kept")}
      >
        Apply stash
      </ActionButton>
      <ActionButton
        icon="pop"
        size="sm"
        onClick={() => void run(pop.mutateAsync(index), "Stash applied and removed")}
      >
        Pop stash
      </ActionButton>
      <ActionButton icon="trash" size="sm" variant="danger" onClick={() => setConfirm(true)}>
        Drop stash
      </ActionButton>
      <ConfirmActionModal
        open={confirm}
        title={`Drop ${stashId}?`}
        description="This permanently removes the stash entry. Its changes cannot be recovered by Gitrune after Git prunes the object."
        command={`git stash drop ${stashId}`}
        confirmLabel="Drop stash"
        busy={drop.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void run(drop.mutateAsync(index), "Stash dropped");
        }}
      />
    </>
  );
}
