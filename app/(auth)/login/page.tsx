import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Check } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { SignInButton } from "@/components/landing/sign-in-button";
import { Logo, LogoMark } from "@/components/ui/logo";
import { Contours } from "@/components/ui/contours";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  auth_failed: "Sign-in didn't complete. Please try again.",
  oauth_start: "We couldn't reach the sign-in service. Check your connection and try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/dashboard");
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? ERRORS.auth_failed : null;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Travera home"><Logo /></Link>
        <Link href="/" className="flex items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
          <ArrowLeft size={15} aria-hidden="true" /> Back to home
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <Contours className="absolute inset-0 h-full w-full text-line-strong/80 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />

        <div className="relative w-full max-w-[400px] animate-rise">
          <div className="rounded-[20px] border border-line bg-surface px-6 py-9 shadow-[0_30px_60px_-36px_rgb(22_24_29/0.35)] sm:px-9">
            <LogoMark size={44} />
            <h1 className="display mt-6 text-[38px] text-ink">Welcome back.</h1>
            <p className="mt-2 text-[14px] text-ink-2">Sign in to pick up where you left off — or start your first trip.</p>

            {message && (
              <p role="alert" className="mt-6 rounded-[var(--radius-control)] bg-negative-soft px-3 py-2.5 text-[13px] text-negative">
                {message}
              </p>
            )}

            <SignInButton google variant="secondary" size="lg" className="mt-7 w-full">
              Continue with Google
            </SignInButton>

            <ul className="mt-7 space-y-2.5 border-t border-line pt-6">
              {["Free to use — no card required", "Trips stay private until you share them", "Available in 10 languages"].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-[13px] text-ink-2">
                  <Check size={14} className="text-positive" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-center text-[12.5px] text-ink-3">
            New to Travera? Signing in creates your account automatically.
          </p>
        </div>
      </main>
    </div>
  );
}
