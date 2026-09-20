import type { RefInfo } from "../../lib/gitparse";
import { trackToSync } from "../../lib/gitparse";
import type { Remote, Tag } from "../../lib/ipc";
import { ActionButton } from "../../components/ui/ActionButton";

export interface DangerAction {
  title: string;
  description: string;
  command: string;
  label: string;
  action: () => Promise<{ success: boolean; stderr: string }>;
  success: string;
}

export function BranchInventory({
  locals,
  remoteBranches,
  remotes,
  tags,
  head,
  onRename,
  onUnsetUpstream,
  onCheckout,
  onMerge,
  onRebase,
  onTrackRemote,
  onSetUpstream,
  onSelectDefaultRemote,
  onFetchRemote,
  onEditRemote,
  onPushTag,
  onDanger,
  deleteBranchAction,
  removeRemoteAction,
  deleteTagAction,
}: {
  locals: RefInfo[];
  remoteBranches: RefInfo[];
  remotes: Remote[];
  tags: Tag[];
  head: string;
  onRename: (branch: RefInfo) => void;
  onUnsetUpstream: (branch: string) => void;
  onCheckout: (branch: string) => void;
  onMerge: (branch: string) => void;
  onRebase: (branch: string) => void;
  onTrackRemote: (remoteRef: string, localName: string) => void;
  onSetUpstream: (branch: string, remote: string, remoteBranch: string) => void;
  onSelectDefaultRemote: (remote: string) => void;
  onFetchRemote: (remote: string) => void;
  onEditRemote: (remote: Remote) => void;
  onPushTag: (remote: string, tag: string) => void;
  onDanger: (action: DangerAction) => void;
  deleteBranchAction: (name: string) => Promise<{ success: boolean; stderr: string }>;
  removeRemoteAction: (name: string) => Promise<{ success: boolean; stderr: string }>;
  deleteTagAction: (name: string, remote?: string) => Promise<{ success: boolean; stderr: string }>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-[14px] py-3">
      <Section title={`LOCAL BRANCHES — ${locals.length}`}>
        {locals.map((branch) => (
          <div
            key={branch.name}
            className="flex min-h-[36px] items-center gap-2 border-b border-bd px-3 hover:bg-hov"
          >
            <span className="w-4 text-actx">{branch.isHead ? "✓" : ""}</span>
            <span className="font-mono text-[12px]">⎇ {branch.name}</span>
            {branch.track.includes("gone") && (
              <span className="rounded bg-wnbg px-1 text-[10px] text-wn">upstream gone</span>
            )}
            <span className="flex-1" />
            <span className="w-24 text-[11px] text-tx3">
              {trackToSync(branch.track) || (branch.upstream ? "tracking" : "unpublished")}
            </span>
            <button type="button" onClick={() => onRename(branch)} className="btn-sm">
              Rename
            </button>
            {branch.upstream && (
              <button type="button" onClick={() => onUnsetUpstream(branch.name)} className="btn-sm">
                Untrack
              </button>
            )}
            {!branch.isHead && (
              <>
                <button type="button" onClick={() => onCheckout(branch.name)} className="btn-sm">
                  Checkout
                </button>
                <button type="button" onClick={() => onMerge(branch.name)} className="btn-sm">
                  Merge
                </button>
                <button type="button" onClick={() => onRebase(branch.name)} className="btn-sm">
                  Rebase
                </button>
                <ActionButton
                  icon="trash"
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    onDanger({
                      title: `Delete ${branch.name}?`,
                      description:
                        "The local branch reference will be deleted. Commits that are not reachable from another reference may eventually be pruned by Git.",
                      command: `git branch -d ${branch.name}`,
                      label: "Delete branch",
                      action: () => deleteBranchAction(branch.name),
                      success: `Deleted ${branch.name}`,
                    })
                  }
                >
                  Delete
                </ActionButton>
              </>
            )}
          </div>
        ))}
      </Section>

      <Section title={`REMOTE BRANCHES — ${remoteBranches.length}`}>
        {remoteBranches.map((branch) => {
          const slash = branch.name.indexOf("/");
          const remote = slash > 0 ? branch.name.slice(0, slash) : "origin";
          const remoteBranch = slash > 0 ? branch.name.slice(slash + 1) : branch.name;
          return (
            <div
              key={branch.name}
              className="flex min-h-[34px] items-center gap-2 border-b border-bd px-3"
            >
              <span className="flex-1 font-mono text-[12px] text-tx2">⎇ {branch.name}</span>
              <button
                type="button"
                onClick={() => onSetUpstream(head, remote, remoteBranch)}
                className="btn-sm"
              >
                Set as {head} upstream
              </button>
              <button
                type="button"
                onClick={() => onTrackRemote(branch.name, remoteBranch)}
                className="btn-sm"
              >
                Checkout new local
              </button>
            </div>
          );
        })}
      </Section>

      <Section title={`REMOTES — ${remotes.length}`}>
        {remotes.map((remote) => (
          <div
            key={remote.name}
            className="flex min-h-[40px] items-center gap-2 border-b border-bd px-3"
          >
            <span className="w-24 font-mono text-[12px]">
              {remote.name}
              {remote.isDefault && <span className="ml-1 text-actx">●</span>}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-tx3">
              {remote.fetchUrl}
            </span>
            {!remote.isDefault && (
              <button
                type="button"
                onClick={() => onSelectDefaultRemote(remote.name)}
                className="btn-sm"
              >
                Make default
              </button>
            )}
            <button type="button" onClick={() => onFetchRemote(remote.name)} className="btn-sm">
              Fetch
            </button>
            <button type="button" onClick={() => onEditRemote(remote)} className="btn-sm">
              Edit URL
            </button>
            <ActionButton
              icon="trash"
              size="sm"
              variant="danger"
              onClick={() =>
                onDanger({
                  title: `Remove remote ${remote.name}?`,
                  description:
                    "This removes the remote configuration from this repository. It does not delete the remote repository.",
                  command: `git remote remove ${remote.name}`,
                  label: "Remove remote",
                  action: () => removeRemoteAction(remote.name),
                  success: `Removed ${remote.name}`,
                })
              }
            >
              Remove
            </ActionButton>
          </div>
        ))}
      </Section>

      <Section title={`TAGS — ${tags.length}`} last>
        {tags.map((tag) => {
          const remote = remotes.find((item) => item.isDefault) ?? remotes[0];
          return (
            <div
              key={tag.name}
              className="flex min-h-[36px] items-center gap-2 border-b border-bd px-3"
            >
              <span className="w-40 font-mono text-[12px] text-pur">⌗ {tag.name}</span>
              <span className="flex-1 truncate text-[11px] text-tx3">
                {tag.message || tag.target.slice(0, 12)} · {tag.kind}
              </span>
              {remote && (
                <button
                  type="button"
                  onClick={() => onPushTag(remote.name, tag.name)}
                  className="btn-sm"
                >
                  Push
                </button>
              )}
              {remote && (
                <ActionButton
                  icon="trash"
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    onDanger({
                      title: `Delete ${tag.name} from ${remote.name}?`,
                      description:
                        "This removes the tag from the remote. Other users may already have fetched it.",
                      command: `git push ${remote.name} --delete refs/tags/${tag.name}`,
                      label: "Delete remote tag",
                      action: () => deleteTagAction(tag.name, remote.name),
                      success: `Deleted ${tag.name} from ${remote.name}`,
                    })
                  }
                >
                  Remote
                </ActionButton>
              )}
              <ActionButton
                icon="trash"
                size="sm"
                variant="danger"
                onClick={() =>
                  onDanger({
                    title: `Delete local tag ${tag.name}?`,
                    description:
                      "This removes the local tag reference. It does not delete a remote tag.",
                    command: `git tag -d ${tag.name}`,
                    label: "Delete local tag",
                    action: () => deleteTagAction(tag.name),
                    success: `Deleted ${tag.name}`,
                  })
                }
              >
                Local
              </ActionButton>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="section-label mb-1">{title}</div>
      <div className={`card ${last ? "" : "mb-4"}`}>{children}</div>
    </>
  );
}
