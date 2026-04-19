import { privy } from "@/lib/privy-server";
import { authGuard } from "@/lib/auth";
import { apiOk } from "@/lib/api";

// GET /api/me — returns the authenticated user row + their primary Solana
// wallet address (consumed by useUser()). The wallet address is fetched fresh
// from Privy — it's the one auto-created at signup, not an agent wallet.
export async function GET(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const solanaAddress = await findSolanaAddress(user.privyId);
  return apiOk({ user, solanaAddress });
}

async function findSolanaAddress(privyUserId: string): Promise<string | null> {
  try {
    const { linkedAccounts } = await privy.getUserById(privyUserId);
    const match = linkedAccounts.find(
      (a) => a.type === "wallet" && "chainType" in a && a.chainType === "solana",
    ) as { address?: string } | undefined;
    return match?.address ?? null;
  } catch (err) {
    console.error("[me/wallet]", err);
    return null;
  }
}
