import { useToast } from "../components/Toast";
import { ipc } from "../lib/ipc";
import { useInvalidateRepo, useRepos } from "../lib/hooks";
import { useDispatch } from "../state/store";
import { RepositoryRow } from "../features/repositories/RepositoryRow";
import { EmptyState } from "../components/layout/EmptyState";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { ActionButton } from "../components/ui/ActionButton";
import { useTranslation } from "react-i18next";

export function WorkspaceView() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const toast = useToast();
  const { data: repos = [] } = useRepos();
  const invalidate = useInvalidateRepo();

  const fetchAll = async () => {
    if (repos.length === 0) return;
    toast(`Fetching ${repos.length} repositories…`, "info");
    const results = await Promise.allSettled(repos.map((r) => ipc.fetch(r.path)));
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
    ).length;
    invalidate();
    if (failed === 0) toast("Fetched all repositories", "ok");
    else toast(`Fetch finished — ${failed} of ${repos.length} failed (see Operation Log)`, "warn");
  };

  const openAll = async () => {
    for (const r of repos) {
      try {
        await ipc.openPath(r.path, "editor");
      } catch (e) {
        toast(e, "error");
        return;
      }
    }
    toast("Opened all repositories in editor", "ok");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title={`▣ ${t("nav.allRepositories")}`}
        meta={t("repositories.count", { count: repos.length })}
        actions={
          <>
            <ActionButton icon="sync" disabled={repos.length === 0} onClick={() => void fetchAll()}>
              {t("repositories.fetchAll")}
            </ActionButton>
            <ActionButton
              icon="editor"
              disabled={repos.length === 0}
              onClick={() => void openAll()}
            >
              {t("repositories.openAll")}
            </ActionButton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-[14px] py-3">
        <div className="card">
          <div className="flex h-[26px] items-center border-b border-bd px-3 text-[10.5px] font-bold tracking-[.05em] text-tx3">
            <span className="w-[170px] flex-none">REPOSITORY</span>
            <span className="flex-1">BRANCH</span>
            <span className="w-[70px] flex-none">DIRTY</span>
            <span className="w-[70px] flex-none">SYNC</span>
            <span className="w-[60px] flex-none" />
          </div>
          {repos.map((r, i) => (
            <RepositoryRow
              key={r.id}
              repo={r}
              index={i}
              onOpen={(index) => dispatch({ type: "pickRepo", index })}
            />
          ))}
          {repos.length === 0 && <EmptyState>{t("repositories.empty")}</EmptyState>}
        </div>
      </div>
    </div>
  );
}
