// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { afterEach, vi } from "vitest";
import { ipc, type OpResult, type StatusFile } from "../../lib/ipc";
import { applyStagingOverlay, useStagingQueue } from "./useStagingQueue";

function file(path: string, staged: boolean, st = "M"): StatusFile {
  return {
    path,
    origPath: null,
    st,
    staged,
    conflicted: false,
    untracked: st === "?",
  };
}

describe("applyStagingOverlay", () => {
  it("moves a file immediately without waiting for Git", () => {
    const projected = applyStagingOverlay(
      [file("one.ts", false), file("two.ts", false)],
      new Map([["one.ts", true]]),
    );
    expect(projected).toEqual([file("one.ts", true), file("two.ts", false)]);
  });

  it("collapses a mixed index/worktree file into its requested state", () => {
    const projected = applyStagingOverlay(
      [file("mixed.ts", true), file("mixed.ts", false)],
      new Map([["mixed.ts", true]]),
    );
    expect(projected).toHaveLength(1);
    expect(projected[0].staged).toBe(true);
  });

  it("shows an untracked file as an added file while staging is pending", () => {
    const projected = applyStagingOverlay(
      [file("new.ts", false, "?")],
      new Map([["new.ts", true]]),
    );
    expect(projected[0]).toMatchObject({ st: "A", staged: true, untracked: false });
  });
});

describe("useStagingQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("updates immediately and combines rapid staging clicks into one Git call", async () => {
    vi.useFakeTimers();
    const result: OpResult = {
      operationId: 1,
      status: "succeeded",
      command: "git add -- one.ts two.ts",
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      previousHead: "abc",
      resultingHead: "abc",
      durationMs: 1,
      recoveryId: null,
    };
    const stage = vi.spyOn(ipc, "stageFiles").mockResolvedValue(result);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const files = [file("one.ts", false), file("two.ts", false)];
    const hook = renderHook(() => useStagingQueue("C:/repo", files), { wrapper });

    act(() => {
      hook.result.current.stage(["one.ts"]);
      hook.result.current.stage(["two.ts"]);
    });
    expect(hook.result.current.files.every((entry) => entry.staged)).toBe(true);
    expect(stage).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(stage).toHaveBeenCalledTimes(1);
    expect(stage).toHaveBeenCalledWith("C:/repo", ["one.ts", "two.ts"]);
  });
});
