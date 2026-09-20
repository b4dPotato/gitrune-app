import { useEffect, useRef } from "react";
import i18n, { isSupportedLanguage } from "../../i18n";
import { inTauri, ipc } from "../../lib/ipc";
import { useApp, useSet } from "../../state/store";
import { nativeWindowTheme } from "./nativeTheme";

/** Hydrates, applies, and debounces persistence of all non-secret UI settings. */
export function usePersistedSettings() {
  const settings = useApp();
  const set = useSet();
  const hydrated = useRef(false);

  useEffect(() => {
    ipc.getSettings().then((stored) => {
      set({
        theme: stored.theme,
        language: isSupportedLanguage(stored.language) ? stored.language : "en",
        uiZoom: stored.uiZoom,
        customTheme: stored.customTheme,
        rightW: stored.rightPanelWidth,
        sbCollapsed: stored.sidebarCollapsed,
        sbW: stored.sidebarWidth,
        graphCommitW: stored.graphCommitWidth,
        graphFilesW: stored.graphFilesWidth,
        changesPanelW: stored.changesPanelWidth,
        diffMode: stored.diffMode,
        editor: stored.editor,
        editorAssociations: stored.editorAssociations,
        terminal: stored.terminal,
      });
      hydrated.current = true;
    });
  }, [set]);

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      void ipc.saveSettings({
        theme: settings.theme,
        language: settings.language,
        uiZoom: settings.uiZoom,
        customTheme: settings.customTheme,
        rightPanelWidth: settings.rightW,
        sidebarCollapsed: settings.sbCollapsed,
        sidebarWidth: settings.sbW,
        graphCommitWidth: settings.graphCommitW,
        graphFilesWidth: settings.graphFilesW,
        changesPanelWidth: settings.changesPanelW,
        diffMode: settings.diffMode,
        editor: settings.editor,
        editorAssociations: settings.editorAssociations,
        terminal: settings.terminal,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    settings.theme,
    settings.language,
    settings.uiZoom,
    settings.customTheme,
    settings.rightW,
    settings.sbCollapsed,
    settings.sbW,
    settings.graphCommitW,
    settings.graphFilesW,
    settings.changesPanelW,
    settings.diffMode,
    settings.editor,
    settings.editorAssociations,
    settings.terminal,
  ]);

  useEffect(() => {
    void i18n.changeLanguage(settings.language);
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.setProperty("--custom-bg", settings.customTheme.background);
    document.documentElement.style.setProperty("--custom-panel", settings.customTheme.panel);
    document.documentElement.style.setProperty("--custom-ac", settings.customTheme.accent);
    document.documentElement.style.setProperty("--custom-tx", settings.customTheme.text);
    if (inTauri()) {
      void import("@tauri-apps/api/app")
        .then(({ setTheme }) =>
          setTheme(nativeWindowTheme(settings.theme, settings.customTheme.background)),
        )
        .catch(() => undefined);
    }
  }, [settings.customTheme, settings.theme]);

  useEffect(() => {
    if (inTauri()) {
      void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
        getCurrentWebview().setZoom(settings.uiZoom / 100),
      );
      return;
    }
    document.documentElement.style.zoom = String(settings.uiZoom / 100);
    return () => {
      document.documentElement.style.zoom = "";
    };
  }, [settings.uiZoom]);

  useEffect(() => {
    const levels = [75, 80, 90, 100, 110, 125, 150];
    const onZoomKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === "0") {
        event.preventDefault();
        set({ uiZoom: 100 });
        return;
      }
      if (!["+", "=", "-", "_"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "-" || event.key === "_" ? -1 : 1;
      const current = levels.findIndex((level) => level >= settings.uiZoom);
      const index = Math.min(
        levels.length - 1,
        Math.max(0, (current < 0 ? levels.length - 1 : current) + direction),
      );
      set({ uiZoom: levels[index] });
    };
    window.addEventListener("keydown", onZoomKey);
    return () => window.removeEventListener("keydown", onZoomKey);
  }, [settings.uiZoom, set]);
}
