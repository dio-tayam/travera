"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plane, Map, Users, Wallet, Package, FileText, Globe, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Map,      title: "Interactive Itinerary",    desc: "Plan every day with Google Maps, drag-and-drop stops and route lines.", color: "#6366f1", bg: "#eef2ff" },
  { icon: Users,    title: "Real-time Collaboration",  desc: "Invite friends and edit together live — no refresh needed.",            color: "#2563eb", bg: "#eff6ff" },
  { icon: Wallet,   title: "Expense Splitting",        desc: "Track shared costs and auto-calculate who owes who.",                   color: "#f59e0b", bg: "#fffbeb" },
  { icon: Package,  title: "Smart Packing Lists",      desc: "AI-generated suggestions based on your destination and trip length.",   color: "#10b981", bg: "#ecfdf5" },
  { icon: FileText, title: "Document Storage",         desc: "Upload passports, visas and flight tickets — access anywhere.",        color: "#8b5cf6", bg: "#f5f3ff" },
  { icon: Globe,    title: "10 Languages",             desc: "Fully translated in English, Japanese, Korean, German and more.",      color: "#0ea5e9", bg: "#f0f9ff" },
];

export default function LoginPage() {
  const { t } = useTranslation("common");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center
                       px-5 py-8 lg:px-16 lg:py-0 gap-8 lg:gap-14 max-w-6xl mx-auto w-full">

        {/* ── Left: Branding + features ──────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-5 lg:gap-8 lg:py-16 w-full">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl sky-gradient flex items-center
                            justify-center shadow-md shadow-blue-200 shrink-0">
              <Plane size={16} className="text-white -rotate-45"/>
            </div>
            <span className="text-xl lg:text-2xl font-extrabold text-blue-600"
                  style={{ fontFamily: "var(--font-heading)" }}>
              Travera
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-2 lg:space-y-3">
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-slate-900 leading-tight"
                style={{ fontFamily: "var(--font-heading)" }}>
              The smarter way to<br/>
              <span className="text-blue-600">plan your travels</span>
            </h1>
            <p className="text-slate-500 text-sm lg:text-lg leading-relaxed">
              From idea to adventure — plan it, share it, live it.
            </p>
          </div>

          {/* Feature grid — hidden on mobile, visible on desktop */}
          <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="flex items-start gap-3 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                                transition-transform duration-200 group-hover:scale-110"
                     style={{ backgroundColor: bg }}>
                  <Icon size={16} style={{ color }} aria-hidden="true"/>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm"
                     style={{ fontFamily: "var(--font-heading)" }}>{title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Sign-in card ─────────────────────────────────────── */}
        <div className="w-full sm:max-w-sm lg:w-96 shrink-0">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80
                          border border-slate-100 p-6 sm:p-8 space-y-5 sm:space-y-6 animate-scale-in">

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}>
                Welcome back
              </h2>
              <p className="text-slate-500 text-sm">
                Sign in to continue to your dashboard
              </p>
            </div>

            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5
                         rounded-2xl border-2 border-slate-200 bg-white text-slate-700
                         font-semibold text-sm transition-all hover:border-blue-300
                         hover:shadow-md hover:shadow-blue-100 disabled:opacity-60
                         focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                         active:scale-95"
              aria-label={t("auth.signIn")}
            >
              {loading ? (
                <Plane size={18} className="animate-plane-fly text-blue-600 -rotate-45"/>
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              )}
              <span>{loading ? "Signing in…" : "Continue with Google"}</span>
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"/>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white text-xs text-slate-400 font-medium">Free forever</span>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { icon: Shield,   label: "Secure data",    color: "#2563eb", bg: "#eff6ff" },
                { icon: FileText, label: "Private",        color: "#8b5cf6", bg: "#f5f3ff" },
                { icon: Wallet,   label: "No card needed", color: "#f59e0b", bg: "#fffbeb" },
              ].map(({ icon: Icon, label, color, bg }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center"
                       style={{ backgroundColor: bg }}>
                    <Icon size={14} style={{ color }} aria-hidden="true"/>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-400">
        © {new Date().getFullYear()} Travera. All rights reserved.
      </footer>
    </div>
  );
}
