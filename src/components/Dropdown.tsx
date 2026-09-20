/** Small anchored dropdown menu used by the top bar and toolbars. */
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./ui/Icon";

export interface MenuItem {
  label: string;
  glyph?: string;
  mono?: boolean;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  description?: string;
  checked?: boolean;
  keepOpen?: boolean;
  onClick: () => void;
}

export function Dropdown({
  trigger,
  items,
  width = 240,
  header,
  searchPlaceholder,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  items: MenuItem[];
  width?: number;
  header?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 420 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const desiredHeight = Math.min(420, menuRef.current?.scrollHeight ?? 220);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openAbove = spaceBelow < Math.min(160, desiredHeight) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(80, openAbove ? spaceAbove : spaceBelow);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: openAbove
        ? Math.max(8, rect.top - Math.min(desiredHeight, maxHeight) - 4)
        : rect.bottom + 4,
      maxHeight,
    });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibleItems = useMemo(
    () =>
      query.trim()
        ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
        : items,
    [items, query],
  );
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger(open, () => {
        setOpen((o) => !o);
        setQuery("");
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] overflow-y-auto rounded-md border border-bd2 bg-panel py-1 shadow-[0_12px_32px_rgba(0,0,0,.4)]"
            style={{ width, left: position.left, top: position.top, maxHeight: position.maxHeight }}
          >
            {header && (
              <div className="px-3 pb-1 pt-[5px] text-[10px] font-bold tracking-[.08em] text-tx3">
                {header}
              </div>
            )}
            {searchPlaceholder && (
              <div className="sticky top-0 z-10 bg-panel px-2 pb-1 pt-1">
                <label className="dropdown-search flex items-center gap-2 rounded border border-bd bg-bg px-2 focus-within:border-acbd focus-within:ring-1 focus-within:ring-acbd">
                  <Icon name="search" size={14} className="text-tx3" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[12px] text-tx"
                  />
                </label>
              </div>
            )}
            {visibleItems.map((it, i) => (
              <button
                key={i}
                disabled={it.disabled}
                onClick={() => {
                  if (it.disabled) return;
                  if (!it.keepOpen) close();
                  it.onClick();
                }}
                title={it.hint}
                className="flex min-h-[30px] w-full cursor-pointer items-center gap-[9px] border-0 bg-transparent px-3 py-1.5 text-left text-[12.5px] hover:bg-hov disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  color: it.danger ? "var(--er)" : it.active ? "var(--actx)" : "var(--tx)",
                  fontFamily: it.mono ? "var(--mono, ui-monospace, monospace)" : undefined,
                }}
              >
                <span className="w-[14px] text-center text-[12px] text-tx3">
                  {it.active || it.checked ? "✓" : (it.glyph ?? "")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                    {it.label}
                  </span>
                  {it.description && (
                    <span className="mt-0.5 block text-[10px] leading-snug text-tx3">
                      {it.description}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {visibleItems.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-tx3">Nothing here.</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
