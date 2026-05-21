"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ??
    SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe size={16} style={{ color: "var(--color-primary)" }} />
        <span style={{ color: "var(--color-primary)" }}>{current.flag} {current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border border-gray-100 bg-white z-50 py-1 animate-fade-in">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left",
                i18n.language === lang.code
                  ? "bg-blue-50 font-semibold"
                  : "hover:bg-gray-50"
              )}
              style={
                i18n.language === lang.code
                  ? { color: "var(--color-primary)" }
                  : { color: "var(--color-foreground)" }
              }
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
