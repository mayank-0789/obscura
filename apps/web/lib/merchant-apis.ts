import "server-only";
import { z } from "zod";
import type { merchantApis } from "@/lib/db";

// `%` handled via `(?:%[0-9A-Fa-f]{2})` so malformed encodings like `/foo%zz` are rejected.
const ENDPOINT_RE =
  /^\/(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/]|%[0-9A-Fa-f]{2})*$/;

export const ApiNameSchema = z.string().trim().min(1).max(80);

/**
 * Accepts a bare path (`/article/:id`) OR a full URL (normalized to its
 * pathname). Rejects anything that's neither.
 */
export const ApiEndpointSchema = z
  .string()
  .trim()
  .min(1)
  .max(400)
  .transform((value, ctx) => {
    if (ENDPOINT_RE.test(value)) return value;
    try {
      const u = new URL(value);
      const path = u.pathname || "/";
      if (!ENDPOINT_RE.test(path)) {
        ctx.addIssue({
          code: "custom",
          message: "endpoint path is malformed",
        });
        return z.NEVER;
      }
      return path;
    } catch {
      ctx.addIssue({
        code: "custom",
        message:
          "endpoint must be a URL path starting with / or a valid absolute URL",
      });
      return z.NEVER;
    }
  });

// 100 atomic = $0.0001; 100_000_000 atomic = $100 per call.
export const ApiPriceSchema = z
  .union([
    z.bigint(),
    z
      .string()
      .regex(/^\d+$/, "price must be a base-10 integer string")
      .transform((s) => BigInt(s)),
    z
      .number()
      .int()
      .nonnegative()
      .transform((n) => BigInt(n)),
  ])
  .refine((v) => v >= 100n && v <= 100_000_000n, {
    message: "price must be between 100 (= $0.0001) and 100_000_000 (= $100)",
  });

export const ApiStatusSchema = z.enum(["active", "paused"]);

export const CreateApiBodySchema = z.object({
  name: ApiNameSchema,
  endpoint: ApiEndpointSchema,
  defaultPriceUsdg: ApiPriceSchema,
  status: ApiStatusSchema.optional().default("active"),
});

export const UpdateApiBodySchema = z.object({
  name: ApiNameSchema.optional(),
  endpoint: ApiEndpointSchema.optional(),
  defaultPriceUsdg: ApiPriceSchema.optional(),
  status: ApiStatusSchema.optional(),
});

export type CreateApiBody = z.infer<typeof CreateApiBodySchema>;
export type UpdateApiBody = z.infer<typeof UpdateApiBodySchema>;

/** Shared serializer; bigint → decimal string for JSON transport. */
export function serializeMerchantApi(
  row: typeof merchantApis.$inferSelect,
): {
  id: string;
  name: string;
  endpoint: string;
  defaultPriceUsdg: string;
  status: "active" | "paused";
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    defaultPriceUsdg: row.defaultPriceUsdg.toString(),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
