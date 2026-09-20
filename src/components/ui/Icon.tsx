import type { ReactNode } from "react";

export type IconName =
  | "apply"
  | "branch"
  | "check"
  | "chevron"
  | "close"
  | "copy"
  | "editor"
  | "help"
  | "palette"
  | "plus"
  | "pop"
  | "search"
  | "stash"
  | "terminal"
  | "trash"
  | "warning"
  | "publish"
  | "pull"
  | "push"
  | "sync"
  | "filter"
  | "compare"
  | "settings";

const paths: Record<IconName, ReactNode> = {
  apply: (
    <>
      <path d="M4 12h12" />
      <path d="m12 7 5 5-5 5" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="7" r="2" />
      <path d="M6 7v10M8 14c5 0 8-2 8-5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  copy: (
    <>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </>
  ),
  editor: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.8 2c-1 .7-1.6 1.2-1.6 2.5" />
      <path d="M12 17h.01" />
    </>
  ),
  palette: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="10" r="1" />
      <circle cx="12" cy="7" r="1" />
      <circle cx="16" cy="10" r="1" />
      <path d="M12 21c-1.5-1.5-.2-4 2-4h1a3 3 0 0 0 3-3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  pop: (
    <>
      <path d="M5 15h14" />
      <path d="m9 11-4 4 4 4M12 5v7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  stash: (
    <>
      <path d="M5 8h14M6 8l1 11h10l1-11M9 5h6l1 3H8l1-3Z" />
      <path d="M10 12h4" />
    </>
  ),
  terminal: (
    <>
      <path d="m5 7 4 5-4 5M11 17h8" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  publish: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 14v6h14v-6" />
    </>
  ),
  pull: (
    <>
      <path d="M12 4v13" />
      <path d="m7 12 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  push: (
    <>
      <path d="M12 20V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </>
  ),
  sync: (
    <>
      <path d="M20 7h-5V2" />
      <path d="M20 7a8 8 0 0 0-14-2" />
      <path d="M4 17h5v5" />
      <path d="M4 17a8 8 0 0 0 14 2" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  compare: (
    <>
      <path d="M8 5h11M15 2l4 3-4 3" />
      <path d="M16 19H5M9 16l-4 3 4 3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block flex-none ${className}`}
    >
      {paths[name]}
    </svg>
  );
}
