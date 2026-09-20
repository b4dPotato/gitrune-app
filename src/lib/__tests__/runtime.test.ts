import { describe, expect, it } from "vitest";
import { desktopRuntimeRequired, ipc, isDemo } from "../ipc";

describe("browser runtime boundary", () => {
  it("never returns fake Git success unless explicit demo mode is enabled", async () => {
    expect(isDemo()).toBe(false);
    expect(desktopRuntimeRequired()).toBe(true);
    await expect(ipc.repoStatus("C:/not-a-repository")).rejects.toThrow(
      "requires the Tauri desktop runtime",
    );
  });
});
