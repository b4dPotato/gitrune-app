import { useTranslation } from "react-i18next";
import { ErrorNotice } from "../../components/ErrorNotice";
import { ActionButton } from "../../components/ui/ActionButton";
import { CommitOptionsMenu } from "./CommitOptionsMenu";

export function CommitComposer({
  identity,
  branch,
  message,
  template,
  stagedCount,
  amend,
  sign,
  pushAfter,
  pushAfterDisabled,
  pushAfterDescription,
  busy,
  undoBusy,
  error,
  onMessageChange,
  onCommit,
  onAmendChange,
  onSignChange,
  onPushAfterChange,
  onUndo,
}: {
  identity?: string;
  branch?: string;
  message: string;
  template?: string;
  stagedCount: number;
  amend: boolean;
  sign: boolean;
  pushAfter: boolean;
  pushAfterDisabled: boolean;
  pushAfterDescription: string;
  busy: boolean;
  undoBusy: boolean;
  error: unknown;
  onMessageChange: (value: string) => void;
  onCommit: () => void;
  onAmendChange: (value: boolean) => void;
  onSignChange: (value: boolean) => void;
  onPushAfterChange: (value: boolean) => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-none flex-col gap-2 border-t border-bd bg-panel px-3 py-[10px]">
      <div className="flex items-center gap-[6px] text-[11px] text-tx3">
        <span className="text-ok">✓</span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
          {identity ?? "…"}
        </span>
        <span className="flex-1" />
        {sign && (
          <span title="Commits will be signed" className="text-actx">
            signed
          </span>
        )}
      </div>
      <textarea
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        placeholder={t("changes.commitSummary")}
        rows={2}
        className="input min-h-[52px] w-full resize-y text-[12.5px] leading-[1.4]"
      />
      {template && !message && (
        <button
          type="button"
          onClick={() => onMessageChange(template)}
          className="self-start cursor-pointer border-0 bg-transparent p-0 text-[11px] text-actx"
        >
          Use configured commit template
        </button>
      )}
      <ErrorNotice error={error} />
      <div className="flex gap-[6px]">
        <ActionButton
          icon="check"
          variant="primary"
          onClick={onCommit}
          disabled={busy || (message.trim() === "" && !amend) || (stagedCount === 0 && !amend)}
          className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap py-[6px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("changes.committing") : t("changes.commitTo", { branch: branch ?? "…" })}
        </ActionButton>
        <CommitOptionsMenu
          amend={amend}
          sign={sign}
          pushAfter={pushAfter}
          pushAfterDisabled={pushAfterDisabled}
          pushAfterDescription={pushAfterDescription}
          onAmendChange={onAmendChange}
          onSignChange={onSignChange}
          onPushAfterChange={onPushAfterChange}
          undoDisabled={undoBusy}
          onUndo={onUndo}
        />
      </div>
    </div>
  );
}
