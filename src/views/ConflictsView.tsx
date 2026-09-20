import { useMemo, useState } from "react";
import { ConfirmActionModal } from "../components/ui/ConfirmActionModal";
import {
  useConflictVersions,
  useCurrentRepo,
  useGitAbort,
  useGitContinue,
  useMarkResolved,
  useResolveConflict,
  useStatus,
} from "../lib/hooks";
import { ConflictPane } from "../features/conflicts/ConflictPane";
import { OpenInEditor } from "../features/editor/OpenInEditor";
import { ConflictOperationBanner } from "../features/conflicts/ConflictOperationBanner";
import { ConflictFileList } from "../features/conflicts/ConflictFileList";
import { useOperationRunner } from "../lib/useOperationRunner";

export function ConflictsView() {
  const repo = useCurrentRepo();
  const run = useOperationRunner();
  const { data: status } = useStatus(repo?.path);
  const [selIdx, setSelIdx] = useState(0);

  const conflicted = useMemo(() => (status?.files ?? []).filter((f) => f.conflicted), [status]);
  const sel = conflicted[Math.min(selIdx, Math.max(0, conflicted.length - 1))];
  const { data: versions } = useConflictVersions(repo?.path, sel?.path);

  const resolve = useResolveConflict(repo?.path);
  const markResolved = useMarkResolved(repo?.path);
  const gitContinue = useGitContinue(repo?.path);
  const gitAbort = useGitAbort(repo?.path);
  const [confirmAbort, setConfirmAbort] = useState(false);

  const operation = status?.operation;
  const operationLabel = operation
    ? operation.charAt(0).toUpperCase() + operation.slice(1)
    : "Unmerged files";

  if (!status?.operation && conflicted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-[420px] text-center">
          <div className="mb-[10px] text-[26px] text-ok">✓</div>
          <div className="mb-[6px] text-[14px] font-semibold">No conflicts</div>
          <div className="text-[12.5px] text-tx2">
            No merge, rebase, cherry-pick, or revert is in progress and the working tree has no
            unmerged files. When git stops on conflicts, this screen shows each file's
            ours/theirs/result versions with one-click resolution.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConflictOperationBanner
        operation={operation}
        label={operationLabel}
        branch={status?.branch}
        remaining={conflicted.length}
        continueBusy={gitContinue.isPending}
        onContinue={() =>
          operation && void run(gitContinue.mutateAsync(operation), `${operation} continued`)
        }
        onAbort={() => setConfirmAbort(true)}
      />

      <div className="flex min-h-0 flex-1">
        <ConflictFileList
          files={conflicted}
          selectedPath={sel?.path}
          operation={operation}
          onSelect={setSelIdx}
        />

        {/* editor */}
        {sel ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-[34px] flex-none flex-wrap items-center gap-x-2 gap-y-[6px] border-b border-bd bg-panel px-[14px] py-[5px]">
              <span className="whitespace-nowrap font-mono text-[12px]">{sel.path}</span>
              <span className="flex-1" />
              {repo && <OpenInEditor repoPath={repo.path} file={sel.path} compact />}
              <button
                onClick={() =>
                  run(
                    resolve.mutateAsync({ file: sel.path, side: "ours" }),
                    `Took ours for ${sel.path}`,
                  )
                }
                className="btn-accent"
              >
                Accept ours
              </button>
              <button
                onClick={() =>
                  run(
                    resolve.mutateAsync({ file: sel.path, side: "theirs" }),
                    `Took theirs for ${sel.path}`,
                  )
                }
                className="btn-accent"
              >
                Accept theirs
              </button>
              <button
                title="Stage the file as it currently stands in your working tree (after editing it in your editor)"
                onClick={() =>
                  run(markResolved.mutateAsync(sel.path), `${sel.path} marked resolved`)
                }
                className="cursor-pointer rounded-[4px] border border-transparent bg-ac px-3 py-[2px] text-[11px] font-bold text-on-ac"
              >
                Mark resolved
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-2">
              <div className="grid min-h-0 grid-cols-2 border-b border-bd">
                <div className="min-h-0 border-r border-bd">
                  <ConflictPane
                    label="OURS"
                    labelColor="var(--actx)"
                    description={`${status?.branch ?? ""} — your side (:2)`}
                    text={versions?.ours ?? ""}
                  />
                </div>
                <ConflictPane
                  label="THEIRS"
                  labelColor="var(--inf)"
                  description="incoming side (:3)"
                  text={versions?.theirs ?? ""}
                />
              </div>
              <ConflictPane
                label="RESULT"
                labelColor="var(--tx)"
                description="working tree — edit in your editor, conflict markers highlighted"
                text={versions?.result ?? ""}
                trailing={
                  <>
                    <span className="flex-1" />
                    <span className="font-mono">base (:1) available via git show</span>
                  </>
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[12.5px] text-tx2">
            {operation
              ? `All files resolved — continue the ${operation} from the banner above.`
              : "All files resolved."}
          </div>
        )}
      </div>
      <ConfirmActionModal
        open={Boolean(operation && confirmAbort)}
        title={`Abort ${operation ?? "operation"}?`}
        description="Git will stop the active operation and restore the repository to its state before it began. Any conflict resolutions made during this operation will be discarded."
        confirmLabel={`Abort ${operation ?? "operation"}`}
        busy={gitAbort.isPending}
        onCancel={() => setConfirmAbort(false)}
        onConfirm={() => {
          if (!operation) return;
          setConfirmAbort(false);
          run(gitAbort.mutateAsync(operation), `${operation} aborted`);
        }}
      />
    </div>
  );
}
