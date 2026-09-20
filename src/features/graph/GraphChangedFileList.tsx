import { useTranslation } from "react-i18next";
import type { CompareFile } from "../../lib/ipc";
import type { FileStatus } from "../../lib/types";
import { stColor } from "../../lib/ui";
import { MAX_RENDERED_CHANGED_FILES } from "../../lib/limits";

export function GraphChangedFileList({
  width,
  files,
  selectedPath,
  onSelect,
}: {
  width: number;
  files: CompareFile[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const { t } = useTranslation();
  const visibleFiles = files.slice(0, MAX_RENDERED_CHANGED_FILES);

  return (
    <section className="flex flex-none flex-col" style={{ width }}>
      <div className="flex h-7 items-center border-b border-bd bg-panel px-3 text-[10px] font-bold uppercase tracking-wide text-tx3">
        {t("graph.changedFiles")}
        <span className="flex-1" />
        {files.length}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-panel2">
        {visibleFiles.map((file) => {
          const path = splitPath(file.path);
          return (
            <button
              type="button"
              key={`${file.status}:${file.path}`}
              onClick={() => onSelect(file.path)}
              aria-current={selectedPath === file.path ? "true" : undefined}
              className="flex min-h-8 w-full items-center gap-2 border-0 border-b border-bd bg-transparent px-2 text-left hover:bg-hov"
              style={{ background: selectedPath === file.path ? "var(--active)" : undefined }}
            >
              <span
                className="w-3 text-center font-mono text-[10px] font-bold"
                style={{ color: stColor(file.status as FileStatus) }}
              >
                {file.status}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]">
                <span className="text-tx3">{path.dir}</span>
                {path.name}
              </span>
            </button>
          );
        })}
        {files.length > visibleFiles.length && (
          <div className="p-2 text-center text-[10px] text-tx3">
            Showing the first {visibleFiles.length.toLocaleString()} files. Narrow the comparison to
            inspect the rest.
          </div>
        )}
        {files.length === 0 && (
          <div className="p-4 text-center text-[11px] text-tx3">{t("graph.noChangedFiles")}</div>
        )}
      </div>
    </section>
  );
}

function splitPath(path: string) {
  const index = path.lastIndexOf("/");
  return index < 0
    ? { dir: "", name: path }
    : { dir: path.slice(0, index + 1), name: path.slice(index + 1) };
}
