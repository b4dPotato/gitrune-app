import type { CiState, FileStatus, ReviewState } from "./types";

/** file status letter → color var (design: status system) */
export function stColor(st: FileStatus): string {
  switch (st) {
    case "M":
      return "var(--wn)";
    case "A":
      return "var(--ok)";
    case "D":
      return "var(--er)";
    case "R":
      return "var(--inf)";
    default:
      return "var(--tx2)";
  }
}

export interface ChipSpec {
  txt: string;
  c: string;
  bg: string;
}

export function ciChip(s: CiState): ChipSpec {
  const m: Record<CiState, ChipSpec> = {
    pass: { txt: "✓ CI passed", c: "var(--ok)", bg: "var(--okbg)" },
    fail: { txt: "✕ CI failed", c: "var(--er)", bg: "var(--erbg)" },
    run: { txt: "◐ CI running", c: "var(--inf)", bg: "var(--infbg)" },
    queue: { txt: "○ queued", c: "var(--tx3)", bg: "var(--panel2)" },
  };
  return m[s] ?? { txt: "—", c: "var(--tx3)", bg: "transparent" };
}

export function revChip(s: ReviewState): ChipSpec {
  const m: Record<ReviewState, ChipSpec> = {
    approved: { txt: "✓ Approved", c: "var(--ok)", bg: "var(--okbg)" },
    changes: { txt: "● Changes requested", c: "var(--wn)", bg: "var(--wnbg)" },
    requested: { txt: "◔ Review requested", c: "var(--inf)", bg: "var(--infbg)" },
    none: { txt: "— No review", c: "var(--tx3)", bg: "var(--panel2)" },
  };
  return m[s] ?? { txt: "", c: "var(--tx3)", bg: "transparent" };
}

export function ciGlyph(s: CiState): [string, string] {
  const m: Record<CiState, [string, string]> = {
    pass: ["✓", "var(--ok)"],
    fail: ["✕", "var(--er)"],
    run: ["◐", "var(--inf)"],
    queue: ["○", "var(--tx3)"],
  };
  return m[s];
}

export const LANE_COLORS = ["var(--inf)", "var(--ac)", "var(--pur)"];
