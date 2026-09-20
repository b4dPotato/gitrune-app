import { useTranslation } from "react-i18next";
import type { UIEvent, Ref } from "react";
import type { CommitInfo } from "../../lib/gitparse";
import type { GraphRowLayout } from "../../lib/graphlayout";
import { Avatar } from "../../components/ui/Avatar";
import { Icon } from "../../components/ui/Icon";
import { COMMIT_ROW_HEIGHT, CommitGraphCell } from "./CommitGraphCell";

export function GraphCommitList({
  listRef,
  width,
  graphWidth,
  commits,
  layout,
  start,
  end,
  selectedSha,
  comparing,
  outgoingShas,
  loading,
  onScroll,
  onSelect,
}: {
  listRef: Ref<HTMLDivElement>;
  width: number;
  graphWidth: number;
  commits: CommitInfo[];
  layout: GraphRowLayout[];
  start: number;
  end: number;
  selectedSha: string | null;
  comparing: boolean;
  outgoingShas: Set<string>;
  loading: boolean;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onSelect: (index: number, sha: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-none flex-col bg-panel" style={{ width }}>
      <div className="flex h-7 items-center border-b border-bd px-3 text-[10px] font-bold uppercase tracking-wide text-tx3">
        {t("graph.commits")}
        <span className="flex-1" />
        {commits.length}
      </div>
      <div ref={listRef} className="relative min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <div style={{ height: commits.length * COMMIT_ROW_HEIGHT, position: "relative" }}>
          {commits.slice(start, end).map((commit, localIndex) => {
            const index = start + localIndex;
            const active = selectedSha === commit.sha;
            return (
              <button
                type="button"
                key={commit.sha}
                onClick={() => onSelect(index, commit.sha)}
                aria-current={active ? "true" : undefined}
                className="absolute left-0 right-0 flex w-full cursor-pointer items-center border-0 border-b border-bd bg-transparent p-0 text-left hover:bg-hov"
                style={{
                  height: COMMIT_ROW_HEIGHT,
                  transform: `translateY(${index * COMMIT_ROW_HEIGHT}px)`,
                  background: active && !comparing ? "var(--active)" : undefined,
                }}
              >
                <span className="flex-none" style={{ width: graphWidth }}>
                  <CommitGraphCell row={layout[index]} width={graphWidth} />
                </span>
                <span className="min-w-0 flex-1 pr-2">
                  <span className="block truncate text-[11.5px] font-medium text-tx">
                    {commit.msg}
                  </span>
                  <span className="mt-px flex items-center gap-1.5 text-[10px] text-tx3">
                    <Avatar name={commit.author} size={16} />
                    <span className="max-w-24 truncate">{commit.author}</span>
                    <span>·</span>
                    <span>{commit.time}</span>
                  </span>
                </span>
                {outgoingShas.has(commit.sha) && (
                  <span
                    title="Not pushed to upstream"
                    aria-label="Not pushed to upstream"
                    className="mr-2 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-panel2 text-actx"
                  >
                    <Icon name="push" size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {loading && (
          <div className="sticky bottom-0 bg-panel px-3 py-2 text-[11px] text-tx3">
            {t("graph.loadingHistory")}
          </div>
        )}
      </div>
    </section>
  );
}
