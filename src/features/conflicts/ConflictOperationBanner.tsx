import { ActionButton } from "../../components/ui/ActionButton";

export function ConflictOperationBanner({
  operation,
  label,
  branch,
  remaining,
  continueBusy,
  onContinue,
  onAbort,
}: {
  operation: string | null | undefined;
  label: string;
  branch?: string;
  remaining: number;
  continueBusy: boolean;
  onContinue: () => void;
  onAbort: () => void;
}) {
  return (
    <div className="flex flex-none items-center gap-3 border-b border-bd bg-wnbg px-4 py-[9px]">
      <span className="text-[12.5px] font-bold text-wn">
        ⚠ {operation ? `${label} in progress` : label}
      </span>
      <span className="text-[12px] text-tx2">
        {remaining} conflicted {remaining === 1 ? "file" : "files"} remaining on{" "}
        <span className="font-mono text-tx">{branch}</span>. Resolve each file,
        {operation ? " then continue." : " then commit the resolution normally."}
      </span>
      <span className="flex-1" />
      {operation && (
        <>
          <span className="font-mono text-[11.5px] text-tx3">git {operation} --continue</span>
          <button
            type="button"
            title={remaining > 0 ? "Resolve all conflicts first" : "Continue"}
            disabled={remaining > 0 || continueBusy}
            onClick={onContinue}
            className="rounded border border-bd2 bg-panel2 px-3 py-1 text-[12px] font-semibold text-tx disabled:cursor-not-allowed disabled:text-tx3"
          >
            Continue {operation}
          </button>
          <ActionButton icon="trash" variant="danger" onClick={onAbort}>
            Abort {operation}…
          </ActionButton>
        </>
      )}
    </div>
  );
}
