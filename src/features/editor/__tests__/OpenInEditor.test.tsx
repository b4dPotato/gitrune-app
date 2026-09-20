// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpenInEditor } from "../OpenInEditor";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  listEditors: vi.fn(async () => [
    { id: "code" as const, label: "Visual Studio Code", recommended: true, icon: "code" as const },
    { id: "notepad" as const, label: "Notepad", recommended: false, icon: "notepad" as const },
    {
      id: "system" as const,
      label: "System default",
      recommended: false,
      icon: "code" as const,
      detail: "Opens with Visual Studio Code",
    },
  ]),
  openInEditor: vi.fn(async () => undefined),
}));

vi.mock("../../../lib/ipc", () => ({
  ipc: { listEditors: mocks.listEditors, openInEditor: mocks.openInEditor },
  errorText: (error: unknown) => String(error),
}));
vi.mock("../../../state/store", () => ({
  useApp: () => ({ editorAssociations: {} }),
  useSet: () => mocks.set,
}));
vi.mock("../../../components/Toast", () => ({ useToast: () => vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OpenInEditor", () => {
  it("shows editor logos and resolves the system default application", async () => {
    const user = userEvent.setup();
    render(<OpenInEditor repoPath="C:/repo" file="README.md" />);

    await user.click(screen.getByRole("button", { name: "Open in editor" }));

    expect(await screen.findByRole("dialog", { name: "Open in editor" })).toBeTruthy();
    expect(screen.getByText("Opens with Visual Studio Code")).toBeTruthy();
    expect(document.querySelectorAll("[data-editor-icon='code']")).toHaveLength(2);
    expect(document.querySelectorAll("[data-editor-icon='notepad']")).toHaveLength(1);
  });
});
