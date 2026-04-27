"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@obscura-app/db";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import { parseApiError } from "@/lib/parse-api-error";
import type { Role } from "@/lib/onboarding";

type SetRoleResponse = {
  user: User;
  merchant: {
    id: string;
    etaAddress: string;
    name: string | null;
    createdAt: string;
  } | null;
  merchantCreated: boolean;
  // Plaintext initial merchant API key, returned exactly once on the
  // creation hop (`merchantCreated: true`). null on idempotent re-call.
  apiKey: string | null;
};

/**
 * Posts the user's chosen role to `/api/onboarding/role` and, for roles that
 * need a merchant record, provisions one server-side in the same call.
 *
 * On success the `me` query is invalidated so every consumer refetches with
 * the new role. The caller is expected to navigate to the right dashboard
 * based on the returned role.
 */
export function useSetRole() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();

  return useMutation<SetRoleResponse, Error, Role>({
    mutationFn: async (role) => {
      const res = await authedFetch("/api/onboarding/role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
