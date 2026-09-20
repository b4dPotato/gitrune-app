import type { ReactNode } from "react";
import { ActionButton } from "./ActionButton";
import { Icon } from "./Icon";

export function ConfirmActionModal({
  open,
  title,
  description,
  command,
  confirmLabel,
  busy,
  danger = true,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  command?: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={`w-[480px] max-w-[92vw] overflow-hidden rounded-lg border bg-panel shadow-[0_18px_55px_rgba(0,0,0,.5)] ${danger ? "border-er/50" : "border-bd2"}`}
      >
        <div className="flex items-center gap-2.5 px-4 pb-1 pt-4">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md ${danger ? "bg-erbg text-er" : "bg-acbg text-actx"}`}
          >
            <Icon name={danger ? "warning" : "settings"} />
          </span>
          <h2 className="m-0 text-[14px] font-bold">{title}</h2>
        </div>
        <div className="px-4 py-3 text-[12px] leading-relaxed text-tx2">
          <p className="m-0">{description}</p>
          {children}
          {command && (
            <pre className="mb-0 mt-3 overflow-auto rounded border border-bd bg-bg p-2 font-mono text-[11px] text-tx">
              {command}
            </pre>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <ActionButton onClick={onCancel}>Cancel</ActionButton>
          <ActionButton
            icon={danger ? "trash" : "check"}
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
