import type { CommitRecord, RepoStatus } from "../../lib/ipc";
import type { RefInfo, StashInfo } from "../../lib/gitparse";
import { trackToSync } from "../../lib/gitparse";
import type { ViewId } from "../../lib/types";
import { SyncActionButton } from "../sync/SyncActionButton";
import { syncActionState } from "../sync/syncState";

export function RepositoryOverviewCards({
  repoPath,
  status,
  hasRemote,
  localBranches,
  stashes,
  syncCommits,
  pulling,
  onPullMerge,
  onNavigate,
}: {
  repoPath?: string;
  status?: RepoStatus;
  hasRemote: boolean;
  localBranches: RefInfo[];
  stashes: StashInfo[];
  syncCommits?: { outgoing: CommitRecord[]; incoming: CommitRecord[] };
  pulling: boolean;
  onPullMerge: () => void;
  onNavigate: (view: ViewId) => void;
}) {
  const syncState = syncActionState(status, hasRemote);
  const conflicted = status?.files.filter((file) => file.conflicted).length ?? 0;
  return (
    <div className="grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3">
      {hasRemote && (
        <OverviewCard
          title="SYNC"
          meta={
            <>
              <span className="text-actx">↑{status?.ahead ?? 0}</span> unpushed ·{" "}
              <span className="text-inf">↓{status?.behind ?? 0}</span> behind
            </>
          }
        >
          <div className="flex gap-2 px-3 py-[9px]">
            <SyncActionButton repoPath={repoPath} status={status} />
            {status?.upstream && status.behind > 0 && (
              <button
                type="button"
                onClick={onPullMerge}
                disabled={pulling}
                className="btn disabled:opacity-50"
              >
                Pull with merge
              </button>
            )}
            {!syncState.visible && status?.upstream && (
              <span className="flex items-center gap-1.5 text-[12px] text-tx2">
                <span className="text-ok">✓</span> Up to date
              </span>
            )}
            {!status?.upstream && !syncState.visible && (
              <span className="text-[12px] text-tx3">
                Create the first commit before publishing.
              </span>
            )}
          </div>
          {syncCommits?.outgoing.length || syncCommits?.incoming.length ? (
            <div className="max-h-36 overflow-auto border-t border-bd px-3 py-2 font-mono text-[10.5px]">
              {syncCommits.outgoing.map((commit) => (
                <div key={`out:${commit.sha}`} className="truncate text-actx">
                  ↑ {commit.sha.slice(0, 9)} {commit.subject}
                </div>
              ))}
              {syncCommits.incoming.map((commit) => (
                <div key={`in:${commit.sha}`} className="truncate text-inf">
                  ↓ {commit.sha.slice(0, 9)} {commit.subject}
                </div>
              ))}
            </div>
          ) : null}
        </OverviewCard>
      )}
      <OverviewCard
        title="WORKING TREE"
        meta={
          <button
            type="button"
            onClick={() => onNavigate("changes")}
            className="border-0 bg-transparent text-[11.5px] font-normal text-actx"
          >
            Open changes →
          </button>
        }
      >
        <div className="flex h-[30px] items-center gap-[10px] border-b border-bd px-3 text-[12.5px]">
          {status && status.dirty > 0 ? (
            <>
              <span className="text-wn">●</span> {status.dirty} changed{" "}
              {status.dirty === 1 ? "file" : "files"}
            </>
          ) : (
            <>
              <span className="text-ok">✓</span> clean
            </>
          )}
        </div>
        {stashes.slice(0, 2).map((stash) => (
          <button
            type="button"
            key={stash.id}
            onClick={() => onNavigate("stashes")}
            className="flex h-7 w-full cursor-pointer items-center gap-[10px] border-0 border-b border-bd bg-transparent px-3 text-left text-[12px] hover:bg-hov"
          >
            <span className="text-[11px] text-tx3">≣</span>
            <span className="font-mono text-[11px] text-tx3">{stash.id}</span>
            <span className="min-w-0 flex-1 truncate text-tx2">{stash.msg}</span>
            <span className="text-[11px] text-tx3">{stash.time}</span>
          </button>
        ))}
      </OverviewCard>
      <OverviewCard title="RECENT BRANCHES">
        {localBranches.map((branch) => (
          <button
            type="button"
            key={branch.name}
            onClick={() => onNavigate("branches")}
            className="flex min-h-8 w-full cursor-pointer items-center gap-2 border-0 border-b border-bd bg-transparent px-3 py-1 text-left text-[12px] hover:bg-hov"
          >
            <span
              className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-tx"
              title={branch.name}
            >
              ⎇ {branch.name}
            </span>
            {branch.isHead && <span className="flex-none text-actx">✓</span>}
            <span className="flex-none whitespace-nowrap font-mono text-[11px] text-tx3">
              {trackToSync(branch.track)}
            </span>
            <span
              className="w-[72px] flex-none truncate text-right text-[11px] text-tx3"
              title={branch.time}
            >
              {branch.time}
            </span>
          </button>
        ))}
        {localBranches.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-tx3">No branches yet.</div>
        )}
      </OverviewCard>
      <OverviewCard title="HEALTH">
        <HealthRow
          warning={!!status?.operation}
          onClick={status?.operation ? () => onNavigate("conflicts") : undefined}
        >
          {status?.operation ? (
            <>
              <span className="text-wn">⚠</span> {status.operation} in progress — resolve →
            </>
          ) : (
            <>
              <span className="text-ok">✓</span> No unfinished Git operation
            </>
          )}
        </HealthRow>
        <HealthRow warning={!status?.upstream}>
          {!hasRemote ? (
            <>
              <span className="text-wn">⚠</span> No remote configured
            </>
          ) : status?.upstream ? (
            <>
              <span className="text-ok">✓</span> Upstream configured
            </>
          ) : (
            <>
              <span className="text-wn">⚠</span> No upstream — publish when ready
            </>
          )}
        </HealthRow>
        <HealthRow
          warning={conflicted > 0}
          onClick={conflicted > 0 ? () => onNavigate("conflicts") : undefined}
          last
        >
          {conflicted > 0 ? (
            <>
              <span className="text-er">✕</span> {conflicted} conflicted files — resolve →
            </>
          ) : (
            <>
              <span className="text-ok">✓</span> No conflicts
            </>
          )}
        </HealthRow>
      </OverviewCard>
    </div>
  );
}

function OverviewCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <header className="flex items-center border-b border-bd px-3 py-2 text-[11px] font-bold tracking-[.06em] text-tx3">
        {title}
        <span className="flex-1" />
        {meta && (
          <span className="font-mono text-[11px] font-normal tracking-normal text-tx2">{meta}</span>
        )}
      </header>
      {children}
    </section>
  );
}

function HealthRow({
  warning,
  onClick,
  last,
  children,
}: {
  warning: boolean;
  onClick?: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`flex h-7 w-full items-center gap-2 border-0 ${last ? "" : "border-b border-bd"} bg-transparent px-3 text-left text-[12px] disabled:cursor-default`}
    >
      {children}
      <span className="sr-only">{warning ? "Attention required" : "Ready"}</span>
    </button>
  );
}
