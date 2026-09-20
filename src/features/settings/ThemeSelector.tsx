import { DEFAULT_CUSTOM_THEME, type CustomTheme, type Theme } from "../../lib/types";

const themes: { id: Theme; label: string; colors: [string, string, string] }[] = [
  { id: "dark", label: "Gitrune Dark", colors: ["#0e1216", "#141a1f", "#34c0a2"] },
  { id: "light", label: "Gitrune Light", colors: ["#edf0f2", "#ffffff", "#087f6d"] },
  { id: "dracula", label: "Dracula", colors: ["#282a36", "#44475a", "#bd93f9"] },
  { id: "nord", label: "Nord", colors: ["#2e3440", "#3b4252", "#88c0d0"] },
  { id: "solarized", label: "Solarized", colors: ["#002b36", "#073642", "#2aa198"] },
  {
    id: "custom",
    label: "Custom",
    colors: [
      DEFAULT_CUSTOM_THEME.background,
      DEFAULT_CUSTOM_THEME.panel,
      DEFAULT_CUSTOM_THEME.accent,
    ],
  },
];

export function ThemeSelector({
  theme,
  customTheme,
  onThemeChange,
  onCustomThemeChange,
}: {
  theme: Theme;
  customTheme: CustomTheme;
  onThemeChange: (theme: Theme) => void;
  onCustomThemeChange: (theme: CustomTheme) => void;
}) {
  const customColors: { key: keyof CustomTheme; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "panel", label: "Panels" },
    { key: "accent", label: "Accent" },
    { key: "text", label: "Text" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {themes.map((option) => (
          <button
            key={option.id}
            onClick={() => onThemeChange(option.id)}
            aria-pressed={theme === option.id}
            className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[11.5px] hover:bg-hov"
            style={{
              borderColor: theme === option.id ? "var(--ac)" : "var(--bd)",
              background: theme === option.id ? "var(--acbg)" : "var(--panel2)",
            }}
          >
            <span className="flex overflow-hidden rounded border border-black/15">
              {(option.id === "custom"
                ? [customTheme.background, customTheme.panel, customTheme.accent]
                : option.colors
              ).map((color) => (
                <span key={color} className="h-5 w-3" style={{ background: color }} />
              ))}
            </span>
            <span className={theme === option.id ? "font-semibold text-tx" : "text-tx2"}>
              {option.label}
            </span>
          </button>
        ))}
      </div>
      {theme === "custom" && (
        <div className="grid grid-cols-4 gap-2 rounded-md border border-bd bg-bg p-2.5">
          {customColors.map(({ key, label }) => (
            <label key={key} className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-tx2">
              <input
                type="color"
                value={customTheme[key]}
                onChange={(event) =>
                  onCustomThemeChange({ ...customTheme, [key]: event.target.value })
                }
                className="h-7 w-8 cursor-pointer rounded border border-bd bg-transparent p-0.5"
              />
              <span className="truncate">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
