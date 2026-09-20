import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useToast } from "../../components/Toast";
import { hunkPatch, linePatch } from "../../lib/gitparse";
import { ipc, operationError, type StatusFile, type UndoCommitPreview } from "../../lib/ipc";
import {
  useApplyPatch,
  useCommit,
  useCommitTemplate,
  useCurrentRepo,
  useDiff,
  useIdentity,
  usePush,
  useRemotes,
  useStashPush,
  useStatus,
  useUndoCommit,
} from "../../lib/hooks";
import { useApp, useSet } from "../../state/store";
import { useStagingQueue } from "./useStagingQueue";

export function useChangesViewModel() {
  const app = useApp();
  const set = useSet();
  const toast = useToast();
  const repo = useCurrentRepo();
  const { data: status } = useStatus(repo?.path);
  const { data: identity } = useIdentity(repo?.path);
  const { data: commitTemplate } = useCommitTemplate(repo?.path);
  const { data: remotes = [], isLoading: remotesLoading } = useRemotes(repo?.path);
  const applyPatch = useApplyPatch(repo?.path);
  const commit = useCommit(repo?.path);
  const push = usePush(repo?.path);
  const undoCommit = useUndoCommit(repo?.path);
  const stashPush = useStashPush(repo?.path);
  const [fileFilter, setFileFilter] = useState("");
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [sign, setSign] = useState(false);
  const [pushAfter, setPushAfter] = useState(false);
  const [commitError, setCommitError] = useState<unknown>(null);
  const [undoPreview, setUndoPreview] = useState<UndoCommitPreview | null>(null);
  const [amendPreview, setAmendPreview] = useState<UndoCommitPreview | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [stashOpen, setStashOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState("");
  const [stashUntracked, setStashUntracked] = useState(true);
  const panelDrag = useRef<{ startX: number; startWidth: number } | null>(null);

  const matches = (file: StatusFile) =>
    file.path.toLowerCase().includes(fileFilter.trim().toLowerCase());
  const staging = useStagingQueue(repo?.path, status?.files ?? []);
  const allUnstaged = useMemo(
    () => staging.files.filter((file) => !file.staged && !file.conflicted),
    [staging.files],
  );
  const allStaged = useMemo(() => staging.files.filter((file) => file.staged), [staging.files]);
  const unstaged = useMemo(() => allUnstaged.filter(matches), [allUnstaged, fileFilter]);
  const staged = useMemo(() => allStaged.filter(matches), [allStaged, fileFilter]);
  const selectedIndex = app.selStaged >= 0 ? unstaged.length + app.selStaged : app.selUnstaged;
  const allFiles = [...unstaged, ...staged];
  const selectedFile = allFiles[Math.min(selectedIndex, allFiles.length - 1)] ?? allFiles[0];
  const selectedIsStaged = selectedFile?.staged ?? false;
  const { data: diff } = useDiff(repo?.path, selectedFile?.path, selectedIsStaged);
  const activeBranch =
    !!status && !status.detached && !!status.branch && status.branch !== "(unborn)";
  const defaultRemote = remotes.find((remote) => remote.isDefault) ?? remotes[0];
  const pushAfterDisabled = remotesLoading || !activeBranch || !defaultRemote;
  const pushAfterDescription = remotesLoading
    ? "Waiting for remote configuration…"
    : !activeBranch
      ? "Push after commit requires an active branch."
      : !defaultRemote
        ? "Configure a remote on Overview before enabling push after commit."
        : status?.upstream
          ? `Push to ${status.upstream} after the commit succeeds.`
          : `Publish ${status?.branch} to ${defaultRemote.name} after the commit succeeds.`;

  useEffect(() => setSelectedLines(new Set()), [selectedFile?.path, selectedIsStaged]);
  useEffect(() => {
    if (pushAfterDisabled && pushAfter) setPushAfter(false);
  }, [pushAfter, pushAfterDisabled]);
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!panelDrag.current) return;
      const width = panelDrag.current.startWidth + event.clientX - panelDrag.current.startX;
      set({ changesPanelW: Math.min(520, Math.max(220, width)) });
    };
    const onUp = () => {
      panelDrag.current = null;
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

  const beginPanelResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    panelDrag.current = { startX: event.clientX, startWidth: app.changesPanelW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const toggleLine = (hunkIndex: number, rawIndex: number) => {
    const key = `${hunkIndex}:${rawIndex}`;
    setSelectedLines((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const applySelectedLines = async () => {
    if (!diff || selectedLines.size === 0) return;
    if (!(await staging.flush())) return;
    const selected = Array.from(selectedLines).map((key) => {
      const [hunkIdx, rawIndex] = key.split(":").map(Number);
      return { hunkIdx, rawIndex };
    });
    try {
      const result = await applyPatch.mutateAsync({
        patch: linePatch(diff, selected),
        reverse: selectedIsStaged,
      });
      if (result.success) {
        toast(selectedIsStaged ? "Selected lines unstaged" : "Selected lines staged", "ok");
        setSelectedLines(new Set());
      } else toast(result.stderr || "Patch could not be applied", "error");
    } catch (error) {
      toast(error, "error");
    }
  };
  const applyHunk = async (hunkIndex: number) => {
    if (!(await staging.flush())) return;
    if (diff) applyPatch.mutate({ patch: hunkPatch(diff, hunkIndex), reverse: selectedIsStaged });
  };
  const pushCommittedBranch = async () => {
    if (!status || !defaultRemote) return;
    if (status.upstream && status.behind > 0) {
      toast(
        "Commit created. Push was skipped because the upstream branch is ahead; pull and review before pushing.",
        "warn",
      );
      return;
    }
    const result = await push.mutateAsync(
      status.upstream
        ? {}
        : { setUpstream: true, branch: status.branch, remote: defaultRemote.name },
    );
    if (!result.success) throw operationError(result, "The commit succeeded, but the push failed");
    toast(
      status.upstream ? "Committed and pushed" : `Committed and published ${status.branch}`,
      "ok",
    );
  };
  const performCommit = async (allowPublishedAmend: boolean) => {
    setCommitError(null);
    try {
      const result = await commit.mutateAsync({ message, amend, sign, allowPublishedAmend });
      if (!result.success) {
        setCommitError(operationError(result, "Commit failed"));
        return;
      }
      if (!pushAfter) toast(amend ? "Commit amended" : "Committed", "ok");
      setMessage("");
      setAmend(false);
      if (pushAfter) await pushCommittedBranch();
    } catch (error) {
      setCommitError(error);
      toast(error, "error");
    }
  };
  const doCommit = async () => {
    if (!(await staging.flush())) return;
    if (amend && repo) {
      try {
        const preview = await ipc.undoCommitPreview(repo.path);
        if (preview.published) {
          setAmendPreview(preview);
          return;
        }
      } catch (error) {
        setCommitError(error);
        return;
      }
    }
    await performCommit(false);
  };
  const requestUndo = async () => {
    if (!repo) return;
    try {
      setUndoPreview(await ipc.undoCommitPreview(repo.path));
    } catch (error) {
      toast(error, "error");
    }
  };
  const confirmUndo = async () => {
    if (!undoPreview) return;
    const preview = undoPreview;
    setUndoPreview(null);
    try {
      const result = await undoCommit.mutateAsync({ allowPublished: preview.published });
      if (!result.success) throw operationError(result, "The last commit could not be undone");
      toast("Last commit undone — changes remain staged", "ok");
    } catch (error) {
      toast(error, "error");
    }
  };
  const doStash = async () => {
    try {
      if (!(await staging.flush())) return;
      const result = await stashPush.mutateAsync({
        message: stashMessage.trim(),
        includeUntracked: stashUntracked,
      });
      if (!result.success) {
        toast(result.stderr || "Changes could not be stashed", "error");
        return;
      }
      toast("Changes stashed", "ok");
      setStashMessage("");
      setStashOpen(false);
    } catch (error) {
      toast(error, "error");
    }
  };

  return {
    app,
    set,
    repo,
    status,
    identity,
    commitTemplate,
    unstaged,
    staged,
    unstagedTotal: allUnstaged.length,
    stagedTotal: allStaged.length,
    selectedFile,
    diff,
    fileFilter,
    setFileFilter,
    message,
    setMessage,
    amend,
    setAmend,
    sign,
    setSign,
    pushAfter,
    setPushAfter,
    pushAfterDisabled,
    pushAfterDescription,
    commitError,
    selectedLines,
    stashOpen,
    setStashOpen,
    stashMessage,
    setStashMessage,
    stashUntracked,
    setStashUntracked,
    undoPreview,
    setUndoPreview,
    amendPreview,
    setAmendPreview,
    stageFiles: staging.stage,
    unstageFiles: staging.unstage,
    stagingPendingCount: staging.pendingCount,
    applyPatch,
    commit,
    undoCommit,
    stashPush,
    beginPanelResize,
    toggleLine,
    applySelectedLines,
    applyHunk,
    doCommit,
    requestUndo,
    confirmUndo,
    doStash,
    performCommit,
  };
}
