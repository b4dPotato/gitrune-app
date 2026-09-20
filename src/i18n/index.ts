import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./resources/en";
import { pl } from "./resources/pl";
import { uk } from "./resources/uk";

export const supportedLanguages = ["en", "pl", "uk"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return supportedLanguages.includes(value as SupportedLanguage);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
    uk: { translation: uk },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: supportedLanguages,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
