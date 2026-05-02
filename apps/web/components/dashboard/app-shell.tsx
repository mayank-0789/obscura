"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAgents } from "@/hooks/use-agents";
import type { CreateAgentResult } from "@/hooks/use-create-agent";
import { DashboardTopBar } from "./dashboard-top-bar";
import { AgentsSidebar } from "./agents-sidebar";
import { CreateAgentModal } from "./create-agent-modal";
import { RevealApiKeyCard } from "./reveal-api-key-card";
import { CommandPalette } from "./command-palette";

type AppShellContextValue = {
  openCreateModal: () => void;
  openPalette: () => void;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

const JUST_CREATED_KEY = "obscura:just-created-agent";

export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an <AppShell>");
  }
  return ctx;
}

type Props = {
  selectedAgentId: string | undefined;
  onSelectAgent: (id: string) => void;
  children: React.ReactNode;
};

/** Shared authed chrome: top bar, sidebar, create modal, palette, shortcuts. */
export function AppShell({ selectedAgentId, onSelectAgent, children }: Props) {
  const { data: agents } = useAgents();

  const [createOpen, setCreateOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<CreateAgentResult | null>(
    null,
  );

  // sessionStorage bridges JUST_CREATED across the AppShell unmount/remount
  // that onSelectAgent's router.push triggers, preserving the reveal card.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(JUST_CREATED_KEY);
      if (!raw) return;
      setJustCreated(JSON.parse(raw) as CreateAgentResult);
    } catch {
      sessionStorage.removeItem(JUST_CREATED_KEY);
    }
  }, []);

  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      if (!agents || agents.length === 0) return;
      const idx = selectedAgentId
        ? agents.findIndex((a) => a.id === selectedAgentId)
        : -1;
      const nextIdx =
        idx === -1
          ? delta > 0
            ? 0
            : agents.length - 1
          : (idx + delta + agents.length) % agents.length;
      const target = agents[nextIdx];
      if (target) onSelectAgent(target.id);
    },
    [agents, selectedAgentId, onSelectAgent],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (createOpen || paletteOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, paletteOpen, moveSelection]);

  const contextValue: AppShellContextValue = {
    openCreateModal: () => setCreateOpen(true),
    openPalette: () => setPaletteOpen(true),
  };

  return (
    <AppShellContext.Provider value={contextValue}>
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-zinc-100">
      <DashboardTopBar onOpenPalette={() => setPaletteOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <AgentsSidebar
          agents={agents}
          selectedId={selectedAgentId}
          onSelect={onSelectAgent}
          onNewAgent={() => setCreateOpen(true)}
          walletAddress={null}
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#0a0a0a]">
          {justCreated && (
            <div className="border-b border-zinc-800 bg-[#0a1410] px-8 py-5">
              <RevealApiKeyCard
                agentName={justCreated.agent.name}
                apiKey={justCreated.apiKey}
                onDismiss={() => {
                  setJustCreated(null);
                  sessionStorage.removeItem(JUST_CREATED_KEY);
                }}
              />
            </div>
          )}

          {children}
        </main>
      </div>

      <CreateAgentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          sessionStorage.setItem(JUST_CREATED_KEY, JSON.stringify(result));
          setJustCreated(result);
          onSelectAgent(result.agent.id);
        }}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        agents={agents}
        onNewAgent={() => {
          setPaletteOpen(false);
          setCreateOpen(true);
        }}
        onSelectAgent={(id) => {
          setPaletteOpen(false);
          onSelectAgent(id);
        }}
      />
    </div>
    </AppShellContext.Provider>
  );
}
