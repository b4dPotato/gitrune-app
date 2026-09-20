import { useQuery } from "@tanstack/react-query";
import { ipc, isDemo, type EditorId } from "../lib/ipc";
import { useApp, useSet } from "../state/store";
import { ThemeSelector } from "../features/settings/ThemeSelector";
import { ZoomControl } from "../features/settings/ZoomControl";
import { ActionButton } from "./ui/ActionButton";
import { LanguageSelector } from "../features/settings/LanguageSelector";
import { useTranslation } from "react-i18next";

/** Persisted, non-secret local application settings. */
export function SettingsModal() {
  const { t } = useTranslation();
  const s = useApp();
  const set = useSet();
  const close = () => set({ settingsOpen: false });
  const { data: gitInfo } = useQuery({ queryKey: ["gitInfo"], queryFn: ipc.detectGit });
  const { data: editors = [] } = useQuery({
    queryKey: ["editors"],
    queryFn: () => ipc.listEditors(),
  });

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("common.settings")}
        className="max-h-[90vh] w-[620px] max-w-[94vw] overflow-hidden rounded-lg border border-bd2 bg-panel shadow-[0_16px_48px_rgba(0,0,0,.4)]"
      >
        <div className="px-4 pb-[10px] pt-[14px] text-[14px] font-bold">{t("common.settings")}</div>

        <div className="flex max-h-[calc(90vh-100px)] flex-col gap-4 overflow-y-auto px-4 pb-3">
          <section>
            <div className="section-label mb-2">{t("settings.appearance")}</div>
            <ThemeSelector
              theme={s.theme}
              customTheme={s.customTheme}
              onThemeChange={(theme) => set({ theme })}
              onCustomThemeChange={(customTheme) => set({ customTheme })}
            />
          </section>

          <LanguageSelector value={s.language} onChange={(language) => set({ language })} />

          <div className="flex items-center gap-3 border-t border-bd pt-3">
            <span className="w-28 flex-none text-[12px] text-tx2">
              {t("settings.interfaceZoom")}
            </span>
            <ZoomControl value={s.uiZoom} onChange={(uiZoom) => set({ uiZoom })} />
            <span className="text-[10.5px] text-tx3">{t("settings.zoomHint")}</span>
          </div>

          <div className="section-label border-t border-bd pt-3">{t("settings.tools")}</div>

          <div className="flex items-center gap-3">
            <label className="w-28 flex-none text-[12px] text-tx2" htmlFor="editor-setting">
              {t("settings.editor")}
            </label>
            <select
              id="editor-setting"
              value={s.editor}
              onChange={(e) => set({ editor: e.target.value as typeof s.editor })}
              className="input flex-1"
            >
              <option value="auto">{t("settings.autoDetect")}</option>
              <option value="code">Visual Studio Code</option>
              <option value="codium">VSCodium</option>
              <option value="notepad">Notepad</option>
              <option value="system">{t("settings.systemDefault")}</option>
            </select>
          </div>

          {Object.entries(s.editorAssociations).length > 0 && (
            <div className="flex items-start gap-3">
              <span className="w-28 flex-none pt-1 text-[12px] text-tx2">
                {t("settings.fileTypes")}
              </span>
              <div className="flex flex-1 flex-col gap-1.5">
                {Object.entries(s.editorAssociations).map(([extension, editor]) => (
                  <div key={extension} className="flex items-center gap-2">
                    <span className="w-14 font-mono text-[11px] text-tx2">{extension}</span>
                    <select
                      value={editor}
                      onChange={(event) =>
                        set({
                          editorAssociations: {
                            ...s.editorAssociations,
                            [extension]: event.target.value as EditorId,
                          },
                        })
                      }
                      className="input min-w-0 flex-1"
                    >
                      {editors.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label={t("settings.forgetEditor", { extension })}
                      title={t("settings.useChooserNextTime")}
                      onClick={() => {
                        const next = { ...s.editorAssociations };
                        delete next[extension];
                        set({ editorAssociations: next });
                      }}
                      className="icon-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="w-28 flex-none text-[12px] text-tx2" htmlFor="terminal-setting">
              {t("settings.terminal")}
            </label>
            <select
              id="terminal-setting"
              value={s.terminal}
              onChange={(e) => set({ terminal: e.target.value as typeof s.terminal })}
              className="input flex-1"
            >
              <option value="auto">{t("settings.autoDetect")}</option>
              <option value="wt">Windows Terminal</option>
              <option value="powershell">PowerShell</option>
              <option value="cmd">Command Prompt</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-28 flex-none text-[12px] text-tx2">{t("settings.git")}</span>
            <span className="font-mono text-[12px] text-tx">
              {gitInfo ? `${gitInfo.path} · v${gitInfo.version}` : t("common.detecting")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-28 flex-none text-[12px] text-tx2">{t("settings.mode")}</span>
            <span className="text-[12px]">
              {isDemo() ? (
                <span className="rounded-[4px] bg-infbg px-[7px] py-px text-inf">
                  {t("settings.demoMode")}
                </span>
              ) : (
                <span className="rounded-[4px] bg-okbg px-[7px] py-px text-ok">
                  {t("settings.desktopMode")}
                </span>
              )}
            </span>
          </div>

          <div className="rounded border border-bd bg-bg px-3 py-2 text-[11.5px] leading-relaxed text-tx2">
            {t("settings.localNotice")}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-bd bg-panel2 px-4 py-3">
          <ActionButton onClick={close}>{t("common.close")}</ActionButton>
        </div>
      </div>
    </div>
  );
}
