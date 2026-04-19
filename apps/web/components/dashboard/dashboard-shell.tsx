"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAgents } from "@/hooks/use-agents";
import { AppShell } from "./app-shell";
import { AgentDetailPanel } from "./agent-detail-panel";
import { EmptyDetailPanel } from "./empty-detail-panel";

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: agents } = useAgents();

  const selectedId = searchParams.get("agent") ?? undefined;
  const selectedAgent = useMemo(
    () => agents?.find((a) => a.id === selectedId),
    [agents, selectedId],
  );

  // Auto-select the first agent when none is chosen so the detail pane isn't
  // dead on first paint.
  useEffect(() => {
    if (!agents || agents.length === 0) return;
    if (selectedId) return;
    const first = agents[0];
    if (!first) return;
    router.replace(`/dashboard?agent=${first.id}`, { scroll: false });
  }, [agents, selectedId, router]);

  const onSelect = useCallback(
    (id: string) => {
      router.replace(`/dashboard?agent=${id}`, { scroll: false });
    },
    [router],
  );

  return (
    <AppShell selectedAgentId={selectedId} onSelectAgent={onSelect}>
      {selectedAgent ? (
        <AgentDetailPanel agent={selectedAgent} />
      ) : (
        <EmptyDetailPanel hasAgents={!!agents && agents.length > 0} />
      )}
    </AppShell>
  );
}
