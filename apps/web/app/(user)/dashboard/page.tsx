import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { Nav } from "@/components/marketing/nav";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="user" />
      <DashboardContent />
    </div>
  );
}
