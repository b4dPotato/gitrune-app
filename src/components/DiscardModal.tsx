import { useState } from "react";
import { ErrorNotice } from "./ErrorNotice";
import { operationError } from "../lib/ipc";
import { useCurrentRepo, useDiff, useDiscard, useStatus } from "../lib/hooks";
import { useApp, useSet } from "../state/store";

/** Destructive-action pattern: the modal lists exactly what would be lost,
 * shows the equivalent git command, and notes the recovery checkpoint. */
export function DiscardModal() {
  const s = useApp();
  const set = useSet();
  const repo = useCurrentRepo();
  const { data: status } = useStatus(repo?.path);
  const discard = useDiscard(repo?.path);
  const [error, setError] = useState<unknown>(null);

  const sel = (status?.files ?? []).find(
    (f) => f.path === s.discardPath && !f.staged && !f.conflicted,
  );
  const { data: diff } = useDiff(repo?.path, sel?.path, false);

  const close = () => set({ discardOpen: false, discardPath: null });
  if (!sel) {
    return null;
  }

  const doDiscard = async () => {
    setError(null);
    try {
      const result = await discard.mutateAsync([sel.path]);
      if (!result.success) {
        setError(operationError(result, "Git could not discard this file"));
        return;
      }
      close();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Discard changes"
        className="w-[480px] max-w-[90vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-[0_16px_48px_rgba(0,0,0,.4)]"
      >
        <div className="flex items-center gap-[9px] px-4 pb-1 pt-[14px]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-erbg font-bold text-er">
            !
          </span>
          <span className="text-[14px] font-bold">Discard changes to 1 file?</span>
        </div>
        <div className="px-4 py-[10px] text-[12.5px] text-tx2">
          This permanently removes uncommitted edits from your working tree:
          <div className="my-[10px] flex items-center gap-2 rounded border border-bd bg-bg px-[10px] py-2 font-mono text-[12px]">
            <span className="font-bold text-wn">{sel.st}</span> {sel.path}
            <span className="flex-1" />
            <span className="text-tx3">
              +{diff?.add ?? "…"} −{diff?.del ?? "…"} lines
            </span>
          </div>
          {sel.untracked ? (
            <>The file is copied to the app recovery store before it is removed.</>
          ) : (
            <>
              Runs <span className="font-mono text-tx">git restore -- {sel.path}</span>.
            </>
          )}
          <br />
          <span className="text-actx">
            A recoverable entry is recorded in the Operation Log first.
          </span>
          <div className="mt-3">
            <ErrorNotice error={error} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <button
            onClick={close}
            className="cursor-pointer rounded border border-bd2 bg-transparent px-[14px] py-[5px] text-[12.5px] text-tx hover:bg-hov"
          >
            Cancel
          </button>
          <button
            onClick={doDiscard}
            disabled={discard.isPending}
            className="cursor-pointer rounded border border-transparent bg-er px-[14px] py-[5px] text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {discard.isPending
              ? "Discarding…"
              : `Discard ${(diff?.add ?? 0) + (diff?.del ?? 0)} lines`}
          </button>
        </div>
      </div>
    </div>
  );
}
