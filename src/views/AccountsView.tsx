import { useState } from "react";
import { ErrorNotice } from "../components/ErrorNotice";
import { useToast } from "../components/Toast";
import { ActionButton } from "../components/ui/ActionButton";
import { Avatar } from "../components/ui/Avatar";
import { ConfirmActionModal } from "../components/ui/ConfirmActionModal";
import { IdentityProfileForm } from "../features/identity/IdentityProfileForm";
import {
  useApplyIdentityProfile,
  useApplyProfileSshHost,
  useClearRepositoryIdentity,
  useCurrentRepo,
  useDeleteIdentityProfile,
  useIdentityDetails,
  useIdentityProfiles,
  useRemotes,
  useSaveIdentityProfile,
  useSshHosts,
} from "../lib/hooks";
import { operationError, type IdentityProfile } from "../lib/ipc";

export function AccountsView() {
  const toast = useToast();
  const repo = useCurrentRepo();
  const details = useIdentityDetails(repo?.path);
  const profiles = useIdentityProfiles();
  const sshHosts = useSshHosts();
  const remotes = useRemotes(repo?.path);
  const save = useSaveIdentityProfile();
  const remove = useDeleteIdentityProfile();
  const apply = useApplyIdentityProfile(repo?.path);
  const clear = useClearRepositoryIdentity(repo?.path);
  const applySsh = useApplyProfileSshHost(repo?.path);
  const [editing, setEditing] = useState<IdentityProfile | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<IdentityProfile | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sshProfile, setSshProfile] = useState<IdentityProfile | null>(null);
  const [sshRemote, setSshRemote] = useState("");
  const [error, setError] = useState<unknown>(null);

  const runApply = async (profile: IdentityProfile) => {
    if (!repo) return;
    setError(null);
    try {
      const result = await apply.mutateAsync(profile.id);
      if (!result.success) throw operationError(result, "Could not apply the Git profile");
      toast(`${profile.label} is now the local identity for ${repo.name}`, "ok");
      const sshRemotes = (remotes.data ?? []).filter(
        (remote) =>
          remote.fetchUrl.startsWith("ssh://") ||
          (!remote.fetchUrl.includes("://") && remote.fetchUrl.includes(":")),
      );
      if (profile.sshHost && sshRemotes.length > 0) {
        setSshRemote(sshRemotes.find((remote) => remote.isDefault)?.name ?? sshRemotes[0].name);
        setSshProfile(profile);
      } else if (profile.sshHost) {
        toast(
          "Commit identity changed. The SSH alias was not applied because this repository has no SSH remote.",
          "info",
        );
      }
    } catch (reason) {
      setError(reason);
    }
  };

  const identity = details.data;
  const effective =
    identity?.effectiveName && identity.effectiveEmail
      ? `${identity.effectiveName} <${identity.effectiveEmail}>`
      : "No Git author identity is configured";
  return (
    <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
      <div className="max-w-[980px]">
        <div className="mb-[2px] text-[16px] font-bold">Git Profiles</div>
        <div className="mb-[18px] text-[12px] text-tx2">
          Keep personal and work commit identities separate with repository-local Git configuration.
          Authentication continues to use system Git, credential helpers, and ~/.ssh/config.
        </div>
        <div className="section-label mb-2">CURRENT REPOSITORY IDENTITY</div>
        <div className="card mb-5 p-[14px]">
          {repo ? (
            <div className="flex items-center gap-3">
              <Avatar name={identity?.effectiveEmail ?? repo.name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[13px] font-semibold">{effective}</div>
                <div className="mt-0.5 text-[11px] text-tx3">
                  {identity?.localConfigured
                    ? `Repository-local identity in ${repo.name}`
                    : `Inherited ${identity?.emailSource ?? "unset"} identity · choose a profile to avoid accidental cross-account commits`}
                </div>
              </div>
              {identity?.localConfigured && (
                <ActionButton size="sm" onClick={() => setConfirmClear(true)}>
                  Use inherited identity
                </ActionButton>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-tx3">
              Select a repository to inspect or apply an identity.
            </div>
          )}
          {!details.isLoading && repo && !identity?.localConfigured && (
            <div className="mt-3 rounded border border-wn/40 bg-wnbg px-3 py-2 text-[11.5px] text-tx2">
              This repository does not have its own author identity. Commits will use the current
              global or system Git identity.
            </div>
          )}
        </div>
        <div className="mb-2 flex items-center">
          <span className="section-label">SAVED LOCAL PROFILES</span>
          <span className="flex-1" />
          <ActionButton
            icon="plus"
            variant="primary"
            onClick={() => {
              setError(null);
              setEditing(null);
            }}
          >
            New profile
          </ActionButton>
        </div>
        <div className="flex flex-col gap-2">
          {profiles.data?.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 rounded-md border border-bd bg-panel p-3"
            >
              <Avatar name={profile.email} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{profile.label}</div>
                <div className="truncate font-mono text-[11px] text-tx2">
                  {profile.name} &lt;{profile.email}&gt;
                </div>
                <div className="mt-0.5 text-[10.5px] text-tx3">
                  {profile.signCommits ? "Signed commits" : "Unsigned by default"}
                  {profile.sshHost ? ` · SSH alias ${profile.sshHost}` : ""}
                </div>
              </div>
              <ActionButton
                icon="apply"
                variant="primary"
                disabled={!repo || apply.isPending}
                onClick={() => void runApply(profile)}
              >
                Use for repository
              </ActionButton>
              <ActionButton
                onClick={() => {
                  setError(null);
                  setEditing(profile);
                }}
              >
                Edit
              </ActionButton>
              <ActionButton
                icon="trash"
                variant="danger"
                iconOnly
                aria-label={`Delete ${profile.label}`}
                onClick={() => setDeleting(profile)}
              />
            </div>
          ))}
          {!profiles.isLoading && profiles.data?.length === 0 && (
            <div className="rounded-md border border-dashed border-bd2 px-4 py-8 text-center text-[12px] text-tx3">
              No profiles yet. Create one for each commit identity you use.
            </div>
          )}
        </div>
        <ErrorNotice error={error ?? profiles.error ?? details.error} />
      </div>
      <IdentityProfileForm
        open={editing !== undefined}
        profile={editing ?? null}
        sshHosts={sshHosts.data ?? []}
        busy={save.isPending}
        error={save.error}
        onCancel={() => setEditing(undefined)}
        onSave={async (profile) => {
          try {
            await save.mutateAsync(profile);
            setEditing(undefined);
            toast("Git profile saved", "ok");
          } catch {
            /* rendered by the form */
          }
        }}
      />
      <ConfirmActionModal
        open={!!deleting}
        title={`Delete ${deleting?.label ?? "profile"}?`}
        description="The saved profile will be removed. Existing repository Git configuration is not changed."
        confirmLabel="Delete profile"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast("Git profile deleted", "ok");
            setDeleting(null);
          } catch (reason) {
            setError(reason);
            setDeleting(null);
          }
        }}
      />
      <ConfirmActionModal
        open={confirmClear}
        title="Use inherited Git identity?"
        description="This removes repository-local author and signing settings. Git will fall back to your global or system configuration."
        command="git config --local --unset-all user.name (and related identity keys)"
        confirmLabel="Clear local identity"
        busy={clear.isPending}
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          try {
            const result = await clear.mutateAsync(undefined);
            if (!result.success) throw operationError(result);
            toast("Repository-local identity cleared", "ok");
          } catch (reason) {
            setError(reason);
          }
        }}
      />
      <ConfirmActionModal
        open={!!sshProfile}
        danger={false}
        title={`Use SSH account ${sshProfile?.sshHost ?? ""}?`}
        description="Commit identity is already applied. This optional step rewrites the selected SSH remote to use your existing ~/.ssh/config Host alias, which controls the SSH key used for fetch and push."
        command={
          sshProfile && sshRemote
            ? `git remote set-url ${sshRemote} git@${sshProfile.sshHost}:<existing-repository-path>`
            : undefined
        }
        confirmLabel="Update SSH remote"
        busy={applySsh.isPending}
        onCancel={() => setSshProfile(null)}
        onConfirm={async () => {
          if (!sshProfile || !sshRemote) return;
          const profile = sshProfile;
          setSshProfile(null);
          try {
            const result = await applySsh.mutateAsync({ id: profile.id, remote: sshRemote });
            if (!result.success) throw operationError(result, "Could not update the SSH remote");
            toast(`${sshRemote} now uses SSH Host ${profile.sshHost}`, "ok");
          } catch (reason) {
            setError(reason);
          }
        }}
      >
        <label className="mt-3 flex items-center gap-2 text-[11.5px] text-tx2">
          Remote{" "}
          <select
            className="input min-w-0 flex-1"
            value={sshRemote}
            onChange={(event) => setSshRemote(event.target.value)}
          >
            {(remotes.data ?? [])
              .filter(
                (remote) =>
                  remote.fetchUrl.startsWith("ssh://") ||
                  (!remote.fetchUrl.includes("://") && remote.fetchUrl.includes(":")),
              )
              .map((remote) => (
                <option key={remote.name} value={remote.name}>
                  {remote.name} — {remote.fetchUrl}
                </option>
              ))}
          </select>
        </label>
      </ConfirmActionModal>
    </div>
  );
}
