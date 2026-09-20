import { useTranslation } from "react-i18next";
import type { StatusFile } from "../../lib/ipc";
import { ActionButton } from "../../components/ui/ActionButton";
import { StashForm } from "./StashForm";
import { VirtualizedFileList } from "./VirtualizedFileList";

export function ChangesFilePanel({
  width,
  filter,
  unstaged,
  staged,
  unstagedTotal,
  stagedTotal,
  stagingPendingCount,
  selectedUnstaged,
  selectedStaged,
  stashOpen,
  stashMessage,
  stashUntracked,
  stashBusy,
  onFilterChange,
  onToggleStash,
  onStashMessageChange,
  onStashUntrackedChange,
  onStash,
  onSelectUnstaged,
  onSelectStaged,
  onStage,
  onUnstage,
  children,
}: {
  width: number;
  filter: string;
  unstaged: StatusFile[];
  staged: StatusFile[];
  unstagedTotal: number;
  stagedTotal: number;
  stagingPendingCount: number;
  selectedUnstaged: number;
  selectedStaged: number;
  stashOpen: boolean;
  stashMessage: string;
  stashUntracked: boolean;
  stashBusy: boolean;
  onFilterChange: (value: string) => void;
  onToggleStash: () => void;
  onStashMessageChange: (value: string) => void;
  onStashUntrackedChange: (value: boolean) => void;
  onStash: () => void;
  onSelectUnstaged: (index: number) => void;
  onSelectStaged: (index: number) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const fileCount = unstagedTotal + stagedTotal;
  const visibleFileCount = unstaged.length + staged.length;

  return (
    <aside className="flex min-h-0 flex-none flex-col bg-panel" style={{ width }}>
      <div className="flex flex-none items-center gap-2 border-b border-bd px-[10px] py-2">
        <input
          placeholder={t("changes.filterFiles")}
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          className="input min-w-0 flex-1"
        />
        {stagingPendingCount > 0 && (
          <span role="status" className="flex flex-none items-center gap-1 text-[10.5px] text-tx3">
            <span className="gspin">↻</span>
            {t("changes.updatingIndex", { count: stagingPendingCount })}
          </span>
        )}
        <ActionButton
          icon="stash"
          size="sm"
          title="Stash the current working-tree changes"
          disabled={fileCount === 0}
          onClick={onToggleStash}
        >
          {t("changes.stash")}
        </ActionButton>
      </div>
      {stashOpen && (
        <StashForm
          message={stashMessage}
          includeUntracked={stashUntracked}
          busy={stashBusy}
          onMessageChange={onStashMessageChange}
          onIncludeUntrackedChange={onStashUntrackedChange}
          onCancel={onToggleStash}
          onSubmit={onStash}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <FileGroupSection
          label={t("changes.unstaged")}
          files={unstaged}
          totalCount={unstagedTotal}
          action={t("changes.stageAll")}
          staged={false}
          selectedIndex={selectedUnstaged}
          fill={unstaged.length > 0}
          onAction={() => onStage(unstaged.map((file) => file.path))}
          onSelect={onSelectUnstaged}
          onToggle={(file) => onStage([file.path])}
        />
        <FileGroupSection
          label={t("changes.staged")}
          files={staged}
          totalCount={stagedTotal}
          action={t("changes.unstageAll")}
          staged
          selectedIndex={selectedStaged}
          fill={unstaged.length === 0 && staged.length > 0}
          onAction={() => onUnstage(staged.map((file) => file.path))}
          onSelect={onSelectStaged}
          onToggle={(file) => onUnstage([file.path])}
        />
        {visibleFileCount === 0 && (
          <div className="px-3 py-4 text-center text-[12px] text-tx3">
            {filter ? t("changes.noMatches") : t("changes.clean")}
          </div>
        )}
      </div>
      {children}
    </aside>
  );
}

function FileGroupSection({
  label,
  files,
  totalCount,
  action,
  staged,
  selectedIndex,
  fill,
  onAction,
  onSelect,
  onToggle,
}: {
  label: string;
  files: StatusFile[];
  totalCount: number;
  action: string;
  staged: boolean;
  selectedIndex: number;
  fill: boolean;
  onAction: () => void;
  onSelect: (index: number) => void;
  onToggle: (file: StatusFile) => void;
}) {
  const filtered = files.length !== totalCount;
  const compactHeight = Math.max(28, Math.min(220, 28 + files.length * 26));
  return (
    <section
      className={`flex min-h-0 flex-col border-b border-bd ${fill ? "flex-1" : "flex-none"}`}
      style={fill ? undefined : { height: compactHeight, maxHeight: "42%" }}
    >
      <div className="flex h-7 flex-none items-center bg-panel2 px-3 text-[10.5px] font-bold uppercase tracking-[.07em] text-tx3">
        {label}{" "}
        <span
          className="ml-[6px] font-mono"
          title={filtered ? `${files.length} matching` : undefined}
        >
          {filtered ? `${files.length}/${totalCount}` : totalCount}
        </span>
        <span className="flex-1" />
        {files.length > 0 && (
          <button
            type="button"
            onClick={onAction}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-normal normal-case tracking-normal text-actx"
          >
            {action}
          </button>
        )}
      </div>
      {files.length > 0 && (
        <VirtualizedFileList
          files={files}
          staged={staged}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onToggleStage={onToggle}
        />
      )}
    </section>
  );
}
