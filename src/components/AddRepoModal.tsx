import { useState } from "react";
import { useToast } from "./Toast";
import { ErrorNotice } from "./ErrorNotice";
import { useAddRepo, useCloneRepo, useInitRepo } from "../lib/hooks";
import { operationError, pickFolder } from "../lib/ipc";
import { REPOSITORY_COLORS } from "../lib/palettes";
import { useApp, useSet } from "../state/store";

export function AddRepoModal() {
  const s = useApp();
  const set = useSet();
  const toast = useToast();
  const addRepo = useAddRepo();
  const cloneRepo = useCloneRepo();
  const initRepo = useInitRepo();
  const [error, setError] = useState<unknown>(null);
  const [cloneUrl, setCloneUrl] = useState("");
  const close = () => set({ addRepoOpen: false });
  const color = REPOSITORY_COLORS[s.addColor];

  const browse = async () => {
    setError(null);
    try {
      const path = await pickFolder();
      if (!path) return;
      await addRepo.mutateAsync({ path, color });
      toast(`Added ${path}`, "ok");
      close();
    } catch (e) {
      setError(e);
    }
  };

  const doClone = async () => {
    setError(null);
    if (!cloneUrl.trim()) {
      setError("Enter a clone URL first.");
      return;
    }
    try {
      const parentDir = await pickFolder();
      if (!parentDir) return;
      const res = await cloneRepo.mutateAsync({ url: cloneUrl.trim(), parentDir });
      if (!res.success) {
        setError(operationError(res, "Clone failed"));
        return;
      }
      // register the fresh clone
      const name =
        cloneUrl
          .trim()
          .replace(/\.git$/, "")
          .split("/")
          .pop() ?? "";
      const sep = parentDir.includes("\\") ? "\\" : "/";
      await addRepo.mutateAsync({ path: `${parentDir}${sep}${name}`, color });
      toast(`Cloned ${name}`, "ok");
      close();
    } catch (e) {
      setError(e);
    }
  };

  const doInit = async () => {
    setError(null);
    try {
      const dir = await pickFolder();
      if (!dir) return;
      const res = await initRepo.mutateAsync(dir);
      if (!res.success) {
        setError(operationError(res, "Repository initialization failed"));
        return;
      }
      await addRepo.mutateAsync({ path: dir, color });
      toast(`Initialized repository in ${dir}`, "ok");
      close();
    } catch (e) {
      setError(e);
    }
  };

  const busy = addRepo.isPending || cloneRepo.isPending || initRepo.isPending;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add repository"
        className="w-[540px] max-w-[92vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-[0_16px_48px_rgba(0,0,0,.4)]"
      >
        <div className="px-4 pb-[10px] pt-[14px] text-[14px] font-bold">Add repository</div>
        <div className="flex flex-col gap-2 px-4 pb-1">
          <div
            onClick={busy ? undefined : browse}
            className="flex cursor-pointer items-center gap-[11px] rounded-md border border-acbd bg-acbg px-3 py-[10px]"
          >
            <span className="w-4 text-center text-[13px] text-actx">▤</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold">Open local repository</div>
              <div className="text-[11.5px] text-tx3">
                Point at an existing folder that contains a Git repository
              </div>
            </div>
            <button disabled={busy} className="btn-sm flex-none bg-panel2 px-[11px] text-tx">
              {addRepo.isPending ? "Validating…" : "Browse…"}
            </button>
          </div>

          <div className="rounded-md border border-bd px-3 py-[10px]">
            <div className="mb-2 flex items-center gap-[11px]">
              <span className="w-4 text-center text-[13px] text-tx3">↓</span>
              <div className="min-w-0 flex-1 text-[12.5px] font-semibold">Clone from URL</div>
              <button
                onClick={doClone}
                disabled={busy}
                className="btn-sm flex-none bg-panel2 px-[11px] text-tx"
              >
                {cloneRepo.isPending ? "Cloning…" : "Clone…"}
              </button>
            </div>
            <input
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              placeholder="git@github.com:acme-inc/repository.git"
              className="input w-full font-mono"
            />
            <div className="mt-[6px] text-[11px] text-tx2">
              Uses your system git — existing SSH keys and credential helpers apply. You pick the
              destination folder next.
            </div>
          </div>

          <div className="flex items-center gap-[11px] rounded-md border border-bd px-3 py-[10px]">
            <span className="w-4 text-center text-[13px] text-tx3">＋</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold">Initialize new repository</div>
              <div className="text-[11.5px] text-tx3">Run git init in a folder and register it</div>
            </div>
            <button
              onClick={doInit}
              disabled={busy}
              className="btn-sm flex-none bg-panel2 px-[11px] text-tx"
            >
              {initRepo.isPending ? "Initializing…" : "Choose folder…"}
            </button>
          </div>

          <ErrorNotice error={error} />
        </div>

        <div className="flex items-center gap-[10px] px-4 pb-[14px] pt-3">
          <span className="w-24 flex-none text-[11.5px] text-tx3">Color</span>
          {REPOSITORY_COLORS.map((c, i) => (
            <button
              key={c}
              onClick={() => set({ addColor: i })}
              aria-label="Repository color"
              className="h-5 w-5 cursor-pointer rounded-md border-0 p-0"
              style={{
                background: c,
                outline: s.addColor === i ? "2px solid var(--tx)" : "2px solid transparent",
                outlineOffset: 2,
              }}
            />
          ))}
          <span className="text-[11px] text-tx3">shown in the sidebar and repository switcher</span>
        </div>

        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <button
            onClick={close}
            className="cursor-pointer rounded border border-bd2 bg-transparent px-[14px] py-[5px] text-[12.5px] text-tx hover:bg-hov"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
