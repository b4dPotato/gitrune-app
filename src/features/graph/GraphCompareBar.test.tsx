// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphCompareBar } from "./GraphCompareBar";

afterEach(cleanup);

describe("GraphCompareBar", () => {
  it("communicates direction and swaps base and head", async () => {
    const user = userEvent.setup();
    const base = vi.fn();
    const head = vi.fn();
    render(
      <GraphCompareBar
        base="main"
        head="feature"
        refs={["main", "feature"]}
        selectedSha="abc123"
        comparison={null}
        onBaseChange={base}
        onHeadChange={head}
        onCompare={() => undefined}
        onExit={() => undefined}
      />,
    );
    expect(screen.getByText(/merge base to head/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /swap/i }));
    expect(base).toHaveBeenCalledWith("feature");
    expect(head).toHaveBeenCalledWith("main");
  });
});
