"use client";

import { useEffect, type ReactNode } from "react";
import i18n, { detectLanguage, languageMeta } from "@/lib/i18n";
import { setActiveLocale } from "@/lib/utils";

function apply(lng: string) {
  const meta = languageMeta(lng);
  setActiveLocale(meta.locale);
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
}

/** Applies the visitor's language after hydration and keeps <html lang/dir> and number/date formats in sync. */
export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    i18n.on("languageChanged", apply);
    const lng = detectLanguage();
    if (lng !== i18n.language) i18n.changeLanguage(lng);
    else apply(lng);
    return () => { i18n.off("languageChanged", apply); };
  }, []);

  return <>{children}</>;
}
