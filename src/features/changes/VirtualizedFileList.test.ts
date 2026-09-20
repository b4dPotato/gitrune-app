import { describe, expect, it } from "vitest";
import { virtualFileRange } from "./VirtualizedFileList";

describe("virtualFileRange", () => {
  it("mounts only the visible window plus overscan for long lists", () => {
    expect(virtualFileRange(500, 2_600, 260)).toEqual({ start: 92, end: 118 });
  });

  it("clamps the range at both ends", () => {
    expect(virtualFileRange(12, 0, 260)).toEqual({ start: 0, end: 12 });
  });
});
