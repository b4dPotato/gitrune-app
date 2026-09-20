import type { EditorOption } from "../../lib/ipc";

export function EditorLogo({ icon }: { icon: EditorOption["icon"] }) {
  if (icon === "code")
    return (
      <span
        data-editor-icon="code"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#1689ca]/15"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
          <path
            fill="#23a8f2"
            d="m17.4 2.5-8.1 7.4-4.2-3.2-2.6 1.8L7.2 12l-4.7 3.5 2.6 1.8 4.2-3.2 8.1 7.4 4.1-1.7V4.2l-4.1-1.7Zm0 5.2v8.6L12 12l5.4-4.3Z"
          />
        </svg>
      </span>
    );
  if (icon === "codium")
    return (
      <span
        data-editor-icon="codium"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#2f9f78]/15"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
          <path
            fill="#2f9f78"
            d="M18.7 3.1 9.5 10l-4-3L2.8 9l4 3-4 3 2.7 2 4-3 9.2 6.9 2.5-1.2V4.3l-2.5-1.2Zm-.8 5.1v7.6L12.8 12l5.1-3.8Z"
          />
          <circle cx="18.4" cy="4.6" r="2.1" fill="#65c89a" />
        </svg>
      </span>
    );
  if (icon === "notepad")
    return (
      <span
        data-editor-icon="notepad"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#4b9fdb]/15"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
          <rect
            x="5"
            y="4"
            width="14"
            height="17"
            rx="2"
            fill="#f7fbff"
            stroke="#4b9fdb"
            strokeWidth="1.4"
          />
          <path d="M8 9h8M8 12h8M8 15h6" stroke="#4b9fdb" strokeWidth="1.3" strokeLinecap="round" />
          <path
            d="M8 2.8v3M12 2.8v3M16 2.8v3"
            stroke="#667783"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  if (icon === "folder")
    return (
      <span
        data-editor-icon="folder"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#e7aa38]/15"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
          <path
            fill="#e7aa38"
            d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z"
          />
          <path fill="#f1c45f" d="M3 9h18v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5V9Z" />
        </svg>
      </span>
    );
  return (
    <span
      data-editor-icon="system"
      className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#00a4ef]/15"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path
          fill="#00a4ef"
          d="M3 4.5 10.5 3v8H3V4.5Zm8.5-1.7L21 1v10h-9.5V2.8ZM3 12h7.5v8L3 18.5V12Zm8.5 0H21v10l-9.5-1.8V12Z"
        />
      </svg>
    </span>
  );
}
