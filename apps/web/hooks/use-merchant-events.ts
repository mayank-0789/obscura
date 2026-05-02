"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// SSE merchant payment stream; manual fetch keeps a single auth path with
// `mk_` keys. Aborts on unmount/session change so server closes its writer.
// No reconnect loop yet — 10s polling is the fallback.
export function useMerchantEvents() {
  const queryClient = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      let res: Response;
      try {
        res = await fetch("/api/merchants/me/events", {
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (err) {
        if (!isAbort(err)) {
          console.error("[merchant-events] connect failed:", err);
        }
        return;
      }

      if (!res.ok || !res.body) {
        // 401/403/404 → polling fallback keeps UI usable; don't spam logs.
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            handleFrame(frame, queryClient);
          }
        }
      } catch (err) {
        if (!isAbort(err)) {
          console.error("[merchant-events] stream error:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [status, queryClient]);
}

function handleFrame(
  frame: string,
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  let eventType = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  void dataLines;

  if (eventType === "payment") {
    void queryClient.invalidateQueries({ queryKey: ["merchant", "me"] });
  }
}

function isAbort(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "AbortError" || err.code === DOMException.ABORT_ERR)
  );
}
