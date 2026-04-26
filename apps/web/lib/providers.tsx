"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

// Root client providers: NextAuth session, TanStack Query (data), Sonner (toasts).
// `session` is fetched server-side in the root layout via `auth()` and passed
// down so the first paint already knows the auth state — avoids a "session is
// loading" flicker.
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  );

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </QueryClientProvider>
    </SessionProvider>
  );
}
