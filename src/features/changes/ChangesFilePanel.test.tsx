// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StatusFile } from "../../lib/ipc";
import { ChangesFilePanel } from "./ChangesFilePanel";

function file(path: string, staged: boolean): StatusFile {
  return {
    path,
    origPath: null,
    st: "M",
    staged,
    conflicted: false,
    untracked: false,
  };
}

describe("ChangesFilePanel", () => {
  it("keeps staged files and both totals visible beside a virtualized long list", () => {
    const unstaged = Array.from({ length: 300 }, (_, index) => file(`src/file-${index}.ts`, false));
    const staged = [file("staged-a.txt", true), file("staged-b.txt", true)];
    const noop = vi.fn();

    render(
      <ChangesFilePanel
        width={320}
        filter=""
        unstaged={unstaged}
        staged={staged}
        unstagedTotal={300}
        stagedTotal={2}
        stagingPendingCount={0}
        selectedUnstaged={0}
        selectedStaged={-1}
        stashOpen={false}
        stashMessage=""
        stashUntracked={false}
        stashBusy={false}
        onFilterChange={noop}
        onToggleStash={noop}
        onStashMessageChange={noop}
        onStashUntrackedChange={noop}
        onStash={noop}
        onSelectUnstaged={noop}
        onSelectStaged={noop}
        onStage={noop}
        onUnstage={noop}
      >
        <div>Composer</div>
      </ChangesFilePanel>,
    );

    expect(screen.getByText("Unstaged").parentElement?.textContent).toContain("300");
    expect(screen.getByText("Staged").parentElement?.textContent).toContain("2");
    expect(screen.getByText("staged-a.txt")).toBeTruthy();
    expect(screen.queryByText("file-250.ts")).toBeNull();
  });
});
