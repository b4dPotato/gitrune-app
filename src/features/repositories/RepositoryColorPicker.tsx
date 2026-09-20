import { useState } from "react";
import { REPOSITORY_COLORS } from "../../lib/palettes";
import { useUpdateRepoColor } from "../../lib/hooks";
import { useToast } from "../../components/Toast";
import { type RepoRecord } from "../../lib/ipc";

export function RepositoryColorPicker({ repo }: { repo: RepoRecord }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateRepoColor();
  const toast = useToast();
  const choose = async (color: string) => {
    try {
      await update.mutateAsync({ id: repo.id, color });
      setOpen(false);
    } catch (error) {
      toast(error, "error");
    }
  };
  return (
    <div className="relative inline-flex">
      <button
        aria-label="Change repository color"
        title="Change repository color"
        onClick={() => setOpen((value) => !value)}
        className="h-4 w-4 rounded-[4px] border-2 border-panel shadow-[0_0_0_1px_var(--bd2)]"
        style={{ background: repo.color }}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-44 flex-wrap gap-2 rounded-md border border-bd2 bg-panel p-3 shadow-xl">
          {REPOSITORY_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`Use ${color}`}
              onClick={() => void choose(color)}
              className="h-6 w-6 rounded-md border-0"
              style={{
                background: color,
                outline: color === repo.color ? "2px solid var(--tx)" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
