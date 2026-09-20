import type { ReactNode } from "react";

export function ConflictPane({
  label,
  labelColor,
  description,
  text,
  trailing,
}: {
  label: string;
  labelColor: string;
  description: string;
  text: string;
  trailing?: ReactNode;
}) {
  const lines = text.replace(/\n$/, "").split("\n");
  const isMarker = (line: string) =>
    line.startsWith("<<<<<<<") || line.startsWith("=======") || line.startsWith(">>>>>>>");
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex min-w-0 flex-none items-center gap-2 border-b border-bd bg-panel px-3 py-[5px] text-[11px] text-tx3">
        <span className="font-bold" style={{ color: labelColor }}>
          {label}
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
          {description}
        </span>
        {trailing}
      </div>
      <div className="flex-1 select-text overflow-auto py-[6px] font-mono text-[11.5px] leading-[1.55]">
        {text === "" ? (
          <div className="px-3 py-2 text-tx3">(no content — file missing on this side)</div>
        ) : (
          lines.map((line, index) => (
            <div
              key={index}
              className="flex"
              style={{ background: isMarker(line) ? "var(--wnbg)" : "transparent" }}
            >
              <span className="w-9 flex-none select-none pr-[10px] text-right text-[10.5px] text-tx3">
                {index + 1}
              </span>
              <span
                className="whitespace-pre"
                style={{ color: isMarker(line) ? "var(--wn)" : "var(--tx2)" }}
              >
                {line || " "}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
