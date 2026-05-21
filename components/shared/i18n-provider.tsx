"use client";

import { useEffect, type ReactNode } from "react";
import "@/lib/i18n";

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // i18n is initialized via import of @/lib/i18n
  }, []);

  return <>{children}</>;
}
