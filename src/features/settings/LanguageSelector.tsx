import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLanguage } from "../../i18n";

export function LanguageSelector({
  value,
  onChange,
}: {
  value: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <label className="w-28 flex-none text-[12px] text-tx2" htmlFor="language-setting">
        {t("settings.language")}
      </label>
      <select
        id="language-setting"
        value={value}
        onChange={(event) => onChange(event.target.value as SupportedLanguage)}
        className="input flex-1"
      >
        {supportedLanguages.map((language) => (
          <option key={language} value={language}>
            {t(`settings.languages.${language}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
