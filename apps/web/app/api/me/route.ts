import { eq } from "drizzle-orm";
import { privy } from "@/lib/privy-server";
import { db, users } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// GET /api/me — returns user row + primary Solana wallet (consumed by useUser()).
export async function GET(req: Request) {
  let privyUserId: string;
  try {
    privyUserId = await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyId, privyUserId))
    .limit(1);

  if (!user) return apiError("user_not_synced");

  const solanaWallet = await findSolanaWallet(privyUserId);
  return apiOk({ user, solanaWallet });
}

async function findSolanaWallet(
  privyUserId: string,
): Promise<{ id: string; address: string } | null> {
  try {
    const { linkedAccounts } = await privy.getUserById(privyUserId);
    const match = linkedAccounts.find(
      (a) =>
        a.type === "wallet" && "chainType" in a && a.chainType === "solana",
    ) as { id?: string; address?: string } | undefined;
    if (!match?.address) return null;
    return { id: match.id ?? "", address: match.address };
  } catch (err) {
    console.error("[me/wallet]", err);
    return null;
  }
}
