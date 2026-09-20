import { Dropdown, type MenuItem } from "./Dropdown";
import type { RepoRecord, RepoStatus } from "../lib/ipc";
import { isDemo } from "../lib/ipc";
import {
  useCheckout,
  useFetchRepo,
  useIdentity,
  usePull,
  usePush,
  useRefs,
  useRemotes,
  useRepos,
} from "../lib/hooks";
import { useApp, useDispatch, useSet } from "../state/store";
import { useState } from "react";
import { ConfirmActionModal } from "./ui/ConfirmActionModal";
import { SyncActionButton } from "../features/sync/SyncActionButton";
import { NewBranchModal } from "../features/branches/NewBranchModal";
import { hasActiveBranch, syncActionState } from "../features/sync/syncState";
import { useTranslation } from "react-i18next";
import { useOperationRunner } from "../lib/useOperationRunner";
import { ProfileSwitcher } from "../features/identity/ProfileSwitcher";

export function TopBar({
  winW,
  identityWarn,
  repo,
  status,
}: {
  winW: number;
  identityWarn: boolean;
  repo: RepoRecord | undefined;
  status: RepoStatus | undefined;
}) {
  const { t } = useTranslation();
  const s = useApp();
  const set = useSet();
  const dispatch = useDispatch();
  const run = useOperationRunner();
  const { data: repos = [] } = useRepos();
  const { data: refs = [] } = useRefs(repo?.path);
  const { data: remotes = [], isLoading: remotesLoading } = useRemotes(repo?.path);
  const fetchMut = useFetchRepo(repo?.path);
  const pushMut = usePush(repo?.path);
  const pullMut = usePull(repo?.path);
  const checkout = useCheckout(repo?.path);
  const { data: identity } = useIdentity(repo?.path);
  const [forcePushConfirm, setForcePushConfirm] = useState(false);
  const [newBranchOpen, setNewBranchOpen] = useState(false);

  const showIdentity = winW >= 1150;
  const branch = status?.branch ?? "…";
  const ahead = status?.ahead ?? 0;
  const behind = status?.behind ?? 0;
  const activeBranch = hasActiveBranch(status);
  const hasRemote = remotes.length > 0;
  const smartSync = syncActionState(status, hasRemote);
  const syncItems: MenuItem[] = status?.upstream
    ? [
        ...(ahead > 0
          ? [
              {
                label: `Push ${ahead} commit${ahead === 1 ? "" : "s"}`,
                glyph: "↑",
                onClick: () => run(pushMut.mutateAsync({}), "Pushed"),
              },
              {
                label: "Force push with lease…",
                glyph: "⚠",
                danger: true,
                hint: "Never plain --force",
                onClick: () => setForcePushConfirm(true),
              },
            ]
          : []),
        ...(behind > 0
          ? [
              {
                label: `Pull with rebase (↓${behind})`,
                glyph: "↓",
                onClick: () => run(pullMut.mutateAsync(true), "Pulled with rebase"),
              },
              {
                label: "Pull with merge",
                glyph: "↓",
                onClick: () => run(pullMut.mutateAsync(false), "Pulled with merge"),
              },
            ]
          : []),
      ]
    : [];

  const repoItems: MenuItem[] = [
    ...repos.map((r, i): MenuItem => ({
      label: r.name,
      glyph: "▤",
      active: repo?.id === r.id,
      onClick: () => dispatch({ type: "pickRepo", index: i }),
    })),
    {
      label: "Add repository…",
      glyph: "＋",
      onClick: () => set({ addRepoOpen: true }),
    },
  ];

  const branchItems: MenuItem[] = [
    ...refs
      .filter((r) => r.kind === "local")
      .map((b): MenuItem => ({
        label: b.name,
        glyph: "⎇",
        mono: true,
        active: b.isHead,
        onClick: () => {
          if (b.isHead) return;
          run(checkout.mutateAsync(b.name), `Switched to ${b.name}`);
        },
      })),
    {
      label: t("nav.newBranch"),
      glyph: "+",
      onClick: () => setNewBranchOpen(true),
    },
    {
      label: t("nav.manageBranches"),
      glyph: "▤",
      onClick: () => dispatch({ type: "nav", view: "branches" }),
    },
  ];

  return (
    <>
      <div className="flex h-[42px] flex-none items-center gap-2 border-b border-bd bg-panel px-3">
        <img
          src={`${import.meta.env.BASE_URL}brand/${s.theme === "light" ? "mark-on-light.svg" : "mark.svg"}`}
          alt="Gitrune"
          title="Gitrune"
          width={22}
          height={22}
          className="h-[22px] w-[22px] flex-none"
        />
        <div className="flex min-w-0 flex-initial items-center gap-[2px]">
          <button
            onClick={() => dispatch({ type: "nav", view: "workspace" })}
            title={t("nav.allRepositories")}
            aria-label={t("nav.allRepositories")}
            className="mr-1 flex h-7 cursor-pointer items-center gap-[6px] whitespace-nowrap rounded border border-bd2 bg-panel2 px-[9px] text-[12px] text-tx2 hover:bg-hov hover:text-tx"
            style={{
              background: s.view === "workspace" ? "var(--active)" : "var(--panel2)",
              color: s.view === "workspace" ? "var(--actx)" : undefined,
            }}
          >
            <span aria-hidden className="text-[13px] leading-none">
              ▣
            </span>
            <span>{t("nav.allRepositories")}</span>
          </button>
          <Dropdown
            header={t("nav.repositories").toUpperCase()}
            items={repoItems}
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                className="flex cursor-pointer items-center gap-[6px] rounded border-0 px-2 py-1 text-[12px] font-semibold text-tx hover:bg-hov"
                style={{ background: open ? "var(--active)" : "transparent" }}
              >
                <span
                  className="h-2 w-2 flex-none rounded-[2px]"
                  style={{ background: repo?.color ?? "#5f9df6" }}
                />
                {repo?.name ?? t("common.noRepository")}{" "}
                <span className="text-[10px] text-tx3">⌄</span>
              </button>
            )}
          />
          <Dropdown
            header={t("nav.switchBranch").toUpperCase()}
            items={branchItems}
            width={280}
            searchPlaceholder={t("nav.searchBranches")}
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                title={t("nav.switchBranch")}
                className="ml-1 flex cursor-pointer items-center gap-[5px] rounded border border-bd2 px-[9px] py-1 font-mono text-[12px] text-tx hover:bg-hov"
                style={{ background: open ? "var(--active)" : "var(--panel2)" }}
              >
                ⎇ {branch} <span className="text-[10px] text-tx3">⌄</span>
              </button>
            )}
          />
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <button
            onClick={() => set({ paletteOpen: true, paletteQuery: "", paletteIdx: 0 })}
            aria-label={t("topbar.searchLabel")}
            className="flex min-w-[100px] basis-[340px] cursor-pointer items-center gap-2 rounded-md border border-bd bg-bg px-[10px] py-[5px] text-[12px] text-tx3 hover:border-bd2 hover:text-tx2"
          >
            <span>⌕</span>
            <span className="flex-1 text-left">{t("topbar.search")}</span>
            <span className="rounded-[4px] border border-bd2 px-[5px] font-mono text-[11px] text-tx3">
              ⌘K
            </span>
          </button>
        </div>

        {activeBranch && hasRemote && (
          <button
            onClick={() => run(fetchMut.mutateAsync(undefined), t("topbar.fetched"))}
            disabled={fetchMut.isPending}
            className="btn flex items-center gap-[6px] disabled:opacity-50"
          >
            <span className={fetchMut.isPending ? "gspin" : ""}>↻</span> {t("topbar.fetch")}
          </button>
        )}
        {activeBranch && !remotesLoading && (
          <SyncActionButton repoPath={repo?.path} status={status} size="sm" />
        )}
        {activeBranch && hasRemote && smartSync.visible && syncItems.length > 0 && (
          <Dropdown
            header={t("topbar.syncOptions").toUpperCase()}
            width={260}
            items={syncItems}
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                title={t("topbar.moreSync")}
                aria-label={t("topbar.moreSync")}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-bd2 text-[12px] text-tx2 hover:bg-hov"
                style={{ background: open ? "var(--active)" : "var(--panel2)" }}
              >
                <span className="text-[11px]">⌄</span>
              </button>
            )}
          />
        )}

        <div className="mx-[2px] h-5 w-px bg-bd" />

        {isDemo() && (
          <button
            title={t("topbar.accountPreview")}
            onClick={() => dispatch({ type: "nav", view: "accounts" })}
            className="flex cursor-pointer items-center gap-[7px] rounded border py-1 pl-[5px] pr-[9px] text-[12px] text-tx hover:brightness-110"
            style={{ borderColor: "var(--bd2)", background: "var(--panel2)" }}
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-inf text-[9px] font-bold text-white">
              @
            </span>
            {t("topbar.demoAccount")}
          </button>
        )}
        {repo && (
          <ProfileSwitcher
            repo={repo}
            identity={identity}
            warning={identityWarn}
            showLabel={showIdentity}
          />
        )}

        <button
          onClick={() => set({ theme: s.theme === "dark" ? "light" : "dark" })}
          aria-label={t("topbar.toggleTheme")}
          title={t("topbar.toggleTheme")}
          className="icon-btn"
        >
          ◐
        </button>
        <button
          aria-label={t("common.settings")}
          title={t("common.settings")}
          onClick={() => set({ settingsOpen: true })}
          className="icon-btn"
        >
          ⚙
        </button>
      </div>
      <ConfirmActionModal
        open={forcePushConfirm}
        title="Rewrite the remote branch?"
        description="This can replace remote history. The lease refuses the push if the remote changed since your last fetch."
        command="git push --force-with-lease"
        confirmLabel="Force push with lease"
        busy={pushMut.isPending}
        onCancel={() => setForcePushConfirm(false)}
        onConfirm={() => {
          setForcePushConfirm(false);
          void run(pushMut.mutateAsync({ forceWithLease: true }), "Force-pushed with lease");
        }}
      />
      <NewBranchModal
        open={newBranchOpen}
        repoPath={repo?.path}
        onClose={() => setNewBranchOpen(false)}
      />
    </>
  );
}
