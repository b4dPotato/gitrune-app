import { errorText, isAppError } from "../lib/ipc";

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const structured = isAppError(error) ? error : null;
  return (
    <div role="alert" className="rounded border border-er bg-erbg px-2 py-1 text-[11.5px] text-er">
      {structured && <div className="font-bold">{structured.title}</div>}
      <div>{errorText(error)}</div>
      {structured?.suggestedActions.length ? (
        <ul className="mt-1 list-disc pl-4 text-tx2">
          {structured.suggestedActions.map((suggestion) => (
            <li key={suggestion.action}>{suggestion.label}</li>
          ))}
        </ul>
      ) : null}
      {structured?.technicalDetails && (
        <details className="mt-1 text-tx3">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="select-text whitespace-pre-wrap">{structured.technicalDetails}</pre>
        </details>
      )}
    </div>
  );
}
