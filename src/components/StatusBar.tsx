import type { OperationProgress, RepoStatus } from "../lib/ipc";
import { useApp } from "../state/store";
import { useTranslation } from "react-i18next";

export function StatusBar({
  status,
  progress,
  onCancel,
}: {
  status: RepoStatus | undefined;
  progress: OperationProgress | null;
  onCancel: (operationId: number) => void;
}) {
  const { t } = useTranslation();
  const s = useApp();
  const opStatusLine = status?.operation
    ? t("status.operationRunning", { operation: status.operation })
    : s.view === "conflicts"
      ? t("status.noOperation")
      : t("status.noOperation");

  return (
    <div className="flex h-[25px] flex-none items-center gap-[14px] border-t border-bd bg-panel px-3 font-mono text-[11.5px] text-tx2">
      <span>⎇ {status?.branch ?? "…"}</span>
      <span>
        <span className="text-actx">↑{status?.ahead ?? 0}</span>{" "}
        <span className="text-inf">↓{status?.behind ?? 0}</span>
      </span>
      {status && status.dirty > 0 ? (
        <span className="text-wn">● {t("status.changed", { count: status.dirty })}</span>
      ) : (
        <span className="text-ok">✓ {t("status.clean")}</span>
      )}
      <span className="flex-1" />
      {progress ? (
        <span className="flex min-w-0 items-center gap-2 text-tx2">
          {progress.phase === "started" || progress.phase === "output" ? (
            <span className="gspin text-actx">◌</span>
          ) : null}
          <span className="max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap">
            {progress.phase === "output"
              ? progress.message
              : `${progress.message} · ${progress.phase}`}
          </span>
          {(progress.phase === "started" || progress.phase === "output") && (
            <button
              onClick={() => onCancel(progress.operationId)}
              className="cursor-pointer rounded border border-bd2 bg-transparent px-2 py-px text-[10px] text-tx2 hover:bg-hov"
            >
              {t("common.cancel")}
            </button>
          )}
        </span>
      ) : (
        <span className="text-tx3">{opStatusLine}</span>
      )}
      {status?.upstream && <span className="text-tx3">{status.upstream}</span>}
    </div>
  );
}
