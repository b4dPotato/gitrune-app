import { useState } from "react";
import { CopyButton } from "../components/ui/CopyButton";
import { useCurrentRepo, useOpLog, useRecoveries, useRestoreRecovery } from "../lib/hooks";
import { useApp, useSet } from "../state/store";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { useOperationRunner } from "../lib/useOperationRunner";

function glyphFor(exit: number | null): [string, string] {
  if (exit === null) return ["◐", "var(--inf)"];
  return exit === 0 ? ["✓", "var(--ok)"] : ["✕", "var(--er)"];
}

export function OpLogView() {
  const s = useApp();
  const set = useSet();
  const { data: ops = [] } = useOpLog();
  const repo = useCurrentRepo();
  const { data: recoveries = [] } = useRecoveries(repo?.path);
  const restore = useRestoreRecovery(repo?.path);
  const run = useOperationRunner();
  const [filter, setFilter] = useState("");
  const [failuresOnly, setFailuresOnly] = useState(false);

  const visible = ops.filter((o) => {
    if (failuresOnly && (o.exit === 0 || o.exit === null)) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      o.cmd.toLowerCase().includes(q) ||
      o.opType.toLowerCase().includes(q) ||
      o.repo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title={
          <div className="flex items-center gap-2">
            <input
              placeholder="Filter operations…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input w-60"
            />
            <button
              onClick={() => setFailuresOnly(!failuresOnly)}
              className="btn-sm px-[10px] py-1"
              style={{
                background: failuresOnly ? "var(--erbg)" : "var(--panel2)",
                color: failuresOnly ? "var(--er)" : "var(--tx2)",
              }}
            >
              Failures only
            </button>
          </div>
        }
        meta={
          <span>
            Every Git command the app runs, verbatim. Tokens and keys are always redacted.
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-[14px] py-[10px]">
        {recoveries.some((entry) => !entry.restoredAt) && (
          <div className="mb-3">
            <div className="section-label mb-1">RECOVERY POINTS</div>
            <div className="card">
              {recoveries
                .filter((entry) => !entry.restoredAt)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="flex min-h-[38px] items-center gap-3 border-b border-bd px-3 py-1.5"
                  >
                    <span className="text-ok">↩</span>
                    <span className="flex-1 text-[12px]">
                      Discard backup · {entry.paths.join(", ")}
                    </span>
                    <span className="text-[11px] text-tx3">{entry.createdAt}</span>
                    <button
                      disabled={restore.isPending}
                      onClick={() => void run(restore.mutateAsync(entry.id), "Recovery restored")}
                      className="btn-sm disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
        <div className="card">
          {visible.map((o) => {
            const [glyph, color] = glyphFor(o.exit);
            const expanded = s.expandedOp === o.id;
            return (
              <div key={o.id}>
                <div
                  onClick={() => set({ expandedOp: expanded ? -1 : o.id })}
                  className="flex h-[34px] cursor-pointer items-center gap-3 border-b border-bd px-[14px] hover:bg-hov"
                >
                  <span className="w-[14px] text-center text-[12px]" style={{ color }}>
                    {glyph}
                  </span>
                  <span className="w-[90px] flex-none text-[12px] font-semibold">{o.opType}</span>
                  <span className="w-[140px] flex-none overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-tx3">
                    {o.repo.split(/[\\/]/).pop()}
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-tx2">
                    {o.cmd}
                  </span>
                  <span className="w-[60px] flex-none text-right font-mono text-[11px] text-tx3">
                    {o.durationMs}ms
                  </span>
                  <span className="w-[120px] flex-none text-right text-[11px] text-tx3">
                    {o.startedAt}
                  </span>
                </div>
                {expanded && (
                  <div className="border-b border-bd bg-bg py-3 pb-[14px] pl-10 pr-[14px]">
                    <div className="mb-2 flex gap-4 font-mono text-[11.5px] text-tx3">
                      <span>exit {o.exit === null ? "—" : o.exit}</span>
                      <span>{o.status}</span>
                      <span>
                        HEAD {o.prevHead} → {o.nextHead}
                      </span>
                    </div>
                    <div className="mb-[10px] select-text whitespace-pre-wrap rounded border border-bd bg-panel px-3 py-[10px] font-mono text-[11.5px] leading-[1.6] text-tx2">
                      {o.out || "(no output)"}
                    </div>
                    <div className="flex gap-[6px]">
                      <CopyButton
                        value={o.cmd}
                        label="Copy command"
                        copiedLabel="Copied"
                        className="bg-panel2 px-[10px] py-[3px] text-[11.5px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-tx3">
              No operations logged yet. Stage, commit, fetch — every git call lands here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
