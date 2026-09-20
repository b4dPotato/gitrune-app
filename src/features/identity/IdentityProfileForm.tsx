import { useEffect, useState } from "react";
import { ErrorNotice } from "../../components/ErrorNotice";
import { ActionButton } from "../../components/ui/ActionButton";
import type { IdentityProfile } from "../../lib/ipc";

const emptyProfile: IdentityProfile = {
  id: 0,
  label: "",
  name: "",
  email: "",
  signingKey: null,
  sshHost: null,
  signCommits: false,
};

export function IdentityProfileForm({
  open,
  profile,
  sshHosts,
  busy,
  error,
  onCancel,
  onSave,
}: {
  open: boolean;
  profile: IdentityProfile | null;
  sshHosts: string[];
  busy: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (profile: IdentityProfile) => void;
}) {
  const [draft, setDraft] = useState<IdentityProfile>(emptyProfile);
  useEffect(() => {
    if (open) setDraft(profile ?? emptyProfile);
  }, [open, profile]);
  if (!open) return null;
  const set = <K extends keyof IdentityProfile>(key: K, value: IdentityProfile[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const valid =
    draft.label.trim() && draft.name.trim() && /^[^@\s]+@[^@\s]+$/.test(draft.email.trim());
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onMouseDown={onCancel}
    >
      <form
        aria-label={profile ? "Edit Git profile" : "New Git profile"}
        className="w-[520px] max-w-[92vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-[0_18px_55px_rgba(0,0,0,.5)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid)
            onSave({
              ...draft,
              label: draft.label.trim(),
              name: draft.name.trim(),
              email: draft.email.trim(),
              signingKey: draft.signingKey?.trim() || null,
              sshHost: draft.sshHost?.trim() || null,
            });
        }}
      >
        <div className="border-b border-bd px-4 py-3 text-[14px] font-bold">
          {profile ? "Edit Git profile" : "New Git profile"}
        </div>
        <div className="grid grid-cols-[126px_1fr] gap-x-3 gap-y-3 px-4 py-4 text-[12px]">
          <label className="pt-1.5 text-tx2" htmlFor="profile-label">
            Profile label
          </label>
          <input
            id="profile-label"
            autoFocus
            className="input"
            value={draft.label}
            onChange={(event) => set("label", event.target.value)}
            placeholder="Personal"
          />
          <label className="pt-1.5 text-tx2" htmlFor="profile-name">
            Commit author
          </label>
          <input
            id="profile-name"
            className="input"
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Ada Lovelace"
          />
          <label className="pt-1.5 text-tx2" htmlFor="profile-email">
            Commit email
          </label>
          <input
            id="profile-email"
            type="email"
            className="input"
            value={draft.email}
            onChange={(event) => set("email", event.target.value)}
            placeholder="ada@example.com"
          />
          <label className="pt-1.5 text-tx2" htmlFor="profile-signing">
            Signing key
          </label>
          <input
            id="profile-signing"
            className="input font-mono"
            value={draft.signingKey ?? ""}
            onChange={(event) => set("signingKey", event.target.value || null)}
            placeholder="Optional GPG or SSH signing key"
          />
          <label className="pt-1.5 text-tx2" htmlFor="profile-ssh">
            SSH host alias
          </label>
          <div>
            <input
              id="profile-ssh"
              list="ssh-hosts"
              className="input w-full font-mono"
              value={draft.sshHost ?? ""}
              onChange={(event) => set("sshHost", event.target.value || null)}
              placeholder="Optional, e.g. github-personal"
            />
            <datalist id="ssh-hosts">
              {sshHosts.map((host) => (
                <option key={host} value={host} />
              ))}
            </datalist>
            <div className="mt-1 text-[10.5px] text-tx3">
              Metadata for your existing ~/.ssh/config alias. Gitrune never reads private keys or
              stores credentials.
            </div>
          </div>
          <span />
          <label className="flex items-center gap-2 text-tx2">
            <input
              type="checkbox"
              checked={draft.signCommits}
              onChange={(event) => set("signCommits", event.target.checked)}
            />{" "}
            Sign commits by default for repositories using this profile
          </label>
          <span />
          <ErrorNotice error={error} />
        </div>
        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <ActionButton type="button" onClick={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" icon="check" variant="primary" disabled={!valid || busy}>
            {busy ? "Saving…" : "Save profile"}
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
