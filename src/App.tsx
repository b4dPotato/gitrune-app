import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { RightPanel } from "./components/RightPanel";
import { CommandPalette } from "./components/CommandPalette";
import { AddRepoModal } from "./components/AddRepoModal";
import { DiscardModal } from "./components/DiscardModal";
import { SettingsModal } from "./components/SettingsModal";
import { IdentityBanner } from "./components/IdentityBanner";
import { useApp, useDispatch, useSet } from "./state/store";
import { ipc, type OperationProgress } from "./lib/ipc";
import {
  useCurrentRepo,
  useIdentityDetails,
  useOperationEvents,
  useStatus,
  useWatcherEvents,
} from "./lib/hooks";
import { useToast } from "./components/Toast";
import { VerticalResizeHandle } from "./components/layout/VerticalResizeHandle";
import { AppView } from "./components/layout/AppView";
import { useTranslation } from "react-i18next";
import { usePersistedSettings } from "./features/settings/usePersistedSettings";

export default function App() {
  const { t } = useTranslation();
  const s = useApp();
  const dispatch = useDispatch();
  const set = useSet();
  const repo = useCurrentRepo();
  const { data: status } = useStatus(repo?.path);
  const { data: identityDetails } = useIdentityDetails(repo?.path);
  const toast = useToast();
  const [runningOperation, setRunningOperation] = useState<OperationProgress | null>(null);
  usePersistedSettings();

  const onOperationProgress = useCallback((progress: OperationProgress) => {
    setRunningOperation(progress);
    if (["succeeded", "failed", "cancelled"].includes(progress.phase)) {
      window.setTimeout(
        () =>
          setRunningOperation((current) =>
            current?.operationId === progress.operationId ? null : current,
          ),
        2500,
      );
    }
  }, []);
  useOperationEvents(onOperationProgress);

  const identityWarn =
    !!repo && !!identityDetails && !identityDetails.localConfigured && !s.bannerDismissed;

  useWatcherEvents(repo?.path);

  const [winW, setWinW] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set({ paletteOpen: !s.paletteOpen, paletteQuery: "", paletteIdx: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.paletteOpen, set]);

  // panel drag-resize
  const drag = useRef<{ kind: "right" | "sb"; x: number; w: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === "right") {
        set({ rightW: Math.min(440, Math.max(240, d.w + (d.x - e.clientX))) });
      } else {
        set({ sbW: Math.min(340, Math.max(180, d.w + (e.clientX - d.x))) });
      }
    };
    const onUp = () => {
      drag.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [set]);

  const startRightResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = { kind: "right", x: e.clientX, w: s.rightW };
      document.body.style.cursor = "col-resize";
    },
    [s.rightW],
  );
  const startSbResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = { kind: "sb", x: e.clientX, w: s.sbW };
      document.body.style.cursor = "col-resize";
    },
    [s.sbW],
  );

  const view = s.view;

  return (
    <div
      data-theme={s.theme}
      className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-tx"
    >
      <TopBar winW={winW} identityWarn={identityWarn} repo={repo} status={status} />
      {identityWarn && (
        <IdentityBanner
          repository={repo?.name ?? "Repository"}
          identity={identityDetails?.effectiveEmail ?? "an unset Git identity"}
          onReviewRules={() => dispatch({ type: "nav", view: "accounts" })}
          onDismiss={() => set({ bannerDismissed: true })}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <Sidebar status={status} />
        {!s.sbCollapsed && (
          <VerticalResizeHandle
            label="Resize sidebar"
            onMouseDown={startSbResize}
            onDoubleClick={() => set({ sbW: 236 })}
            className="-ml-1 bg-transparent"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col bg-bg">
          <AppView view={view} repo={repo} status={status} />
        </div>

        <RightPanel winW={winW} onStartResize={startRightResize} />
      </div>

      <StatusBar
        status={status}
        progress={runningOperation}
        onCancel={async (operationId) => {
          try {
            await ipc.cancelOperation(operationId);
            toast(t("status.cancellationRequested"), "info");
          } catch (error) {
            toast(String(error), "error");
          }
        }}
      />

      {s.paletteOpen && <CommandPalette />}
      {s.addRepoOpen && <AddRepoModal />}
      {s.discardOpen && <DiscardModal />}
      {s.settingsOpen && <SettingsModal />}
    </div>
  );
}
