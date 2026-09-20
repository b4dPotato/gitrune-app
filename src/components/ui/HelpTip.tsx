import { Icon } from "./Icon";

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex" tabIndex={0} aria-label={text}>
      <Icon name="help" size={13} className="text-tx3 transition-colors group-hover:text-actx" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-2 hidden w-56 -translate-x-1/2 rounded border border-bd2 bg-panel px-2.5 py-2 text-[11px] font-normal leading-relaxed text-tx2 shadow-xl group-hover:block group-focus:block"
      >
        {text}
      </span>
    </span>
  );
}
