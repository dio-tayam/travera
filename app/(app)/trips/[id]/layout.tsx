import { Sidebar } from "@/components/shared/sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";
import { MobileTopBar } from "@/components/shared/mobile-top-bar";
import { createClient } from "@/lib/supabase/server";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id,title,destination,start_date,end_date")
    .eq("id", id)
    .maybeSingle();

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <Sidebar trip={trip} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileTopBar trip={trip} />
        {/* pb-16 reserves room for the fixed mobile tab bar */}
        <main className="relative min-h-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav tripId={id} />
    </div>
  );
}
