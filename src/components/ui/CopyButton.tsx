import { useEffect, useState } from "react";
import { ActionButton } from "./ActionButton";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  iconOnly = false,
  size = "sm",
  className = "",
  onCopied,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    onCopied?.();
  };

  const accessibleLabel = copied ? copiedLabel : label;
  return (
    <ActionButton
      icon={copied ? "check" : "copy"}
      iconOnly={iconOnly}
      size={size}
      className={className}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      onClick={() => void copy()}
    >
      {copied ? copiedLabel : label}
    </ActionButton>
  );
}
