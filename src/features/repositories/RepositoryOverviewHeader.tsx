import type { RepoRecord, RepoStatus } from "../../lib/ipc";
import { isDemo } from "../../lib/ipc";
import { ActionButton } from "../../components/ui/ActionButton";
import { OpenInEditor } from "../editor/OpenInEditor";
import { RepositoryColorPicker } from "./RepositoryColorPicker";

export function RepositoryOverviewHeader({
  repo,
  status,
  hasRemote,
  onOpenTerminal,
  onRemove,
}: {
  repo?: RepoRecord;
  status?: RepoStatus;
  hasRemote: boolean;
  onOpenTerminal: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        {repo && <RepositoryColorPicker repo={repo} />}
        <span className="text-[18px] font-bold">{repo?.name ?? "No repository"}</span>
        <span className="font-mono text-[12px] text-tx2">⎇ {status?.branch ?? "…"}</span>
        {status?.detached && (
          <span className="rounded-[4px] bg-wnbg px-[7px] py-px text-[11px] text-wn">
            detached HEAD
          </span>
        )}
        <span className="flex-1" />
        {repo && <OpenInEditor repoPath={repo.path} className="h-8" />}
        <ActionButton
          icon="terminal"
          onClick={onOpenTerminal}
          disabled={!repo}
          className="h-8 disabled:opacity-50"
        >
          Terminal
        </ActionButton>
        {repo && (
          <ActionButton
            icon="trash"
            variant="danger"
            onClick={onRemove}
            className="h-8 px-[10px] text-[12px]"
          >
            Remove
          </ActionButton>
        )}
      </div>
      <div className="mb-4 flex items-center gap-2 text-[12px] text-tx2">
        <span className="font-mono text-[11px] text-tx3">{repo?.path}</span>
        <span>·</span>
        {!hasRemote ? (
          "no remote configured"
        ) : status?.upstream ? (
          <>
            tracking <span className="font-mono text-tx">{status.upstream}</span>
          </>
        ) : (
          "no upstream configured"
        )}
        {isDemo() && (
          <span className="ml-2 rounded-[4px] bg-infbg px-[7px] py-px text-[11px] text-inf">
            demo data — run the desktop app for live Git
          </span>
        )}
      </div>
    </>
  );
}
