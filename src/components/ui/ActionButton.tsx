import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "./Icon";

export function ActionButton({
  icon,
  iconOnly,
  variant = "default",
  size = "md",
  children,
  className = "",
  onClick,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  iconOnly?: boolean;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  const [copyAcknowledged, setCopyAcknowledged] = useState(false);
  useEffect(() => {
    if (!copyAcknowledged) return;
    const timer = window.setTimeout(() => setCopyAcknowledged(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copyAcknowledged]);
  const base =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : variant === "ghost"
          ? "icon-btn"
          : size === "sm"
            ? "btn-sm"
            : "btn";
  const displayedIcon = icon === "copy" && copyAcknowledged ? "check" : icon;
  return (
    <button
      {...props}
      title={copyAcknowledged ? t("common.copied") : title}
      onClick={(event) => {
        if (icon === "copy") setCopyAcknowledged(true);
        onClick?.(event);
      }}
      className={`${base} action-${size} inline-flex items-center justify-center gap-1.5 ${iconOnly ? "aspect-square p-1" : ""} ${className}`}
    >
      {displayedIcon && <Icon name={displayedIcon} size={size === "sm" ? 14 : 16} />}
      {!iconOnly && children}
    </button>
  );
}
