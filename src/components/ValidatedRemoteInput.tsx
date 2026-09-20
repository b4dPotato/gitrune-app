import { forwardRef } from "react";
import { validateGitRefName } from "./ValidatedRefInput";

export function validateRemoteName(value: string): string | null {
  const error = validateGitRefName(value);
  return error ? "Use a valid remote name without spaces or Git control characters." : null;
}

export function validateRemoteUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return "Enter the repository URL.";
  if (url.startsWith("-") || /[\r\n\0]/.test(url)) return "Enter a valid Git remote URL.";
  return null;
}

export const ValidatedRemoteInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    kind: "name" | "url";
    placeholder: string;
    disabled?: boolean;
    showError?: boolean;
    id?: string;
    className?: string;
  }
>(function ValidatedRemoteInput(
  { value, onChange, kind, placeholder, disabled, showError = true, id, className = "" },
  ref,
) {
  const error = kind === "name" ? validateRemoteName(value) : validateRemoteUrl(value);
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className={kind === "url" ? "min-w-0 flex-1" : "w-36"}>
      <input
        ref={ref}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={showError && !!error}
        aria-describedby={showError && error ? errorId : undefined}
        className={`input w-full disabled:opacity-60 ${className}`}
      />
      {showError && error && (
        <div id={errorId} role="alert" className="mt-1 text-[10px] text-er">
          {error}
        </div>
      )}
    </div>
  );
});
