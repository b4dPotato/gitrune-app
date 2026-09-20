/** Global UI state (view routing, selection, layout, theme).
 * Server/git data flows through TanStack Query + ipc.ts; this store only
 * holds client state, mirroring the prototype's single state object. */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { DEFAULT_CUSTOM_THEME, type CustomTheme, type Theme, type ViewId } from "../lib/types";
import type { EditorId } from "../lib/ipc";
import type { SupportedLanguage } from "../i18n";

export interface AppState {
  view: ViewId;
  theme: Theme;
  language: SupportedLanguage;
  uiZoom: number;
  customTheme: CustomTheme;
  repo: number;
  paletteOpen: boolean;
  paletteQuery: string;
  paletteIdx: number;
  rightW: number;
  sbCollapsed: boolean;
  sbW: number;
  graphCommitW: number;
  graphFilesW: number;
  changesPanelW: number;
  addRepoOpen: boolean;
  settingsOpen: boolean;
  remoteSetupRequest: number;
  bannerDismissed: boolean;
  addColor: number;
  selUnstaged: number;
  selStaged: number;
  diffMode: "inline" | "side";
  editor: EditorId | "auto";
  editorAssociations: Record<string, EditorId>;
  terminal: "auto" | "wt" | "cmd" | "powershell";
  discardOpen: boolean;
  discardPath: string | null;
  fetching: boolean;
  selCommit: number;
  selCommitSha: string | null;
  selConflict: number;
  expandedOp: number;
  selPRFile: number;
}

export const initialState: AppState = {
  view: "changes",
  theme: "dark",
  language: "en",
  uiZoom: 100,
  customTheme: DEFAULT_CUSTOM_THEME,
  repo: 0,
  paletteOpen: false,
  paletteQuery: "",
  paletteIdx: 0,
  rightW: 312,
  sbCollapsed: false,
  sbW: 236,
  graphCommitW: 340,
  graphFilesW: 250,
  changesPanelW: 290,
  addRepoOpen: false,
  settingsOpen: false,
  remoteSetupRequest: 0,
  bannerDismissed: false,
  addColor: 0,
  selUnstaged: 0,
  selStaged: -1,
  diffMode: "inline",
  editor: "auto",
  editorAssociations: {},
  terminal: "auto",
  discardOpen: false,
  discardPath: null,
  fetching: false,
  selCommit: 0,
  selCommitSha: null,
  selConflict: 0,
  expandedOp: -1,
  selPRFile: 1,
};

export type Action =
  | { type: "nav"; view: ViewId }
  | { type: "pickRepo"; index: number }
  | { type: "toggleTheme" }
  | { type: "set"; patch: Partial<AppState> };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "nav":
      return { ...state, view: action.view, paletteOpen: false };
    case "pickRepo":
      return {
        ...state,
        repo: action.index,
        paletteOpen: false,
        view: "overview",
        selUnstaged: 0,
        selStaged: -1,
        selCommit: 0,
        selCommitSha: null,
        bannerDismissed: false,
      };
    case "toggleTheme":
      return { ...state, theme: state.theme === "light" ? "dark" : "light" };
    case "set":
      return { ...state, ...action.patch };
  }
}

const StateCtx = createContext<AppState>(initialState);
const DispatchCtx = createContext<Dispatch<Action>>(() => {});

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const memo = useMemo(() => state, [state]);
  return (
    <StateCtx.Provider value={memo}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useApp(): AppState {
  return useContext(StateCtx);
}

export function useDispatch(): Dispatch<Action> {
  return useContext(DispatchCtx);
}

/** convenience patch helper matching the prototype's setState */
export function useSet() {
  const dispatch = useDispatch();
  return useCallback((patch: Partial<AppState>) => dispatch({ type: "set", patch }), [dispatch]);
}
