import type { RepoRecord } from "../../lib/ipc";
import { useStatus } from "../../lib/hooks";
import { ActionButton } from "../../components/ui/ActionButton";

export function RepositoryRow({
  repo,
  index,
  onOpen,
}: {
  repo: RepoRecord;
  index: number;
  onOpen: (index: number) => void;
}) {
  const { data: status } = useStatus(repo.path);
  const sync =
    status && (status.ahead > 0 || status.behind > 0)
      ? `${status.ahead > 0 ? `↑${status.ahead}` : ""} ${status.behind > 0 ? `↓${status.behind}` : ""}`.trim()
      : "✓";
  return (
    <div className="flex h-[34px] items-center border-b border-bd px-3 text-[12px] hover:bg-hov">
      <span className="flex w-[170px] flex-none items-center gap-2 font-semibold">
        <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: repo.color }} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{repo.name}</span>
      </span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-tx2">
        ⎇ {status?.branch ?? "…"}
        {status?.operation && <span className="ml-2 text-wn">⚠ {status.operation}</span>}
      </span>
      <span className="w-[70px] flex-none text-[11.5px]">
        {status && status.dirty > 0 && <span className="text-wn">● {status.dirty}</span>}
      </span>
      <span className="w-[70px] flex-none font-mono text-[11px] text-tx3">{sync}</span>
      <span className="w-[60px] flex-none text-right">
        <ActionButton size="sm" onClick={() => onOpen(index)}>
          Open
        </ActionButton>
      </span>
    </div>
  );
}
