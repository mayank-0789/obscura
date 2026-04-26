"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import { parseApiError } from "@/lib/parse-api-error";

export type MerchantApi = {
  id: string;
  name: string;
  endpoint: string;
  defaultPriceUsdg: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { apis: MerchantApi[] };

export function useMerchantApis() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();
  return useQuery<ListResponse>({
    queryKey: ["merchant", "me", "apis"],
    enabled: status === "authenticated",
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const res = await authedFetch("/api/merchants/me/apis");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}

export type CreateApiInput = {
  name: string;
  endpoint: string;
  defaultPriceUsdg: string;
  status?: "active" | "paused";
};

export function useCreateMerchantApi() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  return useMutation<{ api: MerchantApi }, Error, CreateApiInput>({
    mutationFn: async (input) => {
      const res = await authedFetch("/api/merchants/me/apis", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      return res.json();
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["merchant", "me", "apis"],
      }),
  });
}

export type UpdateApiInput = Partial<CreateApiInput>;

export function useUpdateMerchantApi() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  return useMutation<
    { api: MerchantApi },
    Error,
    { id: string; input: UpdateApiInput }
  >({
    mutationFn: async ({ id, input }) => {
      const res = await authedFetch(`/api/merchants/me/apis/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      return res.json();
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["merchant", "me", "apis"],
      }),
  });
}

export function useDeleteMerchantApi() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  return useMutation<{ id: string; deleted: true }, Error, string>({
    mutationFn: async (id) => {
      const res = await authedFetch(`/api/merchants/me/apis/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      return res.json();
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["merchant", "me", "apis"],
      }),
  });
}
