export interface SideBySideCellData {
  n: string;
  text: string;
  kind: "ctx" | "add" | "del" | "empty";
}

export function SideBySideCell({ cell }: { cell: SideBySideCellData }) {
  const background =
    cell.kind === "add" ? "var(--addbg)" : cell.kind === "del" ? "var(--delbg)" : "transparent";
  return (
    <div className="flex min-w-0 flex-1" style={{ background }}>
      <span className="w-10 flex-none select-none pr-2 text-right text-[11px] text-tx3">
        {cell.n}
      </span>
      <span
        className="min-w-0 flex-1 overflow-hidden whitespace-pre"
        style={{ color: cell.kind === "ctx" ? "var(--tx2)" : "var(--tx)" }}
      >
        {cell.text || " "}
      </span>
    </div>
  );
}
