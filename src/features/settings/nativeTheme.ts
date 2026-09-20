import type { Theme } from "../../lib/types";

function relativeLuminance(hex: string) {
  const channels = /^#([0-9a-f]{6})$/i.exec(hex)?.[1].match(/.{2}/g);
  if (!channels) return 0;
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

/** Map custom and curated app themes to the native title-bar theme. */
export function nativeWindowTheme(theme: Theme, customBackground: string): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "custom") return relativeLuminance(customBackground) > 0.4 ? "light" : "dark";
  return "dark";
}
