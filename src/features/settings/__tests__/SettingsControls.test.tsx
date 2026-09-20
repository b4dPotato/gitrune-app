// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_CUSTOM_THEME } from "../../../lib/types";
import { ThemeSelector } from "../ThemeSelector";
import { ZoomControl } from "../ZoomControl";
import { LanguageSelector } from "../LanguageSelector";
import i18n from "../../../i18n";

afterEach(cleanup);

describe("settings controls", () => {
  it("offers the curated themes and a custom theme", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    render(
      <ThemeSelector
        theme="dark"
        customTheme={DEFAULT_CUSTOM_THEME}
        onThemeChange={onThemeChange}
        onCustomThemeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Dracula" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Solarized" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Custom" }));
    expect(onThemeChange).toHaveBeenCalledWith("custom");
  });

  it("changes and resets interface zoom", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ZoomControl value={100} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onChange).toHaveBeenCalledWith(110);
    await user.click(screen.getByRole("button", { name: "100%" }));
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("offers every supported language and reports the selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguageSelector value="en" onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Language"), "pl");
    expect(onChange).toHaveBeenCalledWith("pl");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await i18n.changeLanguage("en");
  });
});
