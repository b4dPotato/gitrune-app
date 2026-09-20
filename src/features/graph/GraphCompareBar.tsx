import { ActionButton } from "../../components/ui/ActionButton";
import type { CommitComparison } from "../../lib/ipc";

export function GraphCompareBar({
  base,
  head,
  refs,
  selectedSha,
  comparison,
  onBaseChange,
  onHeadChange,
  onCompare,
  onExit,
}: {
  base: string;
  head: string;
  refs: string[];
  selectedSha?: string;
  comparison: CommitComparison | null;
  onBaseChange: (value: string) => void;
  onHeadChange: (value: string) => void;
  onCompare: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-bd bg-panel2 px-3 py-1.5">
      <span className="text-[10px] font-bold text-tx3">COMPARE</span>
      <label className="flex items-center gap-1 text-[10.5px] text-tx3">
        Base{" "}
        <input
          list="graph-compare-refs"
          value={base}
          onChange={(event) => onBaseChange(event.target.value)}
          placeholder="Older ref or SHA"
          className="input w-44 font-mono"
        />
      </label>
      <span className="text-tx3">→</span>
      <label className="flex items-center gap-1 text-[10.5px] text-tx3">
        Head{" "}
        <input
          list="graph-compare-refs"
          value={head}
          onChange={(event) => onHeadChange(event.target.value)}
          placeholder="Newer ref or SHA"
          className="input w-44 font-mono"
        />
      </label>
      <datalist id="graph-compare-refs">
        {refs.map((ref) => (
          <option key={ref} value={ref} />
        ))}
      </datalist>
      <ActionButton
        icon="compare"
        size="sm"
        onClick={() => {
          onBaseChange(head);
          onHeadChange(base);
        }}
        disabled={!base && !head}
        title="Swap base and head"
      >
        Swap
      </ActionButton>
      {selectedSha && (
        <ActionButton size="sm" onClick={() => onHeadChange(selectedSha)}>
          Selected → head
        </ActionButton>
      )}
      <ActionButton
        icon="compare"
        size="sm"
        variant="primary"
        disabled={!base.trim() || !head.trim() || base.trim() === head.trim()}
        onClick={onCompare}
      >
        Compare
      </ActionButton>
      {comparison && (
        <ActionButton icon="close" size="sm" onClick={onExit}>
          Exit comparison
        </ActionButton>
      )}
      <span className="flex-1" />
      {comparison ? (
        <span className="text-[11px] text-tx3">
          {comparison.behind} only in base · {comparison.ahead} only in head ·{" "}
          {comparison.files.length} changed files
        </span>
      ) : (
        <span className="text-[10.5px] text-tx3">
          Changes are calculated from the refs' merge base to head.
        </span>
      )}
    </div>
  );
}
