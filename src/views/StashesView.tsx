import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/layout/EmptyState";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { StashActions } from "../features/stashes/StashActions";
import { useCurrentRepo, useStashBranch, useStashDetail, useStashes } from "../lib/hooks";
import { useOperationRunner } from "../lib/useOperationRunner";

export function StashesView() {
  const { t } = useTranslation();
  const repo = useCurrentRepo();
  const run = useOperationRunner();
  const { data: stashes = [] } = useStashes(repo?.path);
  const stashBranch = useStashBranch(repo?.path);
  const [selected, setSelected] = useState<number | null>(null);
  const { data: detail } = useStashDetail(repo?.path, selected);
  const [branchName, setBranchName] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader meta={t("stashes.count", { count: stashes.length })} />
      <div className="flex-1 overflow-y-auto px-[14px] py-3">
        <div className="card">
          {stashes.map((stash, index) => (
            <div key={stash.id} className="border-b border-bd">
              <div className="flex min-h-[38px] items-center gap-[10px] px-3 hover:bg-hov">
                <button
                  onClick={() => setSelected(selected === index ? null : index)}
                  className="border-0 bg-transparent text-[11px] text-tx3"
                >
                  {selected === index ? "▾" : "▸"}
                </button>
                <span className="font-mono text-[11px] text-tx3">{stash.id}</span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]">
                  {stash.msg}
                </span>
                <span className="text-[11px] text-tx3">{stash.time}</span>
                <StashActions repoPath={repo?.path} index={index} stashId={stash.id} />
              </div>
              {selected === index && (
                <div className="bg-bg px-10 py-3">
                  <div className="mb-2 flex gap-2">
                    <input
                      value={branchName}
                      onChange={(event) => setBranchName(event.target.value)}
                      placeholder="New branch name"
                      className="input w-64"
                    />
                    <button
                      disabled={!branchName.trim() || stashBranch.isPending}
                      onClick={() =>
                        run(
                          stashBranch.mutateAsync({ index, branch: branchName.trim() }),
                          `Created ${branchName.trim()} from stash`,
                        )
                      }
                      className="btn-sm disabled:opacity-50"
                    >
                      Create branch from stash
                    </button>
                  </div>
                  <div className="mb-1 text-[11px] font-bold text-tx3">FILES</div>
                  <div className="mb-2 font-mono text-[11px] text-tx2">
                    {detail?.files
                      .map(
                        (file) =>
                          `${file.status}  ${file.oldPath ? `${file.oldPath} → ` : ""}${file.path}`,
                      )
                      .join("\n") || "Loading…"}
                  </div>
                  {detail?.patch && (
                    <pre className="max-h-80 overflow-auto whitespace-pre border border-bd bg-panel p-3 text-[11px] text-tx2">
                      {detail.patch}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
          {stashes.length === 0 && <EmptyState>{t("stashes.empty")}</EmptyState>}
        </div>
      </div>
    </div>
  );
}
