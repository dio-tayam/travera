"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { SignInButton } from "@/components/landing/sign-in-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo, LogoMark } from "@/components/ui/logo";

export function LoginHeader() {
  const { t } = useTranslation("common");
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <Link href="/" aria-label={t("sidebar.home")}><Logo /></Link>
      <div className="flex items-center gap-1">
        <LanguageSwitcher variant="compact" />
        <Link href="/" className="flex items-center gap-1.5 px-2 text-[14px] text-ink-2 hover:text-ink">
          <ArrowLeft size={15} aria-hidden="true" className="rtl:-scale-x-100" /> {t("login.back")}
        </Link>
      </div>
    </header>
  );
}

export function LoginCard({ error }: { error: string | null }) {
  const { t } = useTranslation("common");
  return (
    <div className="relative w-full max-w-[400px] animate-rise">
      <div className="rounded-[20px] border border-line bg-surface px-6 py-9 shadow-[0_30px_60px_-36px_rgb(22_24_29/0.35)] sm:px-9">
        <LogoMark size={44} />
        <h1 className="display mt-6 text-[38px] text-ink">{t("login.title")}</h1>
        <p className="mt-2 text-[14px] text-ink-2">{t("login.subtitle")}</p>

        {error && (
          <p role="alert" className="mt-6 rounded-[var(--radius-control)] bg-negative-soft px-3 py-2.5 text-[13px] text-negative">
            {t(`login.errors.${error}`, { defaultValue: t("login.errors.auth_failed") })}
          </p>
        )}

        <SignInButton google variant="secondary" size="lg" className="mt-7 w-full">
          {t("login.google")}
        </SignInButton>

        <ul className="mt-7 space-y-2.5 border-t border-line pt-6">
          {(["free", "private", "languages"] as const).map(key => (
            <li key={key} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <Check size={14} className="text-positive" aria-hidden="true" /> {t(`login.perks.${key}`)}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-center text-[12.5px] text-ink-3">{t("login.newHere")}</p>
    </div>
  );
}
