import { useTranslation } from "react-i18next";
import { ActionButton } from "../../components/ui/ActionButton";

export interface GraphFilters {
  message: string;
  author: string;
  revision: string;
  filePath: string;
  since: string;
  until: string;
  lineStart: string;
  lineEnd: string;
}

export function GraphToolbar({
  filtersOpen,
  compareOpen,
  comparing,
  summary,
  filters,
  onToggleFilters,
  onToggleCompare,
  onFiltersChange,
  onFileHistory,
  onBlame,
  onLineHistory,
  onClear,
}: {
  filtersOpen: boolean;
  compareOpen: boolean;
  comparing: boolean;
  summary: string;
  filters: GraphFilters;
  onToggleFilters: () => void;
  onToggleCompare: () => void;
  onFiltersChange: (patch: Partial<GraphFilters>) => void;
  onFileHistory: () => void;
  onBlame: () => void;
  onLineHistory: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center gap-2 border-b border-bd bg-panel px-3 py-1.5">
        <ActionButton
          icon="filter"
          size="sm"
          onClick={onToggleFilters}
          className={filtersOpen ? "border-acbd bg-acbg text-actx" : ""}
        >
          {t("graph.filter")}
        </ActionButton>
        <ActionButton
          icon="compare"
          size="sm"
          onClick={onToggleCompare}
          className={compareOpen || comparing ? "border-acbd bg-acbg text-actx" : ""}
        >
          {t("graph.compare")}
        </ActionButton>
        <span className="flex-1" />
        <span className="text-[11px] text-tx3">{summary}</span>
      </div>
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-bd bg-panel2 px-3 py-1.5">
          <span className="text-[10px] font-bold text-tx3">FILTER COMMITS</span>
          <input
            value={filters.message}
            onChange={(event) => onFiltersChange({ message: event.target.value })}
            placeholder="Message"
            className="input w-36"
          />
          <input
            value={filters.author}
            onChange={(event) => onFiltersChange({ author: event.target.value })}
            placeholder="Author"
            className="input w-28"
          />
          <input
            value={filters.revision}
            onChange={(event) => onFiltersChange({ revision: event.target.value })}
            placeholder="Branch / SHA"
            className="input w-32"
          />
          <input
            value={filters.filePath}
            onChange={(event) => onFiltersChange({ filePath: event.target.value })}
            placeholder="File path"
            className="input min-w-40 flex-1"
          />
          <input
            type="date"
            value={filters.since}
            onChange={(event) => onFiltersChange({ since: event.target.value })}
            title="Commits since"
            aria-label="Commits since"
            className="input w-32"
          />
          <input
            type="date"
            value={filters.until}
            onChange={(event) => onFiltersChange({ until: event.target.value })}
            title="Commits until"
            aria-label="Commits until"
            className="input w-32"
          />
          {filters.filePath.trim() && (
            <>
              <ActionButton size="sm" onClick={onFileHistory}>
                History
              </ActionButton>
              <ActionButton size="sm" onClick={onBlame}>
                Blame
              </ActionButton>
              <input
                type="number"
                min="1"
                value={filters.lineStart}
                onChange={(event) => onFiltersChange({ lineStart: event.target.value })}
                aria-label="First line"
                className="input w-14"
              />
              <span className="text-tx3">–</span>
              <input
                type="number"
                min={filters.lineStart || 1}
                value={filters.lineEnd}
                onChange={(event) => onFiltersChange({ lineEnd: event.target.value })}
                aria-label="Last line"
                className="input w-14"
              />
              <ActionButton size="sm" onClick={onLineHistory}>
                Lines
              </ActionButton>
            </>
          )}
          <ActionButton icon="close" size="sm" onClick={onClear}>
            Clear filters
          </ActionButton>
        </div>
      )}
    </>
  );
}
