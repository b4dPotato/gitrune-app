import { useState } from "react";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { ActionButton } from "../components/ui/ActionButton";
import { ConfirmActionModal } from "../components/ui/ConfirmActionModal";
import { BranchInventory, type DangerAction } from "../features/branches/BranchInventory";
import { BranchEditForm, type BranchForm } from "../features/branches/BranchEditForm";
import { NewBranchModal } from "../features/branches/NewBranchModal";
import {
  useAddRemote,
  useCheckout,
  useCheckoutRemote,
  useCreateAdvancedTag,
  useCurrentRepo,
  useDeleteBranch,
  useDeleteTag,
  useFetchRemote,
  useMergeBranch,
  usePushTag,
  useRebaseBranch,
  useRefs,
  useRemotes,
  useRemoveRemote,
  useRenameBranch,
  useSelectDefaultRemote,
  useSetUpstream,
  useTags,
  useUnsetUpstream,
  useUpdateRemote,
} from "../lib/hooks";
import { useOperationRunner } from "../lib/useOperationRunner";

export function BranchesView() {
  const repo = useCurrentRepo();
  const runOperation = useOperationRunner();
  const { data: refs = [] } = useRefs(repo?.path);
  const { data: remotes = [] } = useRemotes(repo?.path);
  const { data: tags = [] } = useTags(repo?.path);
  const checkout = useCheckout(repo?.path);
  const checkoutRemote = useCheckoutRemote(repo?.path);
  const deleteBranch = useDeleteBranch(repo?.path);
  const mergeBranch = useMergeBranch(repo?.path);
  const rebaseBranch = useRebaseBranch(repo?.path);
  const renameBranch = useRenameBranch(repo?.path);
  const addRemote = useAddRemote(repo?.path);
  const updateRemote = useUpdateRemote(repo?.path);
  const removeRemote = useRemoveRemote(repo?.path);
  const fetchRemote = useFetchRemote(repo?.path);
  const setUpstream = useSetUpstream(repo?.path);
  const selectDefaultRemote = useSelectDefaultRemote(repo?.path);
  const unsetUpstream = useUnsetUpstream(repo?.path);
  const createTag = useCreateAdvancedTag(repo?.path);
  const pushTag = usePushTag(repo?.path);
  const deleteTag = useDeleteTag(repo?.path);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<BranchForm | null>(null);
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [danger, setDanger] = useState<DangerAction | null>(null);

  const locals = refs.filter(
    (ref) => ref.kind === "local" && ref.name.toLowerCase().includes(filter.toLowerCase()),
  );
  const remoteBranches = refs.filter(
    (ref) => ref.kind === "remote" && ref.name.toLowerCase().includes(filter.toLowerCase()),
  );
  const head = refs.find((ref) => ref.isHead)?.name ?? "main";

  const run = async (promise: Promise<{ success: boolean; stderr: string }>, success: string) => {
    if (await runOperation(promise, success)) setForm(null);
  };

  const submit = () => {
    if (!form) return;
    if (form.kind === "rename" && form.name.trim())
      void run(
        renameBranch.mutateAsync({ oldName: form.oldName, newName: form.name.trim() }),
        `Renamed to ${form.name.trim()}`,
      );
    if (form.kind === "track" && form.name.trim())
      void run(
        checkoutRemote.mutateAsync({ remoteRef: form.remoteRef, localName: form.name.trim() }),
        `Tracking ${form.remoteRef}`,
      );
    if (form.kind === "remote" && form.name.trim() && form.url.trim()) {
      const promise = form.original
        ? updateRemote.mutateAsync({ name: form.original, url: form.url.trim() })
        : addRemote.mutateAsync({ name: form.name.trim(), url: form.url.trim() });
      void run(promise, form.original ? `Updated ${form.original}` : `Added ${form.name.trim()}`);
    }
    if (form.kind === "tag" && form.name.trim() && form.target.trim())
      void run(
        createTag.mutateAsync({
          name: form.name.trim(),
          sha: form.target.trim(),
          message: form.message.trim() || undefined,
        }),
        `Created tag ${form.name.trim()}`,
      );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title={
          <input
            placeholder="Filter branches…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="input w-60 font-normal"
          />
        }
        actions={
          <>
            <ActionButton
              icon="plus"
              onClick={() => setForm({ kind: "remote", name: "origin", url: "" })}
            >
              New remote
            </ActionButton>
            <ActionButton
              icon="plus"
              onClick={() => setForm({ kind: "tag", name: "", target: "HEAD", message: "" })}
            >
              New tag
            </ActionButton>
            <ActionButton icon="branch" variant="primary" onClick={() => setNewBranchOpen(true)}>
              New branch
            </ActionButton>
          </>
        }
      />
      {form && (
        <BranchEditForm
          form={form}
          onChange={setForm}
          onSubmit={submit}
          onCancel={() => setForm(null)}
        />
      )}
      <BranchInventory
        locals={locals}
        remoteBranches={remoteBranches}
        remotes={remotes}
        tags={tags}
        head={head}
        onRename={(branch) => setForm({ kind: "rename", oldName: branch.name, name: branch.name })}
        onUnsetUpstream={(branch) =>
          void run(unsetUpstream.mutateAsync(branch), "Upstream removed")
        }
        onCheckout={(branch) => void run(checkout.mutateAsync(branch), `Switched to ${branch}`)}
        onMerge={(branch) => void run(mergeBranch.mutateAsync(branch), `Merged ${branch}`)}
        onRebase={(branch) => void run(rebaseBranch.mutateAsync(branch), `Rebased onto ${branch}`)}
        onTrackRemote={(remoteRef, name) => setForm({ kind: "track", remoteRef, name })}
        onSetUpstream={(branch, remote, remoteBranch) =>
          void run(
            setUpstream.mutateAsync({ branch, remote, remoteBranch }),
            `Tracking ${remote}/${remoteBranch}`,
          )
        }
        onSelectDefaultRemote={(remote) =>
          void run(selectDefaultRemote.mutateAsync(remote), `${remote} is the default push remote`)
        }
        onFetchRemote={(remote) => void run(fetchRemote.mutateAsync(remote), `Fetched ${remote}`)}
        onEditRemote={(remote) =>
          setForm({
            kind: "remote",
            original: remote.name,
            name: remote.name,
            url: remote.fetchUrl,
          })
        }
        onPushTag={(remote, name) =>
          void run(pushTag.mutateAsync({ remote, name }), `Pushed ${name}`)
        }
        onDanger={setDanger}
        deleteBranchAction={(name) => deleteBranch.mutateAsync({ name, force: false })}
        removeRemoteAction={(name) => removeRemote.mutateAsync(name)}
        deleteTagAction={(name, remote) => deleteTag.mutateAsync({ name, remote })}
      />
      <NewBranchModal
        open={newBranchOpen}
        repoPath={repo?.path}
        onClose={() => setNewBranchOpen(false)}
      />
      <ConfirmActionModal
        open={!!danger}
        title={danger?.title ?? "Confirm action"}
        description={danger?.description ?? ""}
        command={danger?.command}
        confirmLabel={danger?.label ?? "Confirm"}
        onCancel={() => setDanger(null)}
        onConfirm={() => {
          if (!danger) return;
          const current = danger;
          setDanger(null);
          void run(current.action(), current.success);
        }}
      />
    </div>
  );
}
