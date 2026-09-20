import { useTranslation } from "react-i18next";
import type { CommitComparison, CommitRecord } from "../../lib/ipc";
import type { ParsedDiff } from "../../lib/gitparse";
import { Avatar } from "../../components/ui/Avatar";
import { ActionButton } from "../../components/ui/ActionButton";
import { Dropdown } from "../../components/Dropdown";
import { OpenInEditor } from "../editor/OpenInEditor";
import { DiffLines } from "../../views/shared/DiffLines";
import { SideBySideDiff } from "../../views/shared/SideBySideDiff";
import { MAX_RENDERED_DIFF_ROWS } from "../../lib/limits";

export function GraphDiffPanel({
  repoPath,
  selectedFile,
  selected,
  comparison,
  diff,
  mode,
  onModeChange,
  onCopy,
  onNewBranch,
  onCherryPick,
  onRevert,
}: {
  repoPath?: string;
  selectedFile: string;
  selected?: CommitRecord;
  comparison: CommitComparison | null;
  diff: ParsedDiff | null;
  mode: "inline" | "side";
  onModeChange: (mode: "inline" | "side") => void;
  onCopy: (value: string, message: string) => void;
  onNewBranch: () => void;
  onCherryPick: () => void;
  onRevert: () => void;
}) {
  const { t } = useTranslation();
  const visibleDiff = diff ? { ...diff, rows: diff.rows.slice(0, MAX_RENDERED_DIFF_ROWS) } : null;
  const diffWasLimited = !!diff && diff.rows.length > MAX_RENDERED_DIFF_ROWS;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <div className="flex min-h-[48px] items-center gap-2 border-b border-bd bg-panel px-3 py-1.5">
        {comparison ? (
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold">
              Compare {comparison.base} … {comparison.head}
            </div>
            <div className="text-[10.5px] text-tx3">
              {comparison.commits.length} commits · ↑{comparison.ahead} ↓{comparison.behind}
            </div>
          </div>
        ) : selected ? (
          <>
            <Avatar name={selected.author} size={24} />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold">{selected.subject}</div>
              <div className="text-[10.5px] text-tx3">
                {selected.author} · {selected.relativeTime} ·{" "}
                <span className="font-mono">{selected.sha.slice(0, 10)}</span>
              </div>
            </div>
            <ActionButton
              icon="copy"
              iconOnly
              size="sm"
              title="Copy SHA"
              aria-label="Copy SHA"
              onClick={() => onCopy(selected.sha, "SHA copied")}
            />
            <Dropdown
              header="COMMIT ACTIONS"
              items={[
                { label: "New branch at commit…", glyph: "+", onClick: onNewBranch },
                { label: "Cherry-pick commit", glyph: "↙", onClick: onCherryPick },
                { label: "Revert commit", glyph: "↩", onClick: onRevert },
                {
                  label: "Copy git show command",
                  glyph: "⧉",
                  onClick: () => onCopy(`git show ${selected.sha}`, "Command copied"),
                },
              ]}
              trigger={(_, toggle) => (
                <ActionButton size="sm" onClick={toggle}>
                  •••
                </ActionButton>
              )}
            />
          </>
        ) : (
          <span className="text-[12px] text-tx3">{t("graph.selectCommit")}</span>
        )}
        <span className="flex-1" />
        {repoPath && selectedFile && (
          <OpenInEditor repoPath={repoPath} file={selectedFile} compact />
        )}
        <div
          role="group"
          aria-label="Diff mode"
          className="flex overflow-hidden rounded border border-bd2"
        >
          <ModeButton active={mode === "inline"} onClick={() => onModeChange("inline")}>
            {t("changes.inline")}
          </ModeButton>
          <ModeButton active={mode === "side"} bordered onClick={() => onModeChange("side")}>
            {t("changes.sideBySide")}
          </ModeButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 select-text overflow-auto font-mono text-[11.5px] leading-[1.5]">
        {visibleDiff?.binary ? (
          <div className="p-4 text-tx3">{t("graph.binary")}</div>
        ) : visibleDiff && mode === "inline" ? (
          <DiffLines rows={visibleDiff.rows} />
        ) : visibleDiff && mode === "side" ? (
          <SideBySideDiff diff={visibleDiff} />
        ) : (
          <div className="p-6 text-center text-[12px] text-tx3">
            {selectedFile ? t("graph.loadingChanges") : t("graph.selectChangedFile")}
          </div>
        )}
        {diffWasLimited && (
          <div className="sticky bottom-0 border-t border-bd bg-panel px-3 py-2 font-sans text-[10px] text-tx3">
            Diff preview limited to {MAX_RENDERED_DIFF_ROWS.toLocaleString()} rows. Open the file in
            an editor to inspect the full change.
          </div>
        )}
      </div>
    </section>
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
      className={`border-0 px-2 py-1 text-[10.5px] ${bordered ? "border-l border-bd2" : ""}`}
      style={{
        background: active ? "var(--active)" : "transparent",
        color: active ? "var(--tx)" : "var(--tx3)",
      }}
    >
      {children}
    </button>
  );
}
