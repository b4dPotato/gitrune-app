const INVALID_REF = /[\s~^:?*\[\\\x00-\x1f\x7f]/;

export function validateGitRefName(value: string): string | null {
  const name = value.trim();
  if (!name) return "A name is required.";
  if (
    name.startsWith("-") ||
    name.startsWith("/") ||
    name.endsWith("/") ||
    name.endsWith(".") ||
    name.includes("..") ||
    name.includes("@{") ||
    name.includes("//") ||
    INVALID_REF.test(name) ||
    name.split("/").some((part) => part.startsWith(".") || part.endsWith(".lock"))
  ) {
    return "Use a valid Git reference name without spaces or Git control characters.";
  }
  return null;
}

export function ValidatedRefInput({
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const error = value ? validateGitRefName(value) : null;
  return (
    <div className="min-w-0 flex-1">
      <input
        autoFocus={autoFocus}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? "git-ref-error" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
        placeholder={placeholder}
      />
      {error && (
        <div id="git-ref-error" role="alert" className="mt-1 text-[10px] text-er">
          {error}
        </div>
      )}
    </div>
  );
}
