import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper px-6 py-6 sm:px-10">
      <Link href="/" aria-label="Travera home"><Logo /></Link>
      <main className="m-auto max-w-md py-16 text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="display mt-4 text-[56px] text-ink sm:text-[72px]">Off the map.</h1>
        <p className="mt-3 text-[14px] text-ink-2">
          This page doesn&apos;t exist, or it belongs to a trip you haven&apos;t been invited to.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild>
            <Link href="/"><ArrowLeft size={16} /> Back to my trips</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
