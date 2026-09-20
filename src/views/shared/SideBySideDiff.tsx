/** Side-by-side diff renderer. Pairs deletions with the additions that follow
 * them inside each hunk (standard two-column alignment). */
import type { ParsedDiff } from "../../lib/gitparse";
import { SideBySideCell, type SideBySideCellData } from "./SideBySideCell";

interface Row {
  left: SideBySideCellData;
  right: SideBySideCellData;
}

const EMPTY: SideBySideCellData = { n: "", text: "", kind: "empty" };

export function buildSideBySide(diff: ParsedDiff): (Row | { hunk: string })[] {
  const out: (Row | { hunk: string })[] = [];
  let pendingDel: SideBySideCellData[] = [];
  const flushDels = () => {
    for (const d of pendingDel) out.push({ left: d, right: EMPTY });
    pendingDel = [];
  };
  for (const r of diff.rows) {
    if (r.hunk) {
      flushDels();
      out.push({ hunk: r.hunk });
      continue;
    }
    if (r.t === "ctx") {
      flushDels();
      out.push({
        left: { n: r.n1 ?? "", text: r.text ?? "", kind: "ctx" },
        right: { n: r.n2 ?? "", text: r.text ?? "", kind: "ctx" },
      });
    } else if (r.t === "del") {
      pendingDel.push({ n: r.n1 ?? "", text: r.text ?? "", kind: "del" });
    } else if (r.t === "add") {
      const left = pendingDel.shift() ?? EMPTY;
      out.push({ left, right: { n: r.n2 ?? "", text: r.text ?? "", kind: "add" } });
    }
  }
  flushDels();
  return out;
}

export function SideBySideDiff({ diff }: { diff: ParsedDiff }) {
  const rows = buildSideBySide(diff);
  return (
    <>
      {rows.map((r, i) =>
        "hunk" in r ? (
          <div
            key={i}
            className="sticky top-0 border-y border-bd bg-panel2 px-[14px] py-[3px] text-[11.5px] text-tx3"
          >
            {r.hunk}
          </div>
        ) : (
          <div key={i} className="flex">
            <SideBySideCell cell={r.left} />
            <div className="w-px flex-none bg-bd" />
            <SideBySideCell cell={r.right} />
          </div>
        ),
      )}
    </>
  );
}
