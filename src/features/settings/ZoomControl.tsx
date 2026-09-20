import { ActionButton } from "../../components/ui/ActionButton";

const levels = [75, 80, 90, 100, 110, 125, 150];

export function ZoomControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const index = levels.findIndex((level) => level >= value);
  const current = index < 0 ? levels.length - 1 : index;
  return (
    <div className="flex items-center gap-1.5">
      <ActionButton
        aria-label="Zoom out"
        title="Zoom out (Ctrl+-)"
        className="w-8 px-0"
        onClick={() => onChange(levels[Math.max(0, current - 1)])}
      >
        −
      </ActionButton>
      <button
        onClick={() => onChange(100)}
        title="Reset zoom (Ctrl+0)"
        className="h-8 min-w-16 rounded border border-bd2 bg-panel2 px-2 text-[12px] font-semibold text-tx hover:bg-hov"
      >
        {value}%
      </button>
      <ActionButton
        aria-label="Zoom in"
        title="Zoom in (Ctrl++)"
        className="w-8 px-0"
        onClick={() => onChange(levels[Math.min(levels.length - 1, current + 1)])}
      >
        +
      </ActionButton>
    </div>
  );
}
