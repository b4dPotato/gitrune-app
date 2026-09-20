import React from "react";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { desktopRuntimeRequired } from "./lib/ipc";
import { ToastProvider } from "./components/Toast";
import { AppStateProvider } from "./state/store";
import "./i18n";
import "./styles/tokens.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5_000 },
  },
});

function Root() {
  const { t } = useTranslation();
  if (desktopRuntimeRequired()) {
    return (
      <div
        data-theme="dark"
        className="flex h-screen items-center justify-center bg-bg p-8 text-tx"
      >
        <div className="max-w-lg rounded-lg border border-bd2 bg-panel p-6 text-center shadow-xl">
          <div className="mb-2 text-lg font-bold">{t("runtime.title")}</div>
          <p className="text-[13px] leading-relaxed text-tx2">
            {t("runtime.description", {
              command: "npm run tauri dev",
              demo: "VITE_DEMO_MODE=true",
            })}
          </p>
        </div>
      </div>
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </AppStateProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
