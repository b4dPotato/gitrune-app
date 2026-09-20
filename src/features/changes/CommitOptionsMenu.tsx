import { Dropdown } from "../../components/Dropdown";
import { ActionButton } from "../../components/ui/ActionButton";
import { useTranslation } from "react-i18next";

export function CommitOptionsMenu({
  amend,
  sign,
  pushAfter,
  pushAfterDisabled,
  pushAfterDescription,
  onAmendChange,
  onSignChange,
  onPushAfterChange,
  onUndo,
  undoDisabled,
}: {
  amend: boolean;
  sign: boolean;
  pushAfter: boolean;
  pushAfterDisabled?: boolean;
  pushAfterDescription?: string;
  onAmendChange: (value: boolean) => void;
  onSignChange: (value: boolean) => void;
  onPushAfterChange: (value: boolean) => void;
  onUndo: () => void;
  undoDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dropdown
      header={t("commitOptions.title").toUpperCase()}
      width={310}
      items={[
        {
          label: t("commitOptions.amend"),
          description: t("commitOptions.amendDescription"),
          checked: amend,
          keepOpen: true,
          onClick: () => onAmendChange(!amend),
        },
        {
          label: t("commitOptions.sign"),
          description: t("commitOptions.signDescription"),
          checked: sign,
          keepOpen: true,
          onClick: () => onSignChange(!sign),
        },
        {
          label: t("commitOptions.pushAfter"),
          description: pushAfterDescription ?? t("commitOptions.pushAfterDescription"),
          checked: pushAfter,
          disabled: pushAfterDisabled,
          keepOpen: true,
          onClick: () => onPushAfterChange(!pushAfter),
        },
        {
          label: t("commitOptions.undo"),
          description: t("commitOptions.undoDescription"),
          glyph: "↩",
          disabled: undoDisabled,
          onClick: onUndo,
        },
      ]}
      trigger={(open, toggle) => (
        <ActionButton
          icon="settings"
          iconOnly
          aria-label={t("commitOptions.title")}
          title={t("commitOptions.title")}
          onClick={toggle}
          className={open ? "border-acbd bg-acbg text-actx" : ""}
        />
      )}
    />
  );
}
