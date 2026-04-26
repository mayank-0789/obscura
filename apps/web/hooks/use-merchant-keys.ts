"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import { parseApiError } from "@/lib/parse-api-error";

export type MerchantApiKey = {
  id: string;
  label: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type KeysListResponse = { keys: MerchantApiKey[] };

export type CreatedMerchantKey = {
  key: { id: string; label: string | null; createdAt: string };
  plaintext: string;
};

export function useMerchantKeys() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();
  return useQuery<KeysListResponse>({
    queryKey: ["merchant", "me", "keys"],
    enabled: status === "authenticated",
    retry: false,
    queryFn: async () => {
      const res = await authedFetch("/api/merchants/me/keys");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}

export function useCreateMerchantKey() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  return useMutation<CreatedMerchantKey, Error, { label?: string }>({
    mutationFn: async ({ label }) => {
      const res = await authedFetch("/api/merchants/me/keys", {
        method: "POST",
        body: JSON.stringify(label ? { label } : {}),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["merchant", "me", "keys"] });
    },
  });
}

export function useRevokeMerchantKey() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  return useMutation<{ id: string; revoked: true }, Error, string>({
    mutationFn: async (id) => {
      const res = await authedFetch(`/api/merchants/me/keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["merchant", "me", "keys"] });
    },
  });
}
