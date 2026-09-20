// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  afterEach(() => vi.useRealTimers());

  it("coalesces rapid filter edits into one settled value", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    rerender({ value: "abc" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(350));
    expect(result.current).toBe("abc");
  });
});
