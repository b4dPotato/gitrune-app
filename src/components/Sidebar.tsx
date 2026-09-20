import { isDemo, type RepoStatus } from "../lib/ipc";
import { useRepos } from "../lib/hooks";
import type { ViewId } from "../lib/types";
import { useApp, useDispatch, useSet } from "../state/store";
import { useTranslation } from "react-i18next";

interface NavItem {
  id: ViewId;
  label: string;
  glyph: string;
  badge?: string;
  badgeWarn?: boolean;
}

export function Sidebar({ status }: { status: RepoStatus | undefined }) {
  const { t } = useTranslation();
  const s = useApp();
  const dispatch = useDispatch();
  const set = useSet();
  const { data: repos = [] } = useRepos();
  const expanded = !s.sbCollapsed;
  const width = s.sbCollapsed ? 60 : Math.min(340, Math.max(180, s.sbW));

  const conflicts = status?.files.filter((f) => f.conflicted).length ?? 0;
  const nav: NavItem[] = [
    { id: "overview", label: t("nav.overview"), glyph: "▦" },
    {
      id: "changes",
      label: t("nav.changes"),
      glyph: "±",
      badge: status && status.dirty > 0 ? String(status.dirty) : undefined,
    },
    { id: "graph", label: t("nav.commitGraph"), glyph: "⌥" },
    { id: "branches", label: t("nav.branches"), glyph: "⎇" },
    ...(isDemo()
      ? [{ id: "prs" as ViewId, label: t("nav.pullRequestsPreview"), glyph: "⇄", badge: "4" }]
      : []),
    { id: "worktrees", label: t("nav.worktrees"), glyph: "⧉" },
    { id: "stashes", label: t("nav.stashes"), glyph: "≣" },
    ...(conflicts > 0 || status?.operation
      ? [
          {
            id: "conflicts" as ViewId,
            label: t("nav.conflicts"),
            glyph: "⚠",
            badge: String(conflicts || ""),
            badgeWarn: true,
          },
        ]
      : [{ id: "conflicts" as ViewId, label: t("nav.conflicts"), glyph: "⚠" }]),
    { id: "oplog", label: t("nav.operationLog"), glyph: "❯" },
  ];
  const foot: NavItem[] = [{ id: "accounts", label: t("nav.gitProfiles"), glyph: "@" }];

  const navRow = (n: NavItem) => {
    const active = s.view === n.id;
    return (
      <button
        type="button"
        key={n.id}
        onClick={() => dispatch({ type: "nav", view: n.id })}
        title={n.label}
        aria-current={active ? "page" : undefined}
        className="flex h-9 w-full cursor-pointer items-center gap-[10px] rounded-md border-0 px-2 text-left hover:bg-hov"
        style={{
          background: active ? "var(--active)" : "transparent",
          color: active ? "var(--tx)" : "var(--tx2)",
        }}
      >
        <span
          aria-hidden
          className="w-[18px] text-center text-[16px] leading-none"
          style={{
            color:
              n.id === "conflicts" && n.badgeWarn
                ? "var(--wn)"
                : active
                  ? "var(--actx)"
                  : "var(--tx3)",
          }}
        >
          {n.glyph}
        </span>
        {expanded && (
          <>
            <span className="flex-1 text-[12.5px]" style={{ fontWeight: active ? 600 : 400 }}>
              {n.label}
            </span>
            {n.badge && (
              <span
                className="rounded-lg px-[7px] py-px font-mono text-[10.5px]"
                style={{
                  color: n.badgeWarn ? "var(--wn)" : "var(--tx2)",
                  background: n.badgeWarn ? "var(--wnbg)" : "var(--panel2)",
                }}
              >
                {n.badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <div
      className="flex min-h-0 flex-none flex-col overflow-hidden border-r border-bd bg-panel transition-[width] duration-150"
      style={{ width }}
    >
      <div className="flex-none px-[10px] pb-1 pt-[10px]">
        {expanded && (
          <div className="flex items-center px-[6px] pb-1">
            <span className="text-[10px] font-bold tracking-[.08em] text-tx3">
              {t("nav.repositories").toUpperCase()}
            </span>
            <span className="flex-1" />
            <button
              onClick={() => set({ addRepoOpen: true })}
              title={t("nav.addRepository")}
              aria-label={t("nav.addRepository")}
              className="h-[17px] w-[17px] cursor-pointer rounded-[4px] border border-bd2 bg-transparent p-0 text-[11px] leading-[14px] text-tx3 hover:border-acbd hover:text-actx"
            >
              ＋
            </button>
          </div>
        )}
        {repos.length === 0 && expanded && (
          <div className="px-2 py-1 text-[11.5px] text-tx3">{t("nav.noRepositories")}</div>
        )}
        {repos.map((r, i) => {
          const active = s.repo === i;
          return (
            <button
              type="button"
              key={r.id}
              onClick={() => dispatch({ type: "pickRepo", index: i })}
              title={r.path}
              aria-current={active ? "true" : undefined}
              className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border-0 px-2 text-left hover:bg-hov"
              style={{
                background: active ? "var(--active)" : "transparent",
                color: active ? "var(--tx)" : "var(--tx2)",
              }}
            >
              <span
                className="mx-[3px] h-3 w-3 flex-none rounded-[3px]"
                style={{ background: r.color }}
              />
              {expanded && (
                <>
                  <span
                    className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]"
                    style={{ fontWeight: active ? 600 : 400 }}
                  >
                    {r.name}
                  </span>
                  {active && status && status.dirty > 0 && (
                    <span className="rounded-lg border border-bd bg-panel2 px-[6px] font-mono text-[10.5px] text-tx2">
                      {status.dirty}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mx-[10px] my-[6px] h-px bg-bd" />

      <div className="flex-1 overflow-y-auto px-[10px] py-[2px]">{nav.map(navRow)}</div>

      <div className="flex-none border-t border-bd px-[10px] py-2">
        {foot.map(navRow)}
        <button
          type="button"
          onClick={() => set({ sbCollapsed: !s.sbCollapsed })}
          title={s.sbCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          aria-expanded={!s.sbCollapsed}
          className="flex h-9 w-full cursor-pointer items-center gap-[10px] rounded-md border-0 bg-transparent px-2 text-left text-tx3 hover:bg-hov hover:text-tx"
        >
          <span aria-hidden className="w-[18px] text-center text-[16px] leading-none">
            {s.sbCollapsed ? "»" : "«"}
          </span>
          {expanded && <span className="flex-1 text-[12.5px]">{t("nav.collapse")}</span>}
        </button>
      </div>
    </div>
  );
}
