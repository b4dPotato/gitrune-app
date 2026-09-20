import { useEffect, useMemo, useRef } from "react";
import { useToast } from "./Toast";
import { rank } from "../lib/fuzzy";
import { ipc, isDemo } from "../lib/ipc";
import {
  useCurrentRepo,
  useFetchRepo,
  usePull,
  usePush,
  useRemotes,
  useRepos,
  useStatus,
} from "../lib/hooks";
import type { PaletteCommand } from "../lib/types";
import { useApp, useDispatch, useSet } from "../state/store";
import { hasActiveBranch } from "../features/sync/syncState";
import { useOperationRunner } from "../lib/useOperationRunner";

export function CommandPalette() {
  const s = useApp();
  const dispatch = useDispatch();
  const set = useSet();
  const toast = useToast();
  const run = useOperationRunner();
  const { data: repos = [] } = useRepos();
  const repo = useCurrentRepo();
  const { data: status } = useStatus(repo?.path);
  const { data: remotes = [] } = useRemotes(repo?.path);
  const fetchMut = useFetchRepo(repo?.path);
  const pushMut = usePush(repo?.path);
  const pullMut = usePull(repo?.path);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: PaletteCommand[] = useMemo(() => {
    const open = (target: "editor" | "terminal") => {
      if (!repo) return;
      ipc.openPath(repo.path, target).catch((e) => toast(e, "error"));
    };
    return [
      {
        label: "Go to Overview",
        glyph: "▦",
        group: "Navigate",
        act: () => dispatch({ type: "nav", view: "overview" }),
      },
      {
        label: "Go to Changes",
        glyph: "±",
        group: "Navigate",
        key: "G C",
        act: () => dispatch({ type: "nav", view: "changes" }),
      },
      {
        label: "Go to Commit Graph",
        glyph: "⌥",
        group: "Navigate",
        key: "G G",
        act: () => dispatch({ type: "nav", view: "graph" }),
      },
      {
        label: "Go to Branches",
        glyph: "⎇",
        group: "Navigate",
        act: () => dispatch({ type: "nav", view: "branches" }),
      },
      ...(isDemo()
        ? [
            {
              label: "Go to Pull Requests preview",
              glyph: "⇄",
              group: "Navigate" as const,
              key: "G P",
              act: () => dispatch({ type: "nav", view: "prs" }),
            },
          ]
        : []),
      {
        label: "Go to Worktrees",
        glyph: "⧉",
        group: "Navigate",
        act: () => dispatch({ type: "nav", view: "worktrees" }),
      },
      {
        label: "Go to Stashes",
        glyph: "≣",
        group: "Navigate",
        act: () => dispatch({ type: "nav", view: "stashes" }),
      },
      {
        label: "Go to Conflicts",
        glyph: "⚠",
        group: "Navigate",
        warn: true,
        act: () => dispatch({ type: "nav", view: "conflicts" }),
      },
      {
        label: "Go to Operation Log",
        glyph: "❯",
        group: "Navigate",
        act: () => dispatch({ type: "nav", view: "oplog" }),
      },
      ...(isDemo()
        ? [
            {
              label: "Accounts preview",
              glyph: "@",
              group: "Navigate" as const,
              act: () => dispatch({ type: "nav", view: "accounts" }),
            },
          ]
        : []),
      {
        label: "All Repositories",
        glyph: "▣",
        group: "Navigate",
        act: () => dispatch({ type: "nav", view: "workspace" }),
      },
      ...(hasActiveBranch(status) && remotes.length === 0
        ? [
            {
              label: "Set up Git remote…",
              glyph: "+",
              group: "Git" as const,
              act: () => {
                dispatch({ type: "nav", view: "overview" });
                set({ remoteSetupRequest: Date.now() });
              },
            },
          ]
        : []),
      ...(hasActiveBranch(status) && remotes.length > 0
        ? [
            {
              label: "Fetch all remotes",
              glyph: "↻",
              group: "Git" as const,
              key: "⌘⇧F",
              act: () => run(fetchMut.mutateAsync(undefined), "Fetched all remotes"),
            },
          ]
        : []),
      ...(status?.upstream && status.behind > 0
        ? [
            {
              label: "Pull with rebase",
              glyph: "↓",
              group: "Git" as const,
              act: () => run(pullMut.mutateAsync(true), "Pulled with rebase"),
            },
          ]
        : []),
      ...(status?.upstream && status.ahead > 0
        ? [
            {
              label: "Push",
              glyph: "↑",
              group: "Git" as const,
              key: "⌘P",
              act: () => run(pushMut.mutateAsync({}), "Pushed"),
            },
          ]
        : []),
      {
        label: "Commit staged changes",
        glyph: "✓",
        group: "Git",
        key: "⌘↵",
        act: () => dispatch({ type: "nav", view: "changes" }),
      },
      {
        label: "Create worktree…",
        glyph: "⧉",
        group: "Git",
        act: () => dispatch({ type: "nav", view: "worktrees" }),
      },
      {
        label: "Add repository…",
        glyph: "＋",
        group: "Repository",
        act: () => set({ addRepoOpen: true }),
      },
      ...repos.map((r, i): PaletteCommand => ({
        label: `Switch repository: ${r.name}`,
        glyph: "▤",
        group: "Repository",
        act: () => dispatch({ type: "pickRepo", index: i }),
      })),
      {
        label: "Toggle light/dark theme",
        glyph: "◐",
        group: "App",
        act: () => dispatch({ type: "toggleTheme" }),
      },
      {
        label: "Open repository in editor",
        glyph: "⌥",
        group: "App",
        key: "⌘E",
        act: () => open("editor"),
      },
      {
        label: "Open repository in terminal",
        glyph: "❯",
        group: "App",
        key: "⌘T",
        act: () => open("terminal"),
      },
      {
        label: "Open settings",
        glyph: "⚙",
        group: "App",
        key: "⌘,",
        act: () => set({ settingsOpen: true }),
      },
    ];
  }, [dispatch, set, repos, repo, status, remotes, toast, run, fetchMut, pullMut, pushMut]);

  const results = useMemo(
    () => rank(s.paletteQuery, commands, (c) => c.label, 9),
    [s.paletteQuery, commands],
  );
  const idx = Math.min(s.paletteIdx, Math.max(0, results.length - 1));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") set({ paletteOpen: false });
      if (e.key === "ArrowDown") {
        e.preventDefault();
        set({ paletteIdx: Math.min(idx + 1, results.length - 1) });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        set({ paletteIdx: Math.max(0, idx - 1) });
      }
      if (e.key === "Enter") {
        const c = results[idx];
        if (c) {
          c.act();
          set({ paletteOpen: false });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, results, set]);

  return (
    <div
      onClick={() => set({ paletteOpen: false })}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 pt-[12vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[580px] max-w-[90vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-[0_16px_48px_rgba(0,0,0,.4)]"
      >
        <div className="focus-surface flex items-center gap-[9px] border-b border-bd px-[14px] py-[11px]">
          <span className="text-tx3">⌕</span>
          <input
            ref={inputRef}
            value={s.paletteQuery}
            onChange={(e) => set({ paletteQuery: e.target.value, paletteIdx: 0 })}
            placeholder="Type a command, branch, repository, or SHA…"
            className="flex-1 border-0 bg-transparent text-[14px] text-tx outline-none"
          />
          <span className="rounded-[4px] border border-bd px-[5px] py-px font-mono text-[10.5px] text-tx3">
            esc
          </span>
        </div>
        <div className="max-h-[380px] overflow-y-auto p-[6px]">
          {results.map((c, i) => (
            <div
              key={c.label}
              onClick={() => {
                c.act();
                set({ paletteOpen: false });
              }}
              onMouseEnter={() => set({ paletteIdx: i })}
              className="flex h-8 cursor-pointer items-center gap-[10px] rounded px-[10px]"
              style={{ background: i === idx ? "var(--active)" : "transparent" }}
            >
              <span
                className="w-4 text-center text-[12px]"
                style={{
                  color: c.warn ? "var(--wn)" : i === idx ? "var(--actx)" : "var(--tx3)",
                }}
              >
                {c.glyph}
              </span>
              <span
                className="flex-1 text-[13px]"
                style={{ color: i === idx ? "var(--tx)" : "var(--tx2)" }}
              >
                {c.label}
              </span>
              <span className="text-[11px] text-tx3">{c.group}</span>
              {c.key && (
                <span className="rounded-[4px] border border-bd px-[6px] py-px font-mono text-[10.5px] text-tx3">
                  {c.key}
                </span>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <div className="p-5 text-center text-[12.5px] text-tx3">
              No matching commands. Try “branch”, “push”, “worktree”…
            </div>
          )}
        </div>
        <div className="flex gap-[14px] border-t border-bd px-[14px] py-[7px] text-[11px] text-tx3">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
