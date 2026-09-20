import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "../../components/ui/ActionButton";
import { ValidatedRefInput, validateGitRefName } from "../../components/ValidatedRefInput";
import { pickFolder } from "../../lib/ipc";

function childPath(parent: string, branch: string) {
  const separator = parent.includes("\\") ? "\\" : "/";
  const folder = branch.trim().replace(/[/\\]/g, "-") || "new-worktree";
  return `${parent.replace(/[\\/]$/, "")}${separator}${folder}`;
}

export function CreateWorktreeModal({
  open,
  repoPath,
  localBranches,
  busy,
  onCancel,
  onCreate,
}: {
  open: boolean;
  repoPath: string;
  localBranches: string[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (value: { wtPath: string; branch: string; create: boolean }) => void;
}) {
  const [createBranch, setCreateBranch] = useState(true);
  const [branch, setBranch] = useState("");
  const [parent, setParent] = useState("");
  useEffect(() => {
    if (open) {
      setCreateBranch(true);
      setBranch("");
      setParent("");
    }
  }, [open]);
  const wtPath = useMemo(() => (parent ? childPath(parent, branch) : ""), [parent, branch]);
  if (!open) return null;
  const branchValid = createBranch ? !validateGitRefName(branch) : localBranches.includes(branch);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-label="Create worktree"
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-bd px-4 py-3 text-[14px] font-bold">Create worktree</div>
        <div className="flex flex-col gap-3 px-4 py-4 text-[12px]">
          <div className="flex rounded border border-bd2 bg-panel2 p-0.5">
            <button
              className="flex-1 rounded border-0 px-3 py-1.5"
              style={{ background: createBranch ? "var(--active)" : "transparent" }}
              onClick={() => {
                setCreateBranch(true);
                setBranch("");
              }}
            >
              New branch
            </button>
            <button
              className="flex-1 rounded border-0 px-3 py-1.5"
              style={{ background: !createBranch ? "var(--active)" : "transparent" }}
              onClick={() => {
                setCreateBranch(false);
                setBranch(localBranches[0] ?? "");
              }}
            >
              Existing branch
            </button>
          </div>
          <label className="flex flex-col gap-1 text-tx2">
            <span>{createBranch ? "New branch name" : "Local branch"}</span>
            {createBranch ? (
              <ValidatedRefInput
                value={branch}
                onChange={setBranch}
                placeholder="feature/my-work"
                autoFocus
              />
            ) : (
              <select
                className="input"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              >
                <option value="">Select a branch…</option>
                {localBranches.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div>
            <div className="mb-1 text-tx2">Parent folder</div>
            <div className="flex gap-2">
              <input
                readOnly
                className="input min-w-0 flex-1 font-mono"
                value={parent}
                placeholder="Choose where the worktree folder will be created"
              />
              <ActionButton
                onClick={async () => {
                  const selected = await pickFolder();
                  if (selected) setParent(selected);
                }}
              >
                Choose folder…
              </ActionButton>
            </div>
          </div>
          <div className="rounded border border-bd bg-bg px-3 py-2">
            <div className="mb-1 text-[10px] font-bold text-tx3">NEW WORKTREE PATH</div>
            <div className="break-all font-mono text-[11px] text-tx2">
              {wtPath || "Choose a parent folder and branch"}
            </div>
          </div>
          <div className="rounded border border-bd bg-bg px-3 py-2">
            <div className="mb-1 text-[10px] font-bold text-tx3">COMMAND PREVIEW</div>
            <code className="break-all text-[11px] text-tx2">
              git worktree add {createBranch ? `-b ${branch || "<new-branch>"} ` : ""}
              {wtPath || "<path>"}
              {!createBranch ? ` ${branch || "<branch>"}` : ""}
            </code>
          </div>
          <div className="text-[10.5px] text-tx3">
            Source repository: <span className="font-mono">{repoPath}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <ActionButton onClick={onCancel}>Cancel</ActionButton>
          <ActionButton
            icon="plus"
            variant="primary"
            disabled={!branchValid || !wtPath || busy}
            onClick={() => onCreate({ wtPath, branch: branch.trim(), create: createBranch })}
          >
            {busy ? "Creating…" : "Create worktree"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
