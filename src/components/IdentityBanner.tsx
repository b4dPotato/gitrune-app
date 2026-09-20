export function IdentityBanner({
  repository,
  identity,
  onReviewRules,
  onDismiss,
}: {
  repository: string;
  identity: string;
  onReviewRules: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-none items-center gap-[10px] border-b border-bd bg-wnbg px-[14px] py-[6px] text-[12px] text-tx">
      <span className="font-bold text-wn">⚠ Inherited identity</span>
      <span className="text-tx2">
        <b className="text-tx">{repository}</b> has no repository-local author. Commits will use{" "}
        <span className="font-mono">{identity}</span>. Choose a Git profile if this is not
        intentional.
      </span>
      <span className="flex-1" />
      <button
        onClick={onReviewRules}
        className="cursor-pointer rounded border border-bd2 bg-transparent px-[10px] py-[3px] text-[12px] text-tx2 hover:bg-hov"
      >
        Review profiles
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss warning"
        className="cursor-pointer rounded border-0 bg-transparent px-1 text-[12px] text-tx3 hover:text-tx"
      >
        ✕
      </button>
    </div>
  );
}
