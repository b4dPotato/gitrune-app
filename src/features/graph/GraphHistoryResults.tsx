import type { BlameLine, CommitRecord, LineHistoryEntry } from "../../lib/ipc";
import { ActionButton } from "../../components/ui/ActionButton";
import { MAX_RENDERED_BLAME_LINES, MAX_RENDERED_HISTORY_ITEMS } from "../../lib/limits";

export function GraphHistoryResults({
  filePath,
  lineStart,
  lineEnd,
  history,
  blame,
  lineHistory,
  onClose,
}: {
  filePath: string;
  lineStart: string;
  lineEnd: string;
  history: CommitRecord[] | null;
  blame: BlameLine[] | null;
  lineHistory: LineHistoryEntry[] | null;
  onClose: () => void;
}) {
  if (!history && !blame && !lineHistory) return null;

  const heading = history
    ? `History: ${filePath}`
    : blame
      ? `Blame: ${filePath}`
      : `Line history: ${filePath}:${lineStart}-${lineEnd}`;
  const visibleHistory = history?.slice(0, MAX_RENDERED_HISTORY_ITEMS);
  const visibleBlame = blame?.slice(0, MAX_RENDERED_BLAME_LINES);
  const visibleLineHistory = lineHistory?.slice(0, MAX_RENDERED_HISTORY_ITEMS);
  const hiddenCount = history
    ? history.length - visibleHistory!.length
    : blame
      ? blame.length - visibleBlame!.length
      : (lineHistory?.length ?? 0) - (visibleLineHistory?.length ?? 0);

  return (
    <div className="max-h-40 overflow-auto border-b border-bd bg-bg px-3 py-2 text-[11px]">
      <div className="mb-1 flex">
        <strong>{heading}</strong>
        <span className="flex-1" />
        <ActionButton
          icon="close"
          iconOnly
          size="sm"
          aria-label="Close details"
          onClick={onClose}
        />
      </div>
      {visibleHistory?.map((commit) => (
        <div key={commit.sha} className="font-mono text-tx2">
          {commit.sha.slice(0, 10)} {commit.relativeTime} {commit.author} — {commit.subject}
        </div>
      ))}
      {visibleBlame?.map((line) => (
        <div key={`${line.sha}:${line.finalLine}`} className="flex font-mono">
          <span className="w-12 text-right text-tx3">{line.finalLine}</span>
          <span className="w-28 px-2 text-tx3">{line.sha.slice(0, 10)}</span>
          <span className="w-32 truncate text-tx3">{line.author}</span>
          <span className="whitespace-pre text-tx2">{line.text}</span>
        </div>
      ))}
      {visibleLineHistory?.map((entry) => (
        <details key={entry.sha} className="border-t border-bd py-1">
          <summary className="cursor-pointer font-mono text-tx2">
            {entry.sha.slice(0, 10)} {entry.author} — {entry.subject}
          </summary>
          <pre className="select-text overflow-auto whitespace-pre-wrap text-[10px] text-tx3">
            {entry.patch}
          </pre>
        </details>
      ))}
      {hiddenCount > 0 && (
        <div className="pt-1 text-tx3">
          {hiddenCount.toLocaleString()} additional rows hidden. Use a narrower file or line range.
        </div>
      )}
    </div>
  );
}
