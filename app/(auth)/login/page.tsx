import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { LoginCard, LoginHeader } from "@/components/landing/login-card";
import { Contours } from "@/components/ui/contours";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

const KNOWN_ERRORS = new Set(["auth_failed", "auth_denied", "oauth_start"]);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <LoginHeader />
      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <Contours className="absolute inset-0 h-full w-full text-line-strong/80 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />
        <LoginCard error={error ? (KNOWN_ERRORS.has(error) ? error : "auth_failed") : null} />
      </main>
    </div>
  );
}
