import { describe, expect, it } from "vitest";
import { initialState, reducer } from "../store";

describe("app store reducer", () => {
  it("nav switches view and closes the palette", () => {
    const s = reducer({ ...initialState, paletteOpen: true }, { type: "nav", view: "graph" });
    expect(s.view).toBe("graph");
    expect(s.paletteOpen).toBe(false);
  });

  it("pickRepo selects repo and lands on overview", () => {
    const s = reducer(initialState, { type: "pickRepo", index: 2 });
    expect(s.repo).toBe(2);
    expect(s.view).toBe("overview");
  });

  it("toggleTheme flips between dark and light", () => {
    const dark = reducer(initialState, { type: "toggleTheme" });
    expect(dark.theme).toBe("light");
    expect(reducer(dark, { type: "toggleTheme" }).theme).toBe("dark");
  });

  it("set applies partial patches without clobbering the rest", () => {
    const s = reducer(initialState, {
      type: "set",
      patch: { rightW: 400, uiZoom: 125, changesPanelW: 360 },
    });
    expect(s.rightW).toBe(400);
    expect(s.uiZoom).toBe(125);
    expect(s.changesPanelW).toBe(360);
    expect(s.view).toBe(initialState.view);
  });
});
