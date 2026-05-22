import { Sidebar } from "@/components/shared/sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";
import { MobileTripHeader } from "@/components/shared/mobile-trip-header";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar tripId={id} />

      {/* Right side: header bar (mobile only) + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileTripHeader tripId={id} />
        {/* pb-20 reserves space above the fixed mobile nav (min-h-14 nav + safe area) */}
        <div className="flex-1 overflow-hidden relative pb-20 lg:pb-0">
          {children}
        </div>
      </div>

      <MobileNav tripId={id} />
    </div>
  );
}
