import type { ReactNode } from "react";

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-[12px] text-tx3">{children}</div>;
}
