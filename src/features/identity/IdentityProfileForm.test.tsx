// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentityProfileForm } from "./IdentityProfileForm";

afterEach(cleanup);

describe("IdentityProfileForm", () => {
  it("requires a valid local Git author profile before saving", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <IdentityProfileForm
        open
        profile={null}
        sshHosts={["github-personal"]}
        busy={false}
        error={null}
        onCancel={() => undefined}
        onSave={save}
      />,
    );
    const submit = screen.getByRole("button", { name: "Save profile" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Profile label"), "Personal");
    await user.type(screen.getByLabelText("Commit author"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Commit email"), "ada@example.com");
    await user.type(screen.getByLabelText("SSH host alias"), "github-personal");
    await user.click(submit);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Personal",
        email: "ada@example.com",
        sshHost: "github-personal",
      }),
    );
  });
});
