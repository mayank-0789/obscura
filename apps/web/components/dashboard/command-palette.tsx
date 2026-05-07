"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentDTO } from "@/types/agent";
import { Kbd } from "./kbd";

type CommandItem =
  | {
      kind: "action";
      id: string;
      label: string;
      hint?: string;
      shortcut?: string[];
      onRun: () => void;
    }
  | {
      kind: "agent";
      id: string;
      label: string;
      hint?: string;
      onRun: () => void;
    };

type Props = {
  open: boolean;
  onClose: () => void;
  agents: AgentDTO[] | undefined;
  onNewAgent: () => void;
  onSelectAgent: (id: string) => void;
};

export function CommandPalette({
  open,
  onClose,
  agents,
  onNewAgent,
  onSelectAgent,
}: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        kind: "action",
        id: "new-agent",
        label: "Create a new agent",
        hint: "Open the new-agent sheet",
        shortcut: ["⌘", "N"],
        onRun: onNewAgent,
      },
    ];
    const agentItems: CommandItem[] = (agents ?? []).map((a) => ({
      kind: "agent",
      id: `agent-${a.id}`,
      label: a.name,
      hint: shortPk(a.etaAddress),
      onRun: () => onSelectAgent(a.id),
    }));
    const all = [...base, ...agentItems];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.hint && it.hint.toLowerCase().includes(q)),
    );
  }, [agents, query, onNewAgent, onSelectAgent]);

  // Index of the first item in each group (for inserting hairline group headers)
  const firstActionIdx = items.findIndex((it) => it.kind === "action");
  const firstAgentIdx = items.findIndex((it) => it.kind === "agent");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => (items.length === 0 ? 0 : (c + 1) % items.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) =>
          items.length === 0 ? 0 : (c - 1 + items.length) % items.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const picked = items[cursor];
        if (picked) picked.onRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, cursor, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0a0a0a]/80 px-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden border border-[#1f1f1f] bg-[#0a0a0a]"
      >
        {/* Header — search input */}
        <div className="flex items-center gap-3 border-b border-[#1f1f1f] px-4 py-3">
          <span
            aria-hidden
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]"
          >
            ⌘K
          </span>
          <span
            aria-hidden
            className="inline-block h-px w-6"
            style={{ backgroundColor: "#1f1f1f" }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent text-[14px] text-[#f5f5f5] placeholder:text-[#5a5a5a] focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <ul
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto"
        >
          {items.length === 0 ? (
            <li className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#5a5a5a]">
              no matches
            </li>
          ) : (
            items.map((it, i) => {
              const selected = i === cursor;
              const isFirstAction =
                it.kind === "action" && i === firstActionIdx;
              const isFirstAgent = it.kind === "agent" && i === firstAgentIdx;

              return (
                <li key={it.id}>
                  {isFirstAction && (
                    <GroupHeader label="Jump to" first />
                  )}
                  {isFirstAgent && <GroupHeader label="Agents" />}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => it.onRun()}
                    className={`relative flex w-full items-center gap-3 border-b border-[#1f1f1f] px-4 py-2.5 text-left ${
                      selected ? "bg-[#141414]" : ""
                    }`}
                  >
                    {selected && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-full w-px"
                        style={{ backgroundColor: "#e63946" }}
                      />
                    )}
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          it.kind === "agent" ? "#e63946" : "#f5f5f5",
                      }}
                    />
                    <span className="flex-1 min-w-0">
                      <span
                        className={`block truncate text-[13.5px] ${
                          selected ? "text-[#f5f5f5]" : "text-[#f5f5f5]"
                        }`}
                      >
                        {it.label}
                      </span>
                      {it.hint && (
                        <span className="mt-0.5 block truncate font-mono text-[10.5px] tracking-[0.04em] text-[#5a5a5a]">
                          {it.hint}
                        </span>
                      )}
                    </span>
                    {it.kind === "action" && it.shortcut && (
                      <span className="flex items-center gap-1">
                        {it.shortcut.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    )}
                    {it.kind === "agent" && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
                        open →
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-[#1f1f1f] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              <span>select</span>
            </span>
          </div>
          <span className="text-[#5a5a5a]">obscura · ⌘K</span>
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 pt-4 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888] ${
        first ? "" : ""
      }`}
    >
      <span style={{ color: "#888" }}>{label}</span>
      <span
        aria-hidden
        className="inline-block h-px flex-1"
        style={{ backgroundColor: "#1f1f1f" }}
      />
    </div>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 16) return pk;
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`;
}
