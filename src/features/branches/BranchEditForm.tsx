import { ActionButton } from "../../components/ui/ActionButton";
import { ValidatedRefInput, validateGitRefName } from "../../components/ValidatedRefInput";
import {
  ValidatedRemoteInput,
  validateRemoteName,
  validateRemoteUrl,
} from "../../components/ValidatedRemoteInput";

export type BranchForm =
  | { kind: "rename"; oldName: string; name: string }
  | { kind: "track"; remoteRef: string; name: string }
  | { kind: "remote"; original?: string; name: string; url: string }
  | { kind: "tag"; name: string; target: string; message: string };

export function BranchEditForm({
  form,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: BranchForm;
  onChange: (form: BranchForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const submitLabel =
    form.kind === "rename"
      ? "Rename branch"
      : form.kind === "track"
        ? "Create local branch"
        : form.kind === "remote"
          ? form.original
            ? "Save remote"
            : "Add remote"
          : "Create tag";
  const invalid =
    form.kind === "remote"
      ? !!validateRemoteName(form.name) || !!validateRemoteUrl(form.url)
      : !!validateGitRefName(form.name) || (form.kind === "tag" && !form.target.trim());

  return (
    <div className="flex items-center gap-2 border-b border-bd bg-panel2 px-[14px] py-2">
      <span className="w-24 text-[11px] font-bold uppercase text-tx3">{form.kind}</span>
      {form.kind === "remote" && (
        <ValidatedRemoteInput
          value={form.name}
          disabled={!!form.original}
          onChange={(name) => onChange({ ...form, name })}
          kind="name"
          placeholder="Remote name"
        />
      )}
      {form.kind === "remote" ? (
        <ValidatedRemoteInput
          value={form.url}
          onChange={(url) => onChange({ ...form, url })}
          kind="url"
          placeholder="Remote URL"
        />
      ) : (
        <ValidatedRefInput
          value={form.name}
          onChange={(name) => onChange({ ...form, name })}
          placeholder={form.kind === "tag" ? "Tag name" : "Branch name"}
        />
      )}
      {form.kind === "tag" && (
        <>
          <input
            value={form.target}
            onChange={(event) => onChange({ ...form, target: event.target.value })}
            placeholder="Target"
            className="input w-40"
          />
          <input
            value={form.message}
            onChange={(event) => onChange({ ...form, message: event.target.value })}
            placeholder="Annotation (optional)"
            className="input flex-1"
          />
        </>
      )}
      <ActionButton icon="check" variant="primary" onClick={onSubmit} disabled={invalid}>
        {submitLabel}
      </ActionButton>
      <ActionButton onClick={onCancel}>Cancel</ActionButton>
    </div>
  );
}
