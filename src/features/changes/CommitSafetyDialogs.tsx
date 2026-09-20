import type { UndoCommitPreview } from "../../lib/ipc";
import { ConfirmActionModal } from "../../components/ui/ConfirmActionModal";

export function CommitSafetyDialogs({
  undoPreview,
  amendPreview,
  undoBusy,
  amendBusy,
  onCancelUndo,
  onConfirmUndo,
  onCancelAmend,
  onConfirmAmend,
}: {
  undoPreview: UndoCommitPreview | null;
  amendPreview: UndoCommitPreview | null;
  undoBusy: boolean;
  amendBusy: boolean;
  onCancelUndo: () => void;
  onConfirmUndo: () => void;
  onCancelAmend: () => void;
  onConfirmAmend: () => void;
}) {
  return (
    <>
      <ConfirmActionModal
        open={!!undoPreview}
        title={undoPreview?.published ? "Undo a published commit?" : "Undo the last commit?"}
        description={
          undoPreview?.published
            ? `This commit is present on ${undoPreview.remoteRefs.join(", ")}. The local branch will diverge and a later push will require an explicit history-rewrite decision.`
            : "The commit will be removed locally. Its changes remain staged and can be recommitted."
        }
        command={undoPreview?.command}
        confirmLabel="Undo commit"
        busy={undoBusy}
        onCancel={onCancelUndo}
        onConfirm={onConfirmUndo}
      >
        {undoPreview && (
          <div className="mt-2 font-mono text-[11px] text-tx3">
            {undoPreview.sha.slice(0, 12)} {undoPreview.subject}
          </div>
        )}
      </ConfirmActionModal>
      <ConfirmActionModal
        open={!!amendPreview}
        title="Amend a published commit?"
        description={`This commit is present on ${amendPreview?.remoteRefs.join(", ")}. Amending replaces it with a new commit and the remote will no longer match.`}
        command="git commit --amend"
        confirmLabel="Amend published commit"
        busy={amendBusy}
        onCancel={onCancelAmend}
        onConfirm={onConfirmAmend}
      />
    </>
  );
}
