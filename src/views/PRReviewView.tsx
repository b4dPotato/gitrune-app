import { useState } from "react";
import { useToast } from "../components/Toast";
import { PR_DIFF, PR_FILES } from "../lib/mock";
import { stColor } from "../lib/ui";
import { useApp, useDispatch, useSet } from "../state/store";
import { DiffLines } from "./shared/DiffLines";
import { ActionButton } from "../components/ui/ActionButton";
import { ReviewThread } from "../features/pull-requests/ReviewThread";

type Tab = "conversation" | "commits" | "files";

export function PRReviewView() {
  const s = useApp();
  const set = useSet();
  const dispatch = useDispatch();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("files");
  const [reviewed, setReviewed] = useState<Set<number>>(
    () => new Set(PR_FILES.map((f, i) => (f.rev ? i : -1)).filter((i) => i >= 0)),
  );
  const [verdict, setVerdict] = useState<"approve" | "comment" | "changes">("comment");

  const demo = (what: string) =>
    toast(`${what} needs a connected GitHub account — next milestone. Nothing was sent.`, "info");

  const toggleReviewed = (i: number) => {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const tabBtn = (id: Tab, label: string, count?: number) => (
    <span
      onClick={() => setTab(id)}
      className="cursor-pointer px-3 py-[6px] text-[12px]"
      style={{
        color: tab === id ? "var(--tx)" : "var(--tx3)",
        fontWeight: tab === id ? 600 : 400,
        borderBottom: tab === id ? "2px solid var(--ac)" : "2px solid transparent",
      }}
    >
      {label} {count !== undefined && <span className="font-mono text-[11px]">{count}</span>}
    </span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex-none border-b border-bd bg-panel px-4 pt-[10px]">
        <div className="mb-[6px] flex items-center gap-2 text-[11.5px] text-tx3">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              dispatch({ type: "nav", view: "prs" });
            }}
          >
            ← Pull Requests
          </a>
          <span>/</span>
          <span>backend-api</span>
          <span className="rounded-[4px] bg-infbg px-[6px] text-[10.5px] text-inf">
            demo preview
          </span>
        </div>
        <div className="mb-[6px] flex flex-wrap items-center gap-[10px]">
          <span className="rounded-[4px] bg-okbg px-[9px] py-[2px] text-[12px] font-semibold text-ok">
            ⇄ Open
          </span>
          <span className="text-[15px] font-bold">
            Refactor token refresh &amp; session rotation
          </span>
          <span className="font-mono text-[12.5px] text-tx3">#142</span>
          <span className="chip bg-infbg text-inf">auth</span>
          <span className="chip bg-erbg text-er">breaking</span>
          <span className="flex-1" />
          <button onClick={() => demo("Checking out the PR branch")} className="btn px-[11px]">
            Checkout locally
          </button>
          <button
            onClick={() => dispatch({ type: "nav", view: "worktrees" })}
            title="Create an isolated worktree for review"
            className="btn px-[11px]"
          >
            ⧉ Review worktree
          </button>
          <button
            title="Blocked: CI failing and changes requested"
            onClick={() =>
              toast("Merge is blocked: required check failing and changes requested.", "warn")
            }
            className="cursor-pointer rounded border border-bd2 bg-panel2 px-3 py-1 text-[12px] font-semibold text-tx3"
          >
            Merge blocked ⌄
          </button>
        </div>
        <div className="mb-2 flex items-center gap-[10px] text-[11.5px] text-tx3">
          <span>
            <b className="text-tx2">alex</b> wants to merge{" "}
            <span className="font-mono text-tx2">feature/auth-tokens</span> into{" "}
            <span className="font-mono text-tx2">main</span>
          </span>
          <span>·</span>
          <span>4 commits</span>
          <span>·</span>
          <span>6 files</span>
          <span>·</span>
          <span className="font-mono">+177 −41</span>
          <span>·</span>
          <span className="text-wn">● 2 unresolved threads</span>
        </div>
        <div className="flex gap-[2px]">
          {tabBtn("conversation", "Conversation")}
          {tabBtn("commits", "Commits", 4)}
          {tabBtn("files", "Files", 6)}
        </div>
      </div>

      {tab === "conversation" && (
        <div className="flex-1 overflow-y-auto p-5 text-[12.5px] text-tx2">
          <div className="card max-w-[720px] p-4">
            <div className="mb-2 text-[13px] font-semibold text-tx">Description</div>
            Rotates refresh tokens on every use and revokes sessions server-side. Adds a retry
            budget to the API client and a regression test for the logout leak.
            <div className="mt-3 text-[11.5px] text-tx3">
              Full conversation timeline loads with the GitHub milestone.
            </div>
          </div>
        </div>
      )}

      {tab === "commits" && (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="card max-w-[720px]">
            {[
              ["e7c210f", "Rotate refresh tokens on use"],
              ["b90d3a2", "Add session revocation endpoint"],
              ["41c88d2", "Refactor token refresh & session rotation"],
              ["1f7ac03", "Add auth token scaffolding"],
            ].map(([sha, msg]) => (
              <div
                key={sha}
                className="flex h-8 items-center gap-3 border-b border-bd px-3 text-[12.5px] hover:bg-hov"
              >
                <span className="font-mono text-[11px] text-tx3">{sha}</span>
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="flex min-h-0 flex-1">
          {/* file list + submit review */}
          <div className="flex min-h-0 w-[clamp(230px,22vw,270px)] flex-none flex-col border-r border-bd bg-panel">
            <div className="flex-1 overflow-y-auto">
              <div className="section-label px-3 pb-[3px] pt-[7px]">
                FILES — {reviewed.size} OF {PR_FILES.length} REVIEWED
              </div>
              {PR_FILES.map((f, i) => (
                <div
                  key={f.dir + f.name}
                  onClick={() => set({ selPRFile: i })}
                  className="flex h-[27px] cursor-pointer items-center gap-[7px] px-3 hover:bg-hov"
                  style={{ background: s.selPRFile === i ? "var(--active)" : "transparent" }}
                >
                  <span
                    title={reviewed.has(i) ? "Mark not reviewed" : "Mark reviewed"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReviewed(i);
                    }}
                    className="w-[13px] cursor-pointer text-center text-[11px]"
                    style={{ color: reviewed.has(i) ? "var(--ok)" : "var(--tx3)" }}
                  >
                    {reviewed.has(i) ? "✓" : "○"}
                  </span>
                  <span
                    className="w-3 text-center font-mono text-[11px] font-bold"
                    style={{ color: stColor(f.st) }}
                  >
                    {f.st}
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">
                    <span className="text-tx3">{f.dir}</span>
                    {f.name}
                  </span>
                  {f.threads > 0 && (
                    <span
                      title="Unresolved threads"
                      className="rounded-lg bg-wnbg px-[6px] text-[10.5px] text-wn"
                    >
                      ● {f.threads}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-none flex-col gap-[7px] border-t border-bd px-3 py-[10px]">
              <div className="section-label">SUBMIT REVIEW · 1 pending comment</div>
              {(
                [
                  ["approve", "✓ Approve", "var(--ok)"],
                  ["comment", "Comment only", ""],
                  ["changes", "● Request changes", "var(--wn)"],
                ] as const
              ).map(([id, label, color]) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-[7px] text-[12px] text-tx2"
                >
                  <input
                    type="radio"
                    name="rv"
                    checked={verdict === id}
                    onChange={() => setVerdict(id)}
                    className="m-0 accent-ac"
                  />{" "}
                  <span style={{ color: color || undefined }}>{label}</span>
                </label>
              ))}
              <ActionButton variant="primary" onClick={() => demo("Submitting the review")}>
                Submit review
              </ActionButton>
            </div>
          </div>

          {/* diff */}
          <div className="flex min-w-0 flex-1 flex-col bg-bg">
            <div className="flex h-[34px] flex-none items-center gap-2 border-b border-bd bg-panel px-[14px]">
              <span className="font-mono text-[12px]">
                <span className="text-tx3">src/auth/</span>session.ts
              </span>
              <span className="font-mono text-[11px] text-tx3">+21 −9</span>
              <span className="flex-1" />
              <button onClick={() => toggleReviewed(s.selPRFile)} className="btn-sm">
                {reviewed.has(s.selPRFile) ? "Mark not viewed" : "Mark viewed"}
              </button>
            </div>
            <div className="flex-1 select-text overflow-auto font-mono text-[12px] leading-[1.55]">
              <DiffLines
                rows={PR_DIFF}
                commentGutter
                renderThread={() => (
                  <ReviewThread
                    onReply={() => demo("Adding a reply to the pending review")}
                    onResolve={() => demo("Resolving the thread")}
                  />
                )}
              />
              <div className="h-10" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
