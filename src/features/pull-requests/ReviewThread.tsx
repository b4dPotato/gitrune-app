import { useState } from "react";
import { ActionButton } from "../../components/ui/ActionButton";

export function ReviewThread({
  onReply,
  onResolve,
}: {
  onReply: () => void;
  onResolve: () => void;
}) {
  const [reply, setReply] = useState("");
  return (
    <div className="mx-[14px] mb-[10px] ml-[102px] mt-[6px] max-w-[640px] rounded-md border border-wn bg-panel font-sans">
      <div className="flex items-center gap-2 border-b border-bd px-3 py-2">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pur text-[8px] font-bold text-white">
          MV
        </span>
        <span className="text-[12px] font-semibold">Marta Villanueva</span>
        <span className="text-[11px] text-tx3">2 h ago · lines 20–22</span>
        <span className="flex-1" />
        <span className="rounded-[4px] bg-wnbg px-[6px] text-[10.5px] text-wn">unresolved</span>
      </div>
      <div className="px-3 py-[9px] text-[12.5px] text-tx">
        Should revoked sessions be logged before we throw? We lose the audit trail otherwise.
      </div>
      <div className="flex items-center gap-2 border-t border-bd px-3 py-2">
        <input
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && reply.trim()) {
              setReply("");
              onReply();
            }
          }}
          placeholder="Reply… (added to pending review)"
          className="input flex-1"
        />
        <ActionButton size="sm" onClick={onResolve}>
          Resolve
        </ActionButton>
      </div>
    </div>
  );
}
