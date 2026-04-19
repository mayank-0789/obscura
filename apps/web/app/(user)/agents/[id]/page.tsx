import { AgentDetail } from "@/components/agents/agent-detail";
import { Nav } from "@/components/marketing/nav";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="user" />
      <AgentDetail id={id} />
    </div>
  );
}
