import { Dropdown, type MenuItem } from "../../components/Dropdown";
import { Avatar } from "../../components/ui/Avatar";
import { useApplyIdentityProfile, useIdentityProfiles } from "../../lib/hooks";
import type { RepoRecord } from "../../lib/ipc";
import { useOperationRunner } from "../../lib/useOperationRunner";
import { useDispatch, useSet } from "../../state/store";
import { useTranslation } from "react-i18next";

export function ProfileSwitcher({
  repo,
  identity,
  warning,
  showLabel,
}: {
  repo: RepoRecord;
  identity?: string;
  warning: boolean;
  showLabel: boolean;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const set = useSet();
  const run = useOperationRunner();
  const profiles = useIdentityProfiles();
  const apply = useApplyIdentityProfile(repo.path);
  const normalizedIdentity = identity?.toLowerCase() ?? "";
  const identityEmail = identity?.match(/<(.+)>/)?.[1] ?? "";
  const savedProfiles = profiles.data ?? [];

  const items: MenuItem[] = [
    ...savedProfiles.map((profile): MenuItem => {
      const active =
        normalizedIdentity.includes(profile.email.toLowerCase()) &&
        normalizedIdentity.includes(profile.name.toLowerCase());
      return {
        label: profile.label,
        description: `${profile.name} <${profile.email}>`,
        glyph: "@",
        active,
        disabled: apply.isPending,
        onClick: async () => {
          if (active) return;
          if (
            await run(
              apply.mutateAsync(profile.id),
              t("topbar.profileApplied", { profile: profile.label, repository: repo.name }),
            )
          ) {
            set({ bannerDismissed: false });
          }
        },
      };
    }),
    ...(savedProfiles.length === 0 && !profiles.isLoading
      ? [
          {
            label: t("topbar.noProfiles"),
            description: t("topbar.noProfilesHint"),
            disabled: true,
            onClick: () => undefined,
          } satisfies MenuItem,
        ]
      : []),
    {
      label: t("topbar.manageProfiles"),
      glyph: "⚙",
      onClick: () => dispatch({ type: "nav", view: "accounts" }),
    },
  ];

  return (
    <Dropdown
      header={t("topbar.gitProfiles").toUpperCase()}
      width={310}
      items={items}
      searchPlaceholder={savedProfiles.length > 5 ? t("topbar.searchProfiles") : undefined}
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={toggle}
          title={t("topbar.switchProfileTitle")}
          aria-label={t("topbar.switchProfile")}
          className="flex h-7 max-w-[270px] cursor-pointer items-center gap-[6px] overflow-hidden rounded border px-[7px] font-mono text-[11px] text-tx2 hover:brightness-110"
          style={{
            borderColor: warning ? "var(--wn)" : "var(--bd2)",
            background: open ? "var(--active)" : warning ? "var(--wnbg)" : "var(--panel2)",
          }}
        >
          <Avatar name={identity ?? repo.name} size={18} />
          {showLabel && (
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {identityEmail || t("topbar.chooseProfile")}
            </span>
          )}
          <span className="flex-none text-[10px] text-tx3">⌄</span>
        </button>
      )}
    />
  );
}
