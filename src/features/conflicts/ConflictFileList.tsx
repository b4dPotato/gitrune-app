import type { StatusFile } from "../../lib/ipc";

export function ConflictFileList({
  files,
  selectedPath,
  operation,
  onSelect,
}: {
  files: StatusFile[];
  selectedPath?: string;
  operation?: string | null;
  onSelect: (index: number) => void;
}) {
  return (
    <aside className="flex w-[250px] flex-none flex-col border-r border-bd bg-panel">
      <div className="section-label px-3 pb-1 pt-2">
        CONFLICTED FILES — {files.length} REMAINING
      </div>
      {files.map((file, index) => (
        <button
          type="button"
          key={file.path}
          onClick={() => onSelect(index)}
          aria-current={selectedPath === file.path ? "true" : undefined}
          className="flex h-7 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-left hover:bg-hov"
          style={{ background: selectedPath === file.path ? "var(--active)" : "transparent" }}
        >
          <span className="w-[13px] text-center text-[11px] text-wn">⚠</span>
          <span className="min-w-0 flex-1 truncate text-[12px]">{file.path}</span>
        </button>
      ))}
      {files.length === 0 && (
        <div className="px-3 py-3 text-[12px] text-ok">
          ✓ all resolved{operation ? ` — continue the ${operation} above` : ""}
        </div>
      )}
    </aside>
  );
}
