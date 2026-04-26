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

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    // Next tick so the input exists
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0c0e] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 text-zinc-500"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="m11 11 3 3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <ul
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13px] text-zinc-500">
              No matches.
            </li>
          ) : (
            items.map((it, i) => {
              const selected = i === cursor;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => it.onRun()}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                      selected ? "bg-zinc-900" : ""
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        it.kind === "agent" ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                    />
                    <span className="flex-1">
                      <span
                        className={`block text-[13.5px] ${
                          selected ? "text-zinc-50" : "text-zinc-200"
                        }`}
                      >
                        {it.label}
                      </span>
                      {it.hint && (
                        <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
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
                      <span className="text-[11px] text-zinc-500">open</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 font-mono text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              select
            </span>
          </div>
          <span className="text-zinc-600">Payrail · ⌘K</span>
        </div>
      </div>
    </div>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 16) return pk;
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`;
}
