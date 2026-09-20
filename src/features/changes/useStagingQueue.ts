import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/Toast";
import { ipc, operationError, type StatusFile } from "../../lib/ipc";

const QUIET_WINDOW_MS = 500;
const MAX_BATCH_WAIT_MS = 1_500;

export type StagingIntent = ReadonlyMap<string, boolean>;

/**
 * Project pending index changes over Git's last confirmed status. This keeps
 * the UI responsive while the short staging batch is waiting or running.
 */
export function applyStagingOverlay(files: StatusFile[], intent: StagingIntent): StatusFile[] {
  if (intent.size === 0) return files;
  const candidatesByPath = new Map<string, StatusFile[]>();
  for (const file of files) {
    if (!intent.has(file.path)) continue;
    const candidates = candidatesByPath.get(file.path) ?? [];
    candidates.push(file);
    candidatesByPath.set(file.path, candidates);
  }
  const emitted = new Set<string>();
  const projected: StatusFile[] = [];

  for (const file of files) {
    const shouldBeStaged = intent.get(file.path);
    if (shouldBeStaged === undefined) {
      projected.push(file);
      continue;
    }
    if (emitted.has(file.path)) continue;
    emitted.add(file.path);

    const candidates = candidatesByPath.get(file.path) ?? [file];
    const source =
      candidates.find((candidate) => candidate.staged === shouldBeStaged) ??
      candidates.find((candidate) => candidate.staged !== shouldBeStaged) ??
      file;
    projected.push({
      ...source,
      st: shouldBeStaged && source.st === "?" ? "A" : source.st,
      staged: shouldBeStaged,
      conflicted: shouldBeStaged ? false : source.conflicted,
      untracked: shouldBeStaged ? false : source.untracked,
    });
  }
  return projected;
}

/** Optimistically coalesce rapid file toggles into at most two Git commands. */
export function useStagingQueue(path: string | undefined, confirmedFiles: StatusFile[]) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [intent, setIntent] = useState<Map<string, boolean>>(new Map());
  const intentRef = useRef(intent);
  const queuedRef = useRef<Map<string, boolean>>(new Map());
  const inFlightRef = useRef<Map<string, boolean>>(new Map());
  const quietTimerRef = useRef<number>();
  const maxTimerRef = useRef<number>();
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const confirmedStagedByPath = useMemo(() => {
    const state = new Map<string, boolean>();
    for (const file of confirmedFiles) {
      state.set(file.path, (state.get(file.path) ?? true) && file.staged);
    }
    return state;
  }, [confirmedFiles]);

  const clearTimers = useCallback(() => {
    if (quietTimerRef.current !== undefined) window.clearTimeout(quietTimerRef.current);
    if (maxTimerRef.current !== undefined) window.clearTimeout(maxTimerRef.current);
    quietTimerRef.current = undefined;
    maxTimerRef.current = undefined;
  }, []);

  const refreshAuthoritativeState = useCallback(async () => {
    if (!path) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["status", path], exact: true }),
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "diff" && query.queryKey[1] === path,
      }),
      queryClient.invalidateQueries({ queryKey: ["oplog"], exact: true }),
    ]);
  }, [path, queryClient]);

  const flush = useCallback(async () => {
    clearTimers();
    if (!path) return true;
    if (flushPromiseRef.current) {
      const currentSucceeded = await flushPromiseRef.current;
      const queuedSucceeded = queuedRef.current.size > 0 ? await flushRef.current() : true;
      return currentSucceeded && queuedSucceeded;
    }
    if (queuedRef.current.size === 0) return true;

    const batch = new Map(queuedRef.current);
    queuedRef.current.clear();
    inFlightRef.current = batch;
    const currentFlush = (async () => {
      let failure: unknown;
      try {
        const toStage: string[] = [];
        const toUnstage: string[] = [];
        for (const [file, staged] of batch) (staged ? toStage : toUnstage).push(file);

        if (toStage.length > 0) {
          const result = await ipc.stageFiles(path, toStage);
          if (!result.success) throw operationError(result, "Files could not be staged");
        }
        if (toUnstage.length > 0) {
          const result = await ipc.unstageFiles(path, toUnstage);
          if (!result.success) throw operationError(result, "Files could not be unstaged");
        }
      } catch (error) {
        failure = error;
      } finally {
        try {
          await refreshAuthoritativeState();
        } catch (error) {
          failure ??= error;
        }
        const next = new Map(intentRef.current);
        for (const [file, staged] of batch) {
          if (next.get(file) === staged && !queuedRef.current.has(file)) next.delete(file);
        }
        intentRef.current = next;
        setIntent(next);
        inFlightRef.current = new Map();
        if (failure) toast(failure, "error");
      }
      return failure === undefined;
    })();
    flushPromiseRef.current = currentFlush;
    let succeeded: boolean;
    try {
      succeeded = await currentFlush;
    } finally {
      if (flushPromiseRef.current === currentFlush) flushPromiseRef.current = null;
    }
    const queuedSucceeded = queuedRef.current.size > 0 ? await flushRef.current() : true;
    return succeeded && queuedSucceeded;
  }, [clearTimers, path, refreshAuthoritativeState, toast]);
  flushRef.current = flush;

  const queue = useCallback(
    (files: string[], staged: boolean) => {
      if (!path || files.length === 0) return;
      const next = new Map(intentRef.current);
      for (const file of files) {
        const confirmedStaged = confirmedStagedByPath.get(file) ?? false;
        const expectedAfterCurrentFlush = inFlightRef.current.get(file) ?? confirmedStaged;
        if (staged === expectedAfterCurrentFlush) {
          queuedRef.current.delete(file);
          next.delete(file);
        } else {
          queuedRef.current.set(file, staged);
          next.set(file, staged);
        }
      }
      intentRef.current = next;
      setIntent(next);

      if (quietTimerRef.current !== undefined) window.clearTimeout(quietTimerRef.current);
      quietTimerRef.current = window.setTimeout(() => void flushRef.current(), QUIET_WINDOW_MS);
      if (maxTimerRef.current === undefined) {
        maxTimerRef.current = window.setTimeout(() => void flushRef.current(), MAX_BATCH_WAIT_MS);
      }
    },
    [confirmedStagedByPath, path],
  );

  useEffect(
    () => () => {
      clearTimers();
      if (queuedRef.current.size > 0) void flush();
    },
    [clearTimers, flush],
  );

  return {
    files: useMemo(() => applyStagingOverlay(confirmedFiles, intent), [confirmedFiles, intent]),
    pendingCount: intent.size,
    stage: useCallback((files: string[]) => queue(files, true), [queue]),
    unstage: useCallback((files: string[]) => queue(files, false), [queue]),
    flush,
  };
}
