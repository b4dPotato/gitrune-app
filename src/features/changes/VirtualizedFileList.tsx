import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StatusFile } from "../../lib/ipc";
import { ChangedFileRow } from "./ChangedFileRow";

const ROW_HEIGHT = 26;
const OVERSCAN = 8;

export function virtualFileRange(count: number, scrollTop: number, viewportHeight: number) {
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  return { start, end };
}

export function VirtualizedFileList({
  files,
  staged,
  selectedIndex,
  onSelect,
  onToggleStage,
}: {
  files: StatusFile[];
  staged: boolean;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onToggleStage: (file: StatusFile) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(240);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const updateSize = () => setViewportHeight(element.clientHeight);
    updateSize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { start, end } = useMemo(
    () => virtualFileRange(files.length, scrollTop, viewportHeight),
    [files.length, scrollTop, viewportHeight],
  );

  return (
    <div
      ref={viewport}
      className="min-h-0 flex-1 overflow-y-auto"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: files.length * ROW_HEIGHT }}>
        {files.slice(start, end).map((file, offset) => {
          const index = start + offset;
          return (
            <div
              key={`${staged ? "s" : "u"}:${file.path}`}
              className="absolute left-0 right-0"
              style={{ height: ROW_HEIGHT, transform: `translateY(${index * ROW_HEIGHT}px)` }}
            >
              <ChangedFileRow
                file={file}
                staged={staged}
                active={selectedIndex === index}
                onSelect={() => onSelect(index)}
                onToggleStage={() => onToggleStage(file)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
