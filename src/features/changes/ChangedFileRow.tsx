import type { StatusFile } from "../../lib/ipc";
import type { FileStatus } from "../../lib/types";
import { stColor } from "../../lib/ui";

function splitPath(path: string) {
  const index = path.lastIndexOf("/");
  return index < 0
    ? { dir: "", name: path }
    : { dir: path.slice(0, index + 1), name: path.slice(index + 1) };
}

export function ChangedFileRow({
  file,
  staged,
  active,
  onSelect,
  onToggleStage,
}: {
  file: StatusFile;
  staged: boolean;
  active: boolean;
  onSelect: () => void;
  onToggleStage: () => void;
}) {
  const { dir, name } = splitPath(file.path);
  return (
    <div
      onClick={onSelect}
      className="flex h-[26px] cursor-pointer items-center gap-2 px-3 hover:bg-hov"
      style={{ background: active ? "var(--active)" : "transparent" }}
    >
      <button
        aria-label={staged ? `Unstage ${file.path}` : `Stage ${file.path}`}
        title={staged ? "Unstage file" : "Stage file"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleStage();
        }}
        className={`h-[13px] w-[13px] flex-none cursor-pointer rounded-[3px] border text-center text-[10px] leading-3 ${staged ? "border-acbd bg-ac text-on-ac" : "border-bd2 bg-transparent hover:border-ac"}`}
      >
        {staged ? "✓" : ""}
      </button>
      <span
        className="w-3 text-center font-mono text-[11px] font-bold"
        style={{ color: stColor(file.st as FileStatus) }}
      >
        {file.st}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">
        <span className="text-tx3">{dir}</span>
        <span style={{ color: file.st === "D" ? "var(--tx3)" : "var(--tx)" }}>{name}</span>
      </span>
    </div>
  );
}
