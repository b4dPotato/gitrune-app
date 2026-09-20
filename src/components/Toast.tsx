/** Minimal global toast system: `useToast()` returns a function; the host
 * renders stacked toasts bottom-right. Used for operation feedback and for
 * honest "not available yet" responses on future-milestone actions. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { normalizeAppError, type AppError } from "../lib/ipc";

export type ToastKind = "ok" | "info" | "warn" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  error?: AppError;
}

export type ToastPush = (content: unknown, kind?: ToastKind) => void;

const ToastCtx = createContext<ToastPush>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const KIND_STYLE: Record<ToastKind, { border: string; color: string; glyph: string }> = {
  ok: { border: "var(--ok)", color: "var(--ok)", glyph: "✓" },
  info: { border: "var(--inf)", color: "var(--inf)", glyph: "ℹ" },
  warn: { border: "var(--wn)", color: "var(--wn)", glyph: "⚠" },
  error: { border: "var(--er)", color: "var(--er)", glyph: "✕" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback<ToastPush>((content, kind = "info") => {
    const id = nextId.current++;
    const error = kind === "error" ? normalizeAppError(content) : undefined;
    const text = error?.message ?? (content instanceof Error ? content.message : String(content));
    setToasts((t) => [...t.slice(-3), { id, kind, text, error }]);
    window.setTimeout(
      () => {
        setToasts((t) => t.filter((x) => x.id !== id));
      },
      kind === "error" ? 10_000 : 4200,
    );
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-9 right-4 z-[90] flex w-[360px] flex-col gap-2">
        {toasts.map((t) => {
          const st = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-2 rounded-md border bg-panel px-3 py-2 text-[12.5px] text-tx shadow-[0_8px_24px_rgba(0,0,0,.35)]"
              style={{ borderColor: st.border }}
            >
              <span className="text-[12px]" style={{ color: st.color }}>
                {st.glyph}
              </span>
              <div className="min-w-0 flex-1 break-words">
                {t.error && <div className="mb-0.5 font-semibold">{t.error.title}</div>}
                <div className="whitespace-pre-wrap">{t.text}</div>
                {!!t.error?.suggestedActions.length && (
                  <ul className="mb-0 mt-1 list-disc pl-4 text-[11.5px] text-tx2">
                    {t.error.suggestedActions.map((suggestion) => (
                      <li key={suggestion.action}>{suggestion.label}</li>
                    ))}
                  </ul>
                )}
                {t.error?.technicalDetails && t.error.technicalDetails !== t.error.message && (
                  <details className="mt-1 text-[11px] text-tx3">
                    <summary className="cursor-pointer">Technical details</summary>
                    <pre className="max-h-32 select-text overflow-auto whitespace-pre-wrap font-mono">
                      {t.error.technicalDetails}
                    </pre>
                  </details>
                )}
              </div>
              <button
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-tx3 hover:text-tx"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
