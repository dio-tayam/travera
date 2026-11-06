import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en/common.json";
import ja from "@/locales/ja/common.json";
import ko from "@/locales/ko/common.json";
import de from "@/locales/de/common.json";
import nl from "@/locales/nl/common.json";
import fr from "@/locales/fr/common.json";
import es from "@/locales/es/common.json";
import zh from "@/locales/zh/common.json";
import pt from "@/locales/pt/common.json";
import ar from "@/locales/ar/common.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English",    locale: "en-PH", dir: "ltr" },
  { code: "ja", label: "日本語",      locale: "ja-JP", dir: "ltr" },
  { code: "ko", label: "한국어",      locale: "ko-KR", dir: "ltr" },
  { code: "de", label: "Deutsch",    locale: "de-DE", dir: "ltr" },
  { code: "nl", label: "Nederlands", locale: "nl-NL", dir: "ltr" },
  { code: "fr", label: "Français",   locale: "fr-FR", dir: "ltr" },
  { code: "es", label: "Español",    locale: "es-ES", dir: "ltr" },
  { code: "zh", label: "中文",        locale: "zh-CN", dir: "ltr" },
  { code: "pt", label: "Português",  locale: "pt-BR", dir: "ltr" },
  { code: "ar", label: "العربية",     locale: "ar-u-nu-latn", dir: "rtl" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "i18nextLng";
const CODES = SUPPORTED_LANGUAGES.map(l => l.code) as readonly string[];

/** Normalises "ja-JP" / "pt_BR" / "zh-Hant" to a supported code, or null. */
export function matchLanguage(input?: string | null): LanguageCode | null {
  if (!input) return null;
  const base = input.toLowerCase().replace("_", "-").split("-")[0];
  return CODES.includes(base) ? (base as LanguageCode) : null;
}

export function languageMeta(code?: string | null) {
  return SUPPORTED_LANGUAGES.find(l => l.code === matchLanguage(code)) ?? SUPPORTED_LANGUAGES[0];
}

/** Saved choice → browser languages → English. Client only. */
export function detectLanguage(): LanguageCode {
  try {
    const saved = matchLanguage(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch { /* storage unavailable */ }
  for (const l of navigator.languages ?? [navigator.language]) {
    const m = matchLanguage(l);
    if (m) return m;
  }
  return "en";
}

/** Changes the UI language and remembers it (localStorage + cookie for future server use). */
export function setLanguage(code: LanguageCode) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  document.cookie = `lang=${code}; path=/; max-age=31536000; samesite=lax`;
  return i18n.changeLanguage(code);
}

// Always start in English so the server render and the first client render match
// (no hydration mismatch). I18nProvider switches to the detected language after mount.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { common: en }, ja: { common: ja }, ko: { common: ko }, de: { common: de }, nl: { common: nl },
      fr: { common: fr }, es: { common: es }, zh: { common: zh }, pt: { common: pt }, ar: { common: ar },
    },
    lng: "en",
    supportedLngs: CODES as string[],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    defaultNS: "common",
    fallbackLng: "en",
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { bindI18n: "languageChanged loaded" },
  });
}

export default i18n;
