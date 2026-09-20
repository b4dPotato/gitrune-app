import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "./Toast";
import { CopyButton } from "./ui/CopyButton";
import { ActionButton } from "./ui/ActionButton";
import { CHECKS } from "../lib/mock";
import { ipc, type CommitComparison } from "../lib/ipc";
import {
  useCherryPick,
  useCreateBranch,
  useCreateTag,
  useCommitInfo,
  useCurrentRepo,
  useDiff,
  useRevertCommit,
  useStatus,
} from "../lib/hooks";
import type { FileStatus } from "../lib/types";
import { ciGlyph, stColor } from "../lib/ui";
import { useApp } from "../state/store";
import { ValidatedRefInput, validateGitRefName } from "./ValidatedRefInput";
import { useOperationRunner } from "../lib/useOperationRunner";

const PANEL_TITLES: Partial<Record<string, string>> = {
  changes: "FILE DETAILS",
  prreview: "CHECKS & THREADS",
};

function splitPath(p: string): { dir: string; name: string } {
  const i = p.lastIndexOf("/");
  return i < 0 ? { dir: "", name: p } : { dir: p.slice(0, i + 1), name: p.slice(i + 1) };
}

export function RightPanel({
  winW,
  onStartResize,
}: {
  winW: number;
  onStartResize: (e: React.MouseEvent) => void;
}) {
  const s = useApp();
  const toast = useToast();
  const run = useOperationRunner();
  const repo = useCurrentRepo();
  const { data: status } = useStatus(repo?.path);
  const { data: selG } = useCommitInfo(s.view === "graph" ? repo?.path : undefined, s.selCommitSha);

  const cherryPick = useCherryPick(repo?.path);
  const revertCommit = useRevertCommit(repo?.path);
  const createTag = useCreateTag(repo?.path);
  const createBranch = useCreateBranch(repo?.path);
  const [createKind, setCreateKind] = useState<"branch" | "tag" | null>(null);
  const [createName, setCreateName] = useState("");
  const [resetPreview, setResetPreview] = useState<CommitComparison | null>(null);

  const title = PANEL_TITLES[s.view];
  const visible = !!title && winW >= 1150;

  const { data: commitFilesRaw } = useQuery({
    queryKey: ["commitFiles", repo?.path, selG?.sha],
    queryFn: () => ipc.commitFiles(repo!.path, selG!.sha),
    enabled: visible && s.view === "graph" && !!repo && !!selG,
  });
  const commitFiles = (commitFilesRaw ?? "")
    .split("\n")
    .filter((l) => l.includes("\t"))
    .map((l) => {
      const [st, ...rest] = l.split("\t");
      return { st: st.trim().charAt(0), path: rest[rest.length - 1] };
    });

  const unstagedFiles = (status?.files ?? []).filter((f) => !f.staged && !f.conflicted);
  const stagedFiles = (status?.files ?? []).filter((f) => f.staged);
  const all = [...unstagedFiles, ...stagedFiles];
  const selIdx = s.selStaged >= 0 ? unstagedFiles.length + s.selStaged : s.selUnstaged;
  const sel = all[Math.min(selIdx, all.length - 1)] ?? all[0];
  const { data: selDiff } = useDiff(
    visible && s.view === "changes" ? repo?.path : undefined,
    sel?.path,
    sel?.staged ?? false,
  );

  if (!visible) return null;

  const commitActions = selG
    ? [
        {
          label: "Create branch",
          act: () => {
            setCreateKind("branch");
            setCreateName("");
          },
        },
        {
          label: "Tag",
          act: () => {
            setCreateKind("tag");
            setCreateName("");
          },
        },
        {
          label: "Cherry-pick",
          act: () =>
            run(
              cherryPick.mutateAsync(selG.sha),
              `Cherry-picked ${selG.sha} onto ${status?.branch}`,
            ),
        },
        {
          label: "Revert",
          act: () =>
            run(revertCommit.mutateAsync(selG.sha), `Created revert commit for ${selG.sha}`),
        },
        {
          label: "Reset preview",
          act: async () => {
            if (!repo) return;
            try {
              setResetPreview(await ipc.compareCommits(repo.path, selG.sha, "HEAD"));
            } catch (error) {
              toast(error, "error");
            }
          },
        },
      ]
    : [];

  return (
    <>
      <div
        onMouseDown={onStartResize}
        title="Drag to resize"
        className="w-[5px] flex-none cursor-col-resize bg-transparent hover:bg-acbd"
      />
      <div
        className="flex min-h-0 flex-none flex-col border-l border-bd bg-panel"
        style={{ width: s.rightW }}
      >
        <div className="flex h-[34px] flex-none items-center border-b border-bd px-3">
          <span className="text-[11px] font-bold tracking-[.07em] text-tx3">{title}</span>
          <span className="flex-1" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {s.view === "graph" && selG && (
            <div className="p-3">
              <div className="mb-[6px] select-text text-[13px] font-semibold">{selG.msg}</div>
              <div className="mb-1 flex items-center gap-[7px] text-[12px] text-tx2">
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-bd2 bg-panel2 text-[8px] font-bold text-tx3">
                  {selG.ini}
                </span>
                {selG.author} <span className="text-tx3">· {selG.time}</span>
              </div>
              <div className="mb-3 flex select-text items-center gap-[6px] font-mono text-[11px] text-tx3">
                <span className="rounded-[4px] border border-bd bg-bg px-[6px] py-px">
                  {selG.sha}
                </span>
                <CopyButton
                  value={selG.sha}
                  label="Copy SHA"
                  copiedLabel="Copied"
                  iconOnly
                  onCopied={() => toast(`Copied ${selG.sha}`, "ok")}
                />
                <CopyButton
                  value={`git show ${selG.sha}`}
                  label="Copy git show command"
                  copiedLabel="Copied"
                  iconOnly
                  onCopied={() => toast("Copied git show command", "ok")}
                />
                {selG.parents.length > 0 && <span>parent {selG.parents.join(" ")}</span>}
              </div>
              <div className="mb-[14px] flex flex-wrap gap-[5px]">
                {commitActions.map((a) => (
                  <button key={a.label} onClick={a.act} className="btn-sm bg-panel2">
                    {a.label}
                  </button>
                ))}
              </div>
              {createKind && (
                <form
                  className="mb-3 rounded border border-bd bg-bg p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = createName.trim();
                    if (!name) return;
                    const request =
                      createKind === "branch"
                        ? createBranch.mutateAsync({ name, checkout: true, at: selG.sha })
                        : createTag.mutateAsync({ name, sha: selG.sha });
                    void run(
                      request,
                      createKind === "branch"
                        ? `Created ${name} at ${selG.sha}`
                        : `Tagged ${selG.sha} as ${name}`,
                    );
                    setCreateKind(null);
                    setCreateName("");
                  }}
                >
                  <label className="mb-1 block text-[11px] text-tx2">
                    {createKind === "branch" ? "Branch" : "Tag"} name at {selG.sha}
                  </label>
                  <div className="flex gap-1">
                    <ValidatedRefInput
                      autoFocus
                      value={createName}
                      onChange={setCreateName}
                      placeholder={createKind === "branch" ? "feature/name" : "v1.0.0"}
                    />
                    <ActionButton variant="primary" disabled={!!validateGitRefName(createName)}>
                      Create
                    </ActionButton>
                    <ActionButton type="button" onClick={() => setCreateKind(null)}>
                      Cancel
                    </ActionButton>
                  </div>
                </form>
              )}
              {resetPreview && (
                <div className="mb-3 rounded border border-wn bg-wnbg p-2 text-[11px] text-tx2">
                  <div className="mb-1 flex items-center gap-2">
                    <strong className="text-wn">Reset preview only</strong>
                    <span className="flex-1" />
                    <button onClick={() => setResetPreview(null)} className="btn-sm">
                      Close
                    </button>
                  </div>
                  Resetting HEAD to{" "}
                  <span className="font-mono">{resetPreview.base.slice(0, 10)}</span> would move
                  past {resetPreview.ahead} commit(s) and affect {resetPreview.files.length}{" "}
                  file(s). No reset command has been run.
                  <div className="mt-1 max-h-24 overflow-auto font-mono text-[10px] text-tx3">
                    {resetPreview.commits.map((commit) => (
                      <div key={commit.sha}>
                        {commit.sha.slice(0, 10)} {commit.subject}
                      </div>
                    ))}
                    {resetPreview.files.map((file) => (
                      <div key={`${file.status}:${file.path}`}>
                        {file.status} {file.path}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="section-label mb-[6px]">CHANGED FILES — {commitFiles.length}</div>
              {commitFiles.map((f) => {
                const { dir, name } = splitPath(f.path);
                return (
                  <div
                    key={f.path}
                    className="flex h-[26px] items-center gap-[7px] rounded-[4px] px-[6px] text-[12px] hover:bg-hov"
                  >
                    <span
                      className="w-3 text-center font-mono text-[11px] font-bold"
                      style={{ color: stColor(f.st as FileStatus) }}
                    >
                      {f.st}
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className="text-tx3">{dir}</span>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {s.view === "graph" && !selG && (
            <div className="p-4 text-[12px] text-tx3">Select a commit in the graph.</div>
          )}

          {s.view === "prreview" && (
            <div className="p-3">
              <div className="section-label mb-[6px]">CI CHECKS — demo</div>
              {CHECKS.map((c) => {
                const [glyph, color] = ciGlyph(c.s);
                return (
                  <div
                    key={c.n}
                    className="flex h-[27px] items-center gap-2 rounded-[4px] px-[6px] text-[12px] hover:bg-hov"
                  >
                    <span className="w-[13px] text-center text-[11px]" style={{ color }}>
                      {glyph}
                    </span>
                    <span className="flex-1 font-mono text-[11.5px] text-tx2">{c.n}</span>
                    <span className="text-[11px] text-tx3">{c.d}</span>
                  </div>
                );
              })}
              <div className="my-2 rounded border border-inf bg-infbg px-[10px] py-2 text-[11.5px] text-tx2">
                Live checks and review threads arrive with the GitHub milestone.
              </div>
            </div>
          )}

          {s.view === "changes" && sel && (
            <div className="p-3">
              <div className="mb-[2px] break-all font-mono text-[12px]">{sel.path}</div>
              <div className="mb-3 text-[11.5px] text-tx3">
                {sel.st === "?" ? "untracked" : sel.st === "D" ? "deleted" : "modified"} ·{" "}
                <span className="font-mono">
                  +{selDiff?.add ?? 0} −{selDiff?.del ?? 0}
                </span>{" "}
                · {sel.staged ? "staged" : "not staged"}
              </div>
              {sel.origPath && (
                <div className="mb-3 text-[11.5px] text-tx3">
                  renamed from <span className="font-mono">{sel.origPath}</span>
                </div>
              )}
              <div className="section-label mb-[6px]">HUNKS</div>
              {(selDiff?.hunks ?? []).map((h, i) => (
                <div
                  key={i}
                  className="mb-1 overflow-hidden text-ellipsis whitespace-nowrap rounded border border-bd bg-bg px-2 py-1 font-mono text-[11px] text-tx3"
                >
                  {h.header}
                </div>
              ))}
              {selDiff && selDiff.hunks.length === 0 && (
                <div className="text-[12px] text-tx3">No text hunks (binary or empty).</div>
              )}
            </div>
          )}
          {s.view === "changes" && !sel && (
            <div className="p-4 text-[12px] text-tx3">Working tree clean.</div>
          )}
        </div>
      </div>
    </>
  );
}
