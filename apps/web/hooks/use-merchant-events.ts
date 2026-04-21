"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";

// Subscribes to the merchant's real-time payment stream at
// /api/merchants/me/events. When a `payment` SSE frame lands, invalidates
// every `["merchant", "me", ...]` React Query so stats + tx feed refresh
// immediately (faster than the 10s polling baseline).
//
// Why not the browser's `EventSource`? EventSource doesn't support custom
// Authorization headers, which our `merchantAuthGuard` requires. We read the
// stream manually via fetch + ReadableStream instead — one file, no polyfill,
// full control over auth and reconnect.
//
// Lifecycle:
//   - Connects once when Privy is ready + authenticated.
//   - On unmount / auth change, aborts the fetch, which closes the stream
//     server-side (the SSE route listens to req.signal abort).
//   - No explicit reconnect loop yet — the 10s polling is the fallback if
//     the connection drops. A client-side retry could be added in v2.
export function useMerchantEvents() {
  const queryClient = useQueryClient();
  const { ready, authenticated, getAccessToken } = usePrivy();

  useEffect(() => {
    if (!ready || !authenticated) return;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      const token = await getAccessToken().catch(() => null);
      if (!token || cancelled) return;

      let res: Response;
      try {
        res = await fetch("/api/merchants/me/events", {
          headers: { Authorization: `Bearer ${token}` },
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
        // 401/403/404 → polling will keep the UI usable. Don't spam logs;
        // auth issues are already surfaced by other queries.
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

          // SSE frames are separated by a blank line (\n\n). Each frame is
          // a set of `event: <name>` / `data: <payload>` / `: <comment>`
          // lines.
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
  }, [ready, authenticated, getAccessToken, queryClient]);
}

function handleFrame(
  frame: string,
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  // Per SSE spec, a frame without `event:` defaults to type "message" and a
  // frame's data is the concatenation of every `data:` line (separated by
  // "\n"). We parse both for forward-compatibility even though today we
  // only branch on `eventType`.
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
  // dataLines collected but unused today — reserved for future event types
  // that carry structured bodies (e.g. per-transaction optimistic patches).
  void dataLines;

  if (eventType === "payment") {
    // Broad invalidate — covers /me, /me/transactions, /me/apis, /me/keys.
    // All cheap queries on the merchant surface, so the coarse key is fine.
    void queryClient.invalidateQueries({ queryKey: ["merchant", "me"] });
  }
}

function isAbort(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "AbortError" || err.code === DOMException.ABORT_ERR)
  );
}
