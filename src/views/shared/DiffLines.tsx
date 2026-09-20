import { Fragment } from "react";
import type { DiffRow } from "../../lib/types";

/** Unified diff renderer shared by Changes and PR review.
 * `stageControls` adds hunk stage buttons (Changes view);
 * `commentGutter` adds the ＋ add-comment gutter and inline review thread
 * (PR review view). */
export function DiffLines({
  rows,
  stageControls = false,
  commentGutter = false,
  renderThread,
  onStageHunk,
  hunkActionLabel = "Stage hunk",
  selectedLines,
  onToggleLine,
}: {
  rows: (DiffRow & { hunkIdx?: number })[];
  stageControls?: boolean;
  commentGutter?: boolean;
  renderThread?: () => React.ReactNode;
  onStageHunk?: (hunkIdx: number) => void;
  hunkActionLabel?: string;
  selectedLines?: Set<string>;
  onToggleLine?: (hunkIdx: number, rawIndex: number) => void;
}) {
  return (
    <>
      {rows.map((ln, i) => {
        if (ln.hunk) {
          return (
            <div
              key={i}
              className="sticky top-0 flex items-center gap-[10px] border-y border-bd bg-panel2 px-[14px] py-[3px] text-[11.5px] text-tx3"
            >
              <span className="flex-1">{ln.hunk}</span>
              {stageControls && (
                <button
                  onClick={() => ln.hunkIdx !== undefined && onStageHunk?.(ln.hunkIdx)}
                  className="btn-accent cursor-pointer rounded-[4px] px-2 py-px font-mono text-[11px]"
                >
                  {hunkActionLabel}
                </button>
              )}
            </div>
          );
        }
        const bg =
          ln.t === "add" ? "var(--addbg)" : ln.t === "del" ? "var(--delbg)" : "transparent";
        const sign = ln.t === "add" ? "+" : ln.t === "del" ? "−" : "";
        const signColor = ln.t === "add" ? "var(--ok)" : "var(--er)";
        const txColor = ln.t === "ctx" ? "var(--tx2)" : "var(--tx)";
        const numW = commentGutter ? 40 : 44;
        return (
          <Fragment key={i}>
            <div className="group flex hover:brightness-110" style={{ background: bg }}>
              {onToggleLine &&
                (ln.t === "add" || ln.t === "del") &&
                ln.hunkIdx !== undefined &&
                ln.rawIndex !== undefined && (
                  <button
                    title="Select this changed line"
                    onClick={() => onToggleLine(ln.hunkIdx!, ln.rawIndex!)}
                    className="w-[22px] flex-none border-0 bg-transparent text-center text-[11px] text-actx"
                  >
                    {selectedLines?.has(`${ln.hunkIdx}:${ln.rawIndex}`) ? "■" : "□"}
                  </button>
                )}
              {commentGutter && (
                <span
                  title="Add comment"
                  className="w-[22px] flex-none cursor-pointer select-none text-center text-transparent group-hover:text-actx"
                >
                  ＋
                </span>
              )}
              <span
                className="flex-none select-none pr-2 text-right text-[11px] text-tx3"
                style={{ width: numW }}
              >
                {ln.n1}
              </span>
              <span
                className="flex-none select-none border-r border-bd pr-[10px] text-right text-[11px] text-tx3"
                style={{ width: numW }}
              >
                {ln.n2}
              </span>
              <span className="w-5 flex-none select-none text-center" style={{ color: signColor }}>
                {sign}
              </span>
              <span className="flex-1 whitespace-pre" style={{ color: txColor }}>
                {ln.text || " "}
              </span>
            </div>
            {ln.thread && renderThread ? renderThread() : null}
          </Fragment>
        );
      })}
    </>
  );
}
