import { useState } from "react";
import { ipc, type EditorOption } from "../../lib/ipc";
import { useApp, useSet } from "../../state/store";
import { useToast } from "../../components/Toast";
import { ActionButton } from "../../components/ui/ActionButton";
import { EditorLogo } from "./EditorLogo";

function extensionOf(file?: string) {
  const name = file?.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

export function OpenInEditor({
  repoPath,
  file,
  compact = false,
  className = "",
}: {
  repoPath: string;
  file?: string;
  compact?: boolean;
  className?: string;
}) {
  const settings = useApp();
  const set = useSet();
  const toast = useToast();
  const [options, setOptions] = useState<EditorOption[] | null>(null);
  const [remember, setRemember] = useState<EditorOption | null>(null);
  const extension = extensionOf(file);

  const launch = async (option: EditorOption) => {
    try {
      await ipc.openInEditor(repoPath, file, option.id);
      setOptions(null);
      if (extension && !option.recommended && settings.editorAssociations[extension] !== option.id)
        setRemember(option);
    } catch (error) {
      toast(error, "error");
    }
  };
  const open = async () => {
    const associated = extension ? settings.editorAssociations[extension] : undefined;
    if (associated) {
      await launch({ id: associated, label: associated, recommended: true, icon: associated });
      return;
    }
    try {
      setOptions(await ipc.listEditors(file));
    } catch (error) {
      toast(error, "error");
    }
  };
  return (
    <>
      <ActionButton
        icon="editor"
        size={compact ? "sm" : "md"}
        iconOnly={compact}
        className={className}
        title="Open in editor"
        aria-label="Open in editor"
        onClick={() => void open()}
      >
        Open in editor
      </ActionButton>
      {options && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/45"
          onMouseDown={() => setOptions(null)}
        >
          <div
            role="dialog"
            aria-label="Open in editor"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-[430px] max-w-[92vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-xl"
          >
            <div className="border-b border-bd px-4 py-3 text-[14px] font-bold">
              Open {file ? file.split(/[\\/]/).pop() : "repository"} in…
            </div>
            <div className="p-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => void launch(option)}
                  className="flex w-full items-center gap-3 rounded border-0 bg-transparent px-3 py-2.5 text-left hover:bg-hov"
                >
                  <EditorLogo icon={option.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold">{option.label}</span>
                    {option.recommended && (
                      <span className="block text-[10.5px] text-actx">
                        Recommended for this file type
                      </span>
                    )}
                    {option.detail && (
                      <span className="block truncate text-[10.5px] text-tx3">{option.detail}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-bd bg-panel2 px-4 py-3">
              <ActionButton onClick={() => setOptions(null)}>Cancel</ActionButton>
            </div>
          </div>
        </div>
      )}
      {remember && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45"
          onMouseDown={() => setRemember(null)}
        >
          <div
            role="dialog"
            aria-label="Remember editor"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-[420px] max-w-[92vw] rounded-lg border border-bd2 bg-panel p-4 shadow-xl"
          >
            <div className="text-[14px] font-bold">Remember this for next time?</div>
            <p className="text-[12px] text-tx2">
              Always open <span className="font-mono text-tx">{extension}</span> files with{" "}
              {remember.label}. You can change this later in Settings.
            </p>
            <div className="flex justify-end gap-2">
              <ActionButton onClick={() => setRemember(null)}>Not now</ActionButton>
              <ActionButton
                variant="primary"
                onClick={() => {
                  set({
                    editorAssociations: {
                      ...settings.editorAssociations,
                      [extension]: remember.id,
                    },
                  });
                  setRemember(null);
                }}
              >
                Remember
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
