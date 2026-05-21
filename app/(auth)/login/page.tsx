"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TraveraSpinner } from "@/components/shared/travera-spinner";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const { t } = useTranslation("common");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — Philippine hero */}
      <div
        className="ph-sun-bg relative flex-1 flex flex-col items-center justify-center p-8 min-h-[40vh] lg:min-h-screen overflow-hidden"
      >
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center bottom, rgba(252,209,22,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 text-center">
          <h1
            className="text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-3 select-none"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Travera
          </h1>
          <div className="flex justify-center my-6">
            <svg width="72" height="72" viewBox="0 0 100 100" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={i}
                  x1="50" y1="50"
                  x2={50 + 42 * Math.cos(((i * 45 - 90) * Math.PI) / 180)}
                  y2={50 + 42 * Math.sin(((i * 45 - 90) * Math.PI) / 180)}
                  stroke="#FCD116" strokeWidth="5" strokeLinecap="round"
                />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={`s${i}`}
                  x1={50 + 22 * Math.cos(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
                  y1={50 + 22 * Math.sin(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
                  x2={50 + 34 * Math.cos(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
                  y2={50 + 34 * Math.sin(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
                  stroke="#FCD116" strokeWidth="3.5" strokeLinecap="round"
                />
              ))}
              <circle cx="50" cy="50" r="16" fill="#FCD116" />
            </svg>
          </div>
          <p
            className="text-white/80 text-lg lg:text-xl max-w-xs mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {t("auth.welcome")}
          </p>
        </div>
      </div>

      {/* Right — sign-in card */}
      <div className="flex flex-1 items-center justify-center p-6 bg-white lg:max-w-md xl:max-w-lg">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden text-center">
            <h2
              className="text-3xl font-extrabold"
              style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}
            >
              Travera
            </h2>
          </div>

          <div className="space-y-2">
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--color-foreground)", fontFamily: "var(--font-heading)" }}
            >
              {t("auth.tagline")}
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
            >
              Sign in to start collaborating on your next trip.
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl text-white font-semibold text-base transition-opacity disabled:opacity-60 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: "var(--color-primary)",
              fontFamily: "var(--font-body)",
              outlineColor: "var(--color-primary)",
            }}
            aria-label={t("auth.signIn")}
          >
            {loading ? (
              <TraveraSpinner size={22} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#fff" d="M44.5 20H24v8.5h11.7C34.3 33.6 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3L38.7 8C34.7 4.3 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11.7 0 21.3-8.3 22.7-19.5.1-.8.3-1.6.3-2.5 0-1.5-.1-2.7-.5-4z"/>
              </svg>
            )}
            <span>{loading ? t("auth.signingIn") : t("auth.signIn")}</span>
          </button>

          <p
            className="text-xs text-center"
            style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
          >
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
