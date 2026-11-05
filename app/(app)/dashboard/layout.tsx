import { Sidebar } from "@/components/shared/sidebar";
import { MobileTopBar } from "@/components/shared/mobile-top-bar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileTopBar />
        <main className="relative min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
