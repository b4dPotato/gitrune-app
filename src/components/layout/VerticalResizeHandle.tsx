import type { MouseEventHandler } from "react";

export function VerticalResizeHandle({
  label,
  onMouseDown,
  onDoubleClick,
  className = "",
}: {
  label: string;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title="Drag to resize. Double-click to reset."
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={`group relative z-[5] w-1 flex-none cursor-col-resize bg-bd hover:bg-acbd ${className}`}
    >
      <span className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
