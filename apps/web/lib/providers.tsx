"use client";

import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { env } from "@/lib/env";

// Root client providers: Privy (auth + wallets), TanStack Query (data), Sonner (toasts).
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  );

  return (
    <PrivyProvider
      appId={env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#34d399",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
      </QueryClientProvider>
    </PrivyProvider>
  );
}
