import { useState, type FormEvent } from "react";
import { useCreateBranch } from "../../lib/hooks";
import { ActionButton } from "../../components/ui/ActionButton";
import { ValidatedRefInput, validateGitRefName } from "../../components/ValidatedRefInput";
import { useOperationRunner } from "../../lib/useOperationRunner";

export function NewBranchModal({
  open,
  repoPath,
  at,
  onClose,
}: {
  open: boolean;
  repoPath?: string;
  at?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);
  const create = useCreateBranch(repoPath);
  const run = useOperationRunner();
  if (!open) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || validateGitRefName(name)) return;
    if (
      await run(create.mutateAsync({ name: name.trim(), checkout, at }), `Created ${name.trim()}`)
    ) {
      setName("");
      onClose();
    }
  };
  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/45"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="New branch"
        className="w-[430px] max-w-[92vw] rounded-lg border border-bd2 bg-panel shadow-xl"
      >
        <div className="border-b border-bd px-4 py-3 text-[14px] font-bold">New branch</div>
        <div className="space-y-3 px-4 py-4">
          <label className="block text-[11px] font-bold text-tx3">BRANCH NAME</label>
          <ValidatedRefInput
            autoFocus
            value={name}
            onChange={setName}
            placeholder="feature/my-change"
          />
          <label className="flex items-center gap-2 text-[12px] text-tx2">
            <input
              type="checkbox"
              checked={checkout}
              onChange={(event) => setCheckout(event.target.checked)}
              className="accent-ac"
            />
            Switch to the new branch after creation
          </label>
          {at && (
            <div className="text-[11px] text-tx3">
              Starting at <span className="font-mono text-tx2">{at}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <ActionButton type="button" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            icon="branch"
            variant="primary"
            disabled={create.isPending || !!validateGitRefName(name)}
          >
            Create branch
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
