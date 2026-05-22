"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Open dropdown upward (true) or downward (false, default) */
  dropUp?: boolean;
}

export function LanguageSwitcher({ className, dropUp = false }: Props) {
  const { i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-[13px] font-medium
                   text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        aria-label="Change language" aria-expanded={open}
        style={{ fontFamily: "var(--font-body)" }}
      >
        <Globe size={15} className="text-blue-500 shrink-0" aria-hidden="true"/>
        <span className="flex-1 text-left truncate">{current.label}</span>
        <ChevronDown size={13} className={cn("text-slate-400 transition-transform shrink-0",
          open && "rotate-180")} aria-hidden="true"/>
      </button>

      {open && (
        <div className={cn(
          "absolute bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50",
          "animate-fade-in max-h-64 overflow-y-auto min-w-[180px]",
          dropUp
            ? "bottom-full left-0 right-0 mb-1"
            : "top-full right-0 mt-1"
        )}>
          {SUPPORTED_LANGUAGES.map(lang => {
            const active = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                  active ? "bg-blue-50 text-blue-700 font-semibold"
                         : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                )}
                style={{ fontFamily: "var(--font-body)" }}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="flex-1">{lang.label}</span>
                {active && <Check size={13} className="text-blue-600" aria-hidden="true"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
