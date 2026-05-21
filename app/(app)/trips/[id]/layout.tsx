import { Sidebar } from "@/components/shared/sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar tripId={id} />
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
      <MobileNav tripId={id} />
    </div>
  );
}
