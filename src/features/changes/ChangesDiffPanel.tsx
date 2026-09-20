import { useTranslation } from "react-i18next";
import type { StatusFile } from "../../lib/ipc";
import type { ParsedDiff } from "../../lib/gitparse";
import type { FileStatus } from "../../lib/types";
import { stColor } from "../../lib/ui";
import { ActionButton } from "../../components/ui/ActionButton";
import { OpenInEditor } from "../editor/OpenInEditor";
import { DiffLines } from "../../views/shared/DiffLines";
import { SideBySideDiff } from "../../views/shared/SideBySideDiff";
import { MAX_RENDERED_DIFF_ROWS } from "../../lib/limits";

export function ChangesDiffPanel({
  repoPath,
  file,
  diff,
  mode,
  selectedLines,
  patchBusy,
  onModeChange,
  onApplySelectedLines,
  onApplyHunk,
  onToggleLine,
  onDiscard,
}: {
  repoPath?: string;
  file?: StatusFile;
  diff?: ParsedDiff;
  mode: "inline" | "side";
  selectedLines: Set<string>;
  patchBusy: boolean;
  onModeChange: (mode: "inline" | "side") => void;
  onApplySelectedLines: () => void;
  onApplyHunk: (hunkIndex: number) => void;
  onToggleLine: (hunkIndex: number, rawIndex: number) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const staged = file?.staged ?? false;
  const path = file ? splitPath(file.path) : { dir: "", name: "" };
  const visibleDiff = diff
    ? { ...diff, rows: diff.rows.slice(0, MAX_RENDERED_DIFF_ROWS) }
    : undefined;
  const diffWasLimited = !!diff && diff.rows.length > MAX_RENDERED_DIFF_ROWS;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-bg">
      <div className="flex min-h-[38px] flex-none flex-wrap items-center gap-x-2 gap-y-[5px] border-b border-bd bg-panel px-[14px] py-1">
        {file ? (
          <>
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-tx">
              <span className="text-tx3">{path.dir}</span>
              {path.name}
            </span>
            <span
              className="font-mono text-[11px] font-bold"
              style={{ color: stColor(file.st as FileStatus) }}
            >
              {file.st}
            </span>
            <span className="whitespace-nowrap font-mono text-[11px] text-tx3">
              +{diff?.add ?? 0} −{diff?.del ?? 0}
            </span>
          </>
        ) : (
          <span className="text-[12px] text-tx3">{t("changes.noFile")}</span>
        )}
        <span className="flex-1" />
        {selectedLines.size > 0 && (
          <ActionButton
            size="sm"
            variant="primary"
            onClick={onApplySelectedLines}
            disabled={patchBusy}
            className="flex-none"
          >
            {staged ? "Unstage" : "Stage"} {selectedLines.size} selected{" "}
            {selectedLines.size === 1 ? "line" : "lines"}
          </ActionButton>
        )}
        <div
          role="group"
          aria-label="Diff mode"
          className="flex flex-none overflow-hidden rounded border border-bd2"
        >
          <ModeButton active={mode === "inline"} onClick={() => onModeChange("inline")}>
            {t("changes.inline")}
          </ModeButton>
          <ModeButton active={mode === "side"} onClick={() => onModeChange("side")} bordered>
            {t("changes.sideBySide")}
          </ModeButton>
        </div>
        {repoPath && file && <OpenInEditor repoPath={repoPath} file={file.path} compact />}
        <ActionButton
          icon="trash"
          variant="danger"
          onClick={onDiscard}
          disabled={!file || staged}
          title="Discard with a recovery point"
          className="flex-none disabled:opacity-40"
        >
          {t("changes.discard")}
        </ActionButton>
      </div>
      <div className="flex-1 select-text overflow-auto font-mono text-[12px] leading-[1.55]">
        {visibleDiff?.binary && <div className="p-4 text-[12px] text-tx3">{t("graph.binary")}</div>}
        {visibleDiff && !visibleDiff.binary && mode === "inline" && (
          <DiffLines
            rows={visibleDiff.rows}
            stageControls
            hunkActionLabel={staged ? "Unstage hunk" : "Stage hunk"}
            onStageHunk={onApplyHunk}
            selectedLines={selectedLines}
            onToggleLine={onToggleLine}
          />
        )}
        {visibleDiff && !visibleDiff.binary && mode === "side" && (
          <SideBySideDiff diff={visibleDiff} />
        )}
        {diffWasLimited && (
          <div className="sticky bottom-0 border-t border-bd bg-panel px-3 py-2 font-sans text-[10px] text-tx3">
            Diff preview limited to {MAX_RENDERED_DIFF_ROWS.toLocaleString()} rows. Open the file in
            an editor to inspect the full change.
          </div>
        )}
        {!diff && file && (
          <div className="p-4 text-[12px] text-tx3">{t("changes.loadingDiff")}</div>
        )}
        <div className="h-10" />
      </div>
    </main>
  );
}

function ModeButton({
  active,
  bordered,
  onClick,
  children,
}: {
  active: boolean;
  bordered?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer whitespace-nowrap border-0 px-[10px] py-[3px] text-[11.5px] ${bordered ? "border-l border-bd2" : ""}`}
      style={{
        background: active ? "var(--active)" : "transparent",
        color: active ? "var(--tx)" : "var(--tx3)",
      }}
    >
      {children}
    </button>
  );
}

function splitPath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf("/");
  return index < 0
    ? { dir: "", name: path }
    : { dir: path.slice(0, index + 1), name: path.slice(index + 1) };
}
