import type { ReactNode } from "react";

export function ScreenHeader({
  title,
  meta,
  actions,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-10 flex-none items-center gap-2 border-b border-bd bg-panel px-[14px] py-1">
      {title && <div className="text-[13px] font-bold text-tx">{title}</div>}
      {meta && <div className="text-[11.5px] text-tx3">{meta}</div>}
      <span className="flex-1" />
      {actions}
    </header>
  );
}
