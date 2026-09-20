import { useTranslation } from "react-i18next";
import { ActionButton } from "../../components/ui/ActionButton";

export function StashForm({
  message,
  includeUntracked,
  busy,
  onMessageChange,
  onIncludeUntrackedChange,
  onCancel,
  onSubmit,
}: {
  message: string;
  includeUntracked: boolean;
  busy: boolean;
  onMessageChange: (value: string) => void;
  onIncludeUntrackedChange: (value: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-none flex-col gap-2 border-b border-bd bg-panel2 px-[10px] py-2">
      <input
        autoFocus
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        placeholder="Optional stash message"
        className="input w-full"
      />
      <label className="flex items-center gap-2 text-[11px] text-tx2">
        <input
          type="checkbox"
          checked={includeUntracked}
          onChange={(event) => onIncludeUntrackedChange(event.target.checked)}
          className="accent-ac"
        />
        Include untracked files
      </label>
      <div className="flex justify-end gap-2">
        <ActionButton size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </ActionButton>
        <ActionButton icon="stash" size="sm" variant="primary" disabled={busy} onClick={onSubmit}>
          {busy ? "Stashing…" : "Stash changes"}
        </ActionButton>
      </div>
    </div>
  );
}
