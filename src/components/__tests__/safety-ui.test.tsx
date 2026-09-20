// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ErrorNotice } from "../ErrorNotice";
import { StatusBar } from "../StatusBar";
import { ValidatedRefInput } from "../ValidatedRefInput";
import { DiscardModal } from "../DiscardModal";
import { Avatar } from "../ui/Avatar";
import { ConfirmActionModal } from "../ui/ConfirmActionModal";
import { ActionButton } from "../ui/ActionButton";
import { CommitOptionsMenu } from "../../features/changes/CommitOptionsMenu";
import { ToastProvider, useToast } from "../Toast";

const mocks = vi.hoisted(() => ({ set: vi.fn(), discard: vi.fn(async () => ({ success: true })) }));
vi.mock("../../state/store", () => ({
  useApp: () => ({ view: "overview", discardPath: "notes.txt" }),
  useSet: () => mocks.set,
}));
vi.mock("../../lib/hooks", () => ({
  useCurrentRepo: () => ({ path: "C:/repo" }),
  useStatus: () => ({
    data: {
      files: [{ path: "notes.txt", st: "?", staged: false, conflicted: false, untracked: true }],
    },
  }),
  useDiff: () => ({ data: { add: 2, del: 0 } }),
  useDiscard: () => ({ mutateAsync: mocks.discard, isPending: false }),
}));

afterEach(cleanup);

describe("safety UI", () => {
  it("validates Git reference names while typing", async () => {
    const user = userEvent.setup();
    function TestField() {
      const [value, setValue] = useState("");
      return <ValidatedRefInput value={value} onChange={setValue} placeholder="Branch" />;
    }
    render(<TestField />);
    await user.type(screen.getByPlaceholderText("Branch"), "bad name");
    expect(screen.getByRole("alert").textContent).toContain("valid Git reference");
    expect(screen.getByPlaceholderText("Branch").getAttribute("aria-invalid")).toBe("true");
  });

  it("renders structured error suggestions", () => {
    render(
      <ErrorNotice
        error={{
          code: "git.non_fast_forward",
          category: "conflict",
          title: "Push was rejected",
          message: "The remote contains work you do not have.",
          technicalDetails: "rejected (non-fast-forward)",
          suggestedActions: [{ label: "Fetch and review incoming commits", action: "fetch" }],
          retryable: true,
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Push was rejected");
    expect(screen.getByRole("alert").textContent).toContain("Fetch and review incoming commits");
  });

  it("preserves structured errors in global feedback", async () => {
    function Trigger() {
      const toast = useToast();
      return (
        <button
          onClick={() =>
            toast(
              {
                code: "git.authentication_failed",
                category: "authentication",
                title: "Authentication failed",
                message: "Git could not authenticate.",
                technicalDetails: "Permission denied (publickey)",
                suggestedActions: [
                  { label: "Check the configured SSH key", action: "check_credentials" },
                ],
                retryable: true,
              },
              "error",
            )
          }
        >
          Show error
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Show error" }));
    expect(screen.getByText("Authentication failed")).toBeTruthy();
    expect(screen.getByText("Check the configured SSH key")).toBeTruthy();
  });

  it("shows streamed progress and invokes cancellation with the operation id", () => {
    const cancel = vi.fn();
    render(
      <StatusBar
        status={undefined}
        progress={{
          operationId: 42,
          repository: "C:/repo",
          phase: "output",
          stream: "stderr",
          message: "Receiving objects: 50%",
        }}
        onCancel={cancel}
      />,
    );
    expect(screen.getByText("Receiving objects: 50%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledWith(42);
  });

  it("requires an explicit destructive confirmation and previews recovery", async () => {
    const user = userEvent.setup();
    render(<DiscardModal />);
    expect(screen.getByRole("dialog", { name: "Discard changes" })).toBeTruthy();
    expect(screen.getByText(/copied to the app recovery store/i)).toBeTruthy();
    expect(mocks.discard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard 2 lines" }));
    expect(mocks.discard).toHaveBeenCalledWith(["notes.txt"]);
  });

  it("keeps destructive actions behind the shared confirmation modal", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    const cancel = vi.fn();
    render(
      <ConfirmActionModal
        open
        title="Drop stash?"
        description="This cannot be undone."
        confirmLabel="Drop stash"
        onCancel={cancel}
        onConfirm={confirm}
      />,
    );
    expect(confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("renders deterministic avatars from the author identity", () => {
    const { container, rerender } = render(<Avatar name="Ada Lovelace" />);
    const first = container.innerHTML;
    rerender(<Avatar name="Ada Lovelace" />);
    expect(container.innerHTML).toBe(first);
    rerender(<Avatar name="Grace Hopper" />);
    expect(container.innerHTML).not.toBe(first);
  });

  it("acknowledges copy actions in place", async () => {
    const user = userEvent.setup();
    render(<ActionButton icon="copy" iconOnly title="Copy SHA" aria-label="Copy SHA" />);
    await user.click(screen.getByRole("button", { name: "Copy SHA" }));
    expect(screen.getByRole("button", { name: "Copy SHA" }).getAttribute("title")).toBe("Copied");
  });

  it("uses one size contract for all action button variants", () => {
    render(
      <>
        <ActionButton size="sm">Default</ActionButton>
        <ActionButton size="sm" variant="primary">
          Primary
        </ActionButton>
        <ActionButton size="sm" variant="danger">
          Danger
        </ActionButton>
      </>,
    );
    for (const name of ["Default", "Primary", "Danger"])
      expect(screen.getByRole("button", { name }).className).toContain("action-sm");
  });

  it("keeps commit toggles behind the centered settings action", async () => {
    const user = userEvent.setup();
    const onAmendChange = vi.fn();
    render(
      <CommitOptionsMenu
        amend={false}
        sign={false}
        pushAfter={false}
        onAmendChange={onAmendChange}
        onSignChange={vi.fn()}
        onPushAfterChange={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Commit options" }));
    await user.click(screen.getByRole("button", { name: /Amend previous commit/ }));
    expect(onAmendChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: /Sign commit/ })).toBeTruthy();
  });

  it("disables push-after when the branch has no safe destination", async () => {
    const user = userEvent.setup();
    render(
      <CommitOptionsMenu
        amend={false}
        sign={false}
        pushAfter={false}
        pushAfterDisabled
        pushAfterDescription="Configure a remote first."
        onAmendChange={vi.fn()}
        onSignChange={vi.fn()}
        onPushAfterChange={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Commit options" }));
    const option = screen.getByRole("button", { name: /Push after commit/ });
    expect(option.hasAttribute("disabled")).toBe(true);
    expect(option.textContent).toContain("Configure a remote first");
  });
});
