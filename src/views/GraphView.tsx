import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../components/Toast";
import { NewBranchModal } from "../features/branches/NewBranchModal";
import {
  ipc,
  type BlameLine,
  type CommitComparison,
  type CommitRecord,
  type CompareFile,
  type LineHistoryEntry,
} from "../lib/ipc";
import { parseDiff, type CommitInfo } from "../lib/gitparse";
import { layoutGraph } from "../lib/graphlayout";
import {
  useCherryPick,
  useCurrentRepo,
  useGraphPages,
  useRevertCommit,
  useStatus,
} from "../lib/hooks";
import { useApp, useSet } from "../state/store";
import { VerticalResizeHandle } from "../components/layout/VerticalResizeHandle";
import { COMMIT_ROW_HEIGHT as ROW_HEIGHT } from "../features/graph/CommitGraphCell";
import { GraphCompareBar } from "../features/graph/GraphCompareBar";
import { useRefs } from "../lib/hooks";
import { GraphToolbar, type GraphFilters } from "../features/graph/GraphToolbar";
import { GraphCommitList } from "../features/graph/GraphCommitList";
import { GraphChangedFileList } from "../features/graph/GraphChangedFileList";
import { GraphHistoryResults } from "../features/graph/GraphHistoryResults";
import { GraphDiffPanel } from "../features/graph/GraphDiffPanel";
import { MAX_GRAPH_COMMITS } from "../lib/limits";
import { useOperationRunner } from "../lib/useOperationRunner";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const OVERSCAN = 10;
const graphViewportByRepo = new Map<string, { selectedSha: string | null; scrollTop: number }>();

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
function toCommitInfo(commit: CommitRecord): CommitInfo {
  return {
    sha: commit.sha,
    parents: commit.parents,
    author: commit.author,
    ini: initials(commit.author),
    time: commit.relativeTime,
    msg: commit.subject,
    refs: commit.decorations.map((raw) => {
      const value = raw.replace(/^HEAD -> /, "");
      if (value.startsWith("tag: ")) return { n: value.slice(5), k: "tag" as const };
      if (/^[^/]+\//.test(value)) return { n: value, k: "remote" as const };
      return { n: value, k: "local" as const };
    }),
  };
}
function parseCommitFiles(raw: string): CompareFile[] {
  return raw
    .split("\n")
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return {
        status: status.trim().charAt(0),
        path: paths[paths.length - 1],
        oldPath: paths.length > 1 ? paths[0] : null,
      };
    });
}

export function GraphView() {
  const app = useApp();
  const set = useSet();
  const repo = useCurrentRepo();
  const toast = useToast();
  const run = useOperationRunner();
  const { data: status } = useStatus(repo?.path);
  const { data: refs = [] } = useRefs(repo?.path);
  const [message, setMessage] = useState("");
  const [author, setAuthor] = useState("");
  const [revision, setRevision] = useState("");
  const [filePath, setFilePath] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [compareBase, setCompareBase] = useState("");
  const [compareHead, setCompareHead] = useState("");
  const [comparison, setComparison] = useState<CommitComparison | null>(null);
  const [history, setHistory] = useState<CommitRecord[] | null>(null);
  const [blame, setBlame] = useState<BlameLine[] | null>(null);
  const [lineHistory, setLineHistory] = useState<LineHistoryEntry[] | null>(null);
  const [lineStart, setLineStart] = useState("1");
  const [lineEnd, setLineEnd] = useState("1");
  const [selectedFile, setSelectedFile] = useState("");
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const visibleFilters: GraphFilters = {
    message,
    author,
    revision,
    filePath,
    since,
    until,
    lineStart,
    lineEnd,
  };
  const updateFilters = (patch: Partial<GraphFilters>) => {
    if (patch.message !== undefined) setMessage(patch.message);
    if (patch.author !== undefined) setAuthor(patch.author);
    if (patch.revision !== undefined) setRevision(patch.revision);
    if (patch.filePath !== undefined) setFilePath(patch.filePath);
    if (patch.since !== undefined) setSince(patch.since);
    if (patch.until !== undefined) setUntil(patch.until);
    if (patch.lineStart !== undefined) setLineStart(patch.lineStart);
    if (patch.lineEnd !== undefined) setLineEnd(patch.lineEnd);
  };
  const splitDrag = useRef<{
    pane: "commits" | "files";
    startX: number;
    startWidth: number;
  } | null>(null);
  const commitListRef = useRef<HTMLDivElement | null>(null);
  const selectedShaRef = useRef<string | null>(app.selCommitSha);
  const scrollTopRef = useRef(0);
  const cherryPick = useCherryPick(repo?.path);
  const revert = useRevertCommit(repo?.path);
  const filterDraft = useMemo(
    () => ({
      message: message.trim() || undefined,
      author: author.trim() || undefined,
      revision: revision.trim() || undefined,
      filePath: filePath.trim() || undefined,
      since: since || undefined,
      until: until || undefined,
    }),
    [message, author, revision, filePath, since, until],
  );
  const filters = useDebouncedValue(filterDraft, 350);
  const query = useGraphPages(repo?.path, filters);
  const records = useMemo(
    () => (query.data?.pages.flatMap((page) => page.commits) ?? []).slice(0, MAX_GRAPH_COMMITS),
    [query.data],
  );
  const commits = useMemo(() => records.map(toCommitInfo), [records]);
  const graphLimitReached =
    records.length >= MAX_GRAPH_COMMITS &&
    !!query.data?.pages[query.data.pages.length - 1]?.nextCursor;
  const layout = useMemo(() => layoutGraph(commits), [commits]);
  const { data: outgoingComparison } = useQuery({
    queryKey: ["outgoingCommits", repo?.path, status?.upstream, status?.ahead],
    queryFn: () => ipc.compareCommits(repo!.path, status!.upstream!, "HEAD"),
    enabled: !!repo && !!status?.upstream && status.ahead > 0,
  });
  const outgoingShas = useMemo(
    () => new Set(outgoingComparison?.commits.map((commit) => commit.sha) ?? []),
    [outgoingComparison],
  );
  const selected = records.find((commit) => commit.sha === app.selCommitSha) ?? records[0];
  const graphWidth = useMemo(
    () =>
      Math.max(
        42,
        18 +
          layout.reduce(
            (max, row) =>
              Math.max(
                max,
                row.lane,
                ...row.v.map(([lane]) => lane),
                ...row.curves.map((curve) => curve.lane),
              ),
            0,
          ) *
            12,
      ),
    [layout],
  );
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(
    commits.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = splitDrag.current;
      if (!drag) return;
      const width = drag.startWidth + event.clientX - drag.startX;
      if (drag.pane === "commits") set({ graphCommitW: Math.min(600, Math.max(220, width)) });
      else set({ graphFilesW: Math.min(500, Math.max(160, width)) });
    };
    const onUp = () => {
      if (!splitDrag.current) return;
      splitDrag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [set]);
  const beginResize = (pane: "commits" | "files", event: ReactMouseEvent) => {
    splitDrag.current = {
      pane,
      startX: event.clientX,
      startWidth: pane === "commits" ? app.graphCommitW : app.graphFilesW,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  useEffect(() => {
    selectedShaRef.current = app.selCommitSha;
  }, [app.selCommitSha]);
  useEffect(() => {
    const path = repo?.path;
    if (!path) return;
    const saved = graphViewportByRepo.get(path);
    if (saved?.selectedSha) set({ selCommitSha: saved.selectedSha });
    if (saved) {
      setScrollTop(saved.scrollTop);
      scrollTopRef.current = saved.scrollTop;
      window.requestAnimationFrame(() => {
        if (commitListRef.current) commitListRef.current.scrollTop = saved.scrollTop;
      });
    }
    return () => {
      graphViewportByRepo.set(path, {
        selectedSha: selectedShaRef.current,
        scrollTop: scrollTopRef.current,
      });
    };
  }, [repo?.path, set]);
  useEffect(() => {
    if (commits.length > 0 && !app.selCommitSha)
      set({ selCommit: 0, selCommitSha: commits[0].sha });
  }, [app.selCommitSha, commits, set]);
  const { data: commitFilesRaw = "" } = useQuery({
    queryKey: ["commitFiles", repo?.path, selected?.sha],
    queryFn: () => ipc.commitFiles(repo!.path, selected!.sha),
    enabled: !!repo && !!selected && !comparison,
  });
  const commitFiles = useMemo(() => parseCommitFiles(commitFilesRaw), [commitFilesRaw]);
  const files = comparison?.files ?? commitFiles;
  useEffect(() => {
    setSelectedFile((current) =>
      files.some((file) => file.path === current) ? current : (files[0]?.path ?? ""),
    );
  }, [files]);
  const { data: rawDiff = "" } = useQuery({
    queryKey: [
      comparison ? "compareFileDiff" : "commitFileDiff",
      repo?.path,
      comparison?.base ?? selected?.sha,
      comparison?.head,
      selectedFile,
    ],
    queryFn: () =>
      comparison
        ? ipc.compareFileDiff(repo!.path, comparison.base, comparison.head, selectedFile)
        : ipc.commitFileDiff(repo!.path, selected!.sha, selectedFile),
    enabled: !!repo && !!selectedFile && (!!comparison || !!selected),
  });
  const diff = useMemo(() => (rawDiff ? parseDiff(rawDiff) : null), [rawDiff]);
  const compare = async () => {
    if (!repo || !compareBase.trim() || !compareHead.trim()) return;
    try {
      setComparison(await ipc.compareCommits(repo.path, compareBase.trim(), compareHead.trim()));
    } catch (error) {
      toast(error, "error");
    }
  };
  const loadFileHistory = async () => {
    if (!repo || !filePath.trim()) return;
    try {
      setBlame(null);
      setLineHistory(null);
      setHistory(await ipc.fileHistory(repo.path, filePath.trim()));
    } catch (error) {
      toast(error, "error");
    }
  };
  const loadBlame = async () => {
    if (!repo || !filePath.trim()) return;
    try {
      setHistory(null);
      setLineHistory(null);
      setBlame(await ipc.blameFile(repo.path, filePath.trim()));
    } catch (error) {
      toast(error, "error");
    }
  };
  const loadLineHistory = async () => {
    if (!repo || !filePath.trim()) return;
    const first = Number(lineStart);
    const last = Number(lineEnd);
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first) {
      toast("Enter a valid 1-based line range", "warn");
      return;
    }
    try {
      setHistory(null);
      setBlame(null);
      setLineHistory(await ipc.lineHistory(repo.path, filePath.trim(), first, last));
    } catch (error) {
      toast(error, "error");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GraphToolbar
        filtersOpen={filtersOpen}
        compareOpen={compareOpen}
        comparing={!!comparison}
        summary={
          comparison
            ? `Comparing ${comparison.base} … ${comparison.head} · ${comparison.files.length} files`
            : `${commits.length} commits loaded${graphLimitReached ? " · refine filters to load older history" : ""}`
        }
        filters={visibleFilters}
        onToggleFilters={() => setFiltersOpen((value) => !value)}
        onToggleCompare={() => setCompareOpen((value) => !value)}
        onFiltersChange={updateFilters}
        onFileHistory={() => void loadFileHistory()}
        onBlame={() => void loadBlame()}
        onLineHistory={() => void loadLineHistory()}
        onClear={() => {
          setMessage("");
          setAuthor("");
          setRevision("");
          setFilePath("");
          setSince("");
          setUntil("");
        }}
      />
      {compareOpen && (
        <GraphCompareBar
          base={compareBase}
          head={compareHead}
          refs={refs.map((ref) => ref.name)}
          selectedSha={selected?.sha}
          comparison={comparison}
          onBaseChange={setCompareBase}
          onHeadChange={setCompareHead}
          onCompare={() => void compare()}
          onExit={() => setComparison(null)}
        />
      )}
      <GraphHistoryResults
        filePath={filePath}
        lineStart={lineStart}
        lineEnd={lineEnd}
        history={history}
        blame={blame}
        lineHistory={lineHistory}
        onClose={() => {
          setHistory(null);
          setBlame(null);
          setLineHistory(null);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <GraphCommitList
          listRef={commitListRef}
          width={app.graphCommitW}
          graphWidth={graphWidth}
          commits={commits}
          layout={layout}
          start={start}
          end={end}
          selectedSha={app.selCommitSha}
          comparing={!!comparison}
          outgoingShas={outgoingShas}
          loading={query.isLoading || query.isFetchingNextPage}
          onScroll={(event) => {
            const element = event.currentTarget;
            scrollTopRef.current = element.scrollTop;
            setScrollTop(element.scrollTop);
            setViewportHeight(element.clientHeight);
            if (
              query.hasNextPage &&
              !query.isFetchingNextPage &&
              element.scrollTop + element.clientHeight > element.scrollHeight - ROW_HEIGHT * 8
            )
              void query.fetchNextPage();
          }}
          onSelect={(index, sha) => {
            set({ selCommit: index, selCommitSha: sha });
            setComparison(null);
          }}
        />
        <VerticalResizeHandle
          label="Resize commit list"
          onMouseDown={(event) => beginResize("commits", event)}
          onDoubleClick={() => set({ graphCommitW: 340 })}
        />
        <GraphChangedFileList
          width={app.graphFilesW}
          files={files}
          selectedPath={selectedFile}
          onSelect={setSelectedFile}
        />
        <VerticalResizeHandle
          label="Resize changed files"
          onMouseDown={(event) => beginResize("files", event)}
          onDoubleClick={() => set({ graphFilesW: 250 })}
        />
        <GraphDiffPanel
          repoPath={repo?.path}
          selectedFile={selectedFile}
          selected={selected}
          comparison={comparison}
          diff={diff}
          mode={app.diffMode}
          onModeChange={(diffMode) => set({ diffMode })}
          onCopy={(value, message) => {
            void navigator.clipboard?.writeText(value);
            toast(message, "ok");
          }}
          onNewBranch={() => setNewBranchOpen(true)}
          onCherryPick={() =>
            selected &&
            void run(
              cherryPick.mutateAsync(selected.sha),
              `Cherry-picked ${selected.sha.slice(0, 10)}`,
            )
          }
          onRevert={() =>
            selected &&
            void run(revert.mutateAsync(selected.sha), `Reverted ${selected.sha.slice(0, 10)}`)
          }
        />
      </div>
      <NewBranchModal
        open={newBranchOpen}
        repoPath={repo?.path}
        at={selected?.sha}
        onClose={() => setNewBranchOpen(false)}
      />
    </div>
  );
}
