"use client";

import { useTranslation } from "react-i18next";

export function MapPlaceholder() {
  const { t } = useTranslation("common");
  return (
    <div className="grid h-full w-full place-items-center bg-sunken grid-texture">
      <p className="eyebrow">{t("map.loading")}</p>
    </div>
  );
}
