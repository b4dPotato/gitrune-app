import { useEffect, useRef, useState, type FormEvent } from "react";
import { useToast } from "../../components/Toast";
import { ActionButton } from "../../components/ui/ActionButton";
import { useAddRemote } from "../../lib/hooks";
import { ValidatedRemoteInput, validateRemoteUrl } from "../../components/ValidatedRemoteInput";

export const remoteUrlError = validateRemoteUrl;

export function RemoteSetupCard({
  repoPath,
  identity,
  focusRequest = 0,
}: {
  repoPath: string;
  identity?: string;
  focusRequest?: number;
}) {
  const toast = useToast();
  const addRemote = useAddRemote(repoPath);
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const validation = remoteUrlError(url);

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (validation) return;
    try {
      const result = await addRemote.mutateAsync({ name: "origin", url: url.trim() });
      if (!result.success) {
        toast(result.stderr || "Git could not add this remote", "error");
        return;
      }
      toast("Remote added. You can now publish this branch.", "ok");
      setUrl("");
      setSubmitted(false);
    } catch (error) {
      toast(error, "error");
    }
  };

  return (
    <section id="remote-setup" className="card max-w-[760px]" aria-labelledby="remote-setup-title">
      <div className="border-b border-bd px-4 py-3">
        <div id="remote-setup-title" className="text-[13px] font-semibold">
          Connect this local repository
        </div>
        <div className="mt-1 text-[11.5px] leading-relaxed text-tx2">
          Add an existing Git remote. Gitrune does not create a GitHub account and does not store
          credentials.
        </div>
      </div>
      <form onSubmit={submit} className="px-4 py-3">
        <label htmlFor="remote-url" className="mb-1.5 block text-[11px] font-semibold text-tx2">
          REMOTE URL
        </label>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ValidatedRemoteInput
              ref={inputRef}
              id="remote-url"
              value={url}
              onChange={setUrl}
              kind="url"
              placeholder="git@github.com:owner/repository.git"
              showError={submitted}
              className="h-8 font-mono"
            />
          </div>
          <ActionButton type="submit" icon="plus" variant="primary" disabled={addRemote.isPending}>
            {addRemote.isPending ? "Adding…" : "Add remote"}
          </ActionButton>
        </div>
        <div id="remote-url-help" className="mt-2 text-[11px] leading-relaxed text-tx3">
          Name: <span className="font-mono text-tx2">origin</span>. HTTPS uses your system Git
          credential helper. SSH uses your local SSH configuration; an SSH host alias such as{" "}
          <span className="font-mono text-tx2">github-work</span> can select a different account.
        </div>
      </form>
      <div className="border-t border-bd bg-panel2 px-4 py-2.5 text-[11px] text-tx3">
        Commits use{" "}
        <span className="font-mono text-tx2">
          {identity || "your configured user.name and user.email"}
        </span>
        . Commit identity and remote authentication are separate settings.
      </div>
    </section>
  );
}
