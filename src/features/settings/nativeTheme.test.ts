import { describe, expect, it } from "vitest";
import { nativeWindowTheme } from "./nativeTheme";

describe("nativeWindowTheme", () => {
  it("uses dark chrome for dark curated themes", () => {
    expect(nativeWindowTheme("nord", "#ffffff")).toBe("dark");
  });

  it("derives custom native chrome from the custom background", () => {
    expect(nativeWindowTheme("custom", "#f4f5f6")).toBe("light");
    expect(nativeWindowTheme("custom", "#111827")).toBe("dark");
  });
});
