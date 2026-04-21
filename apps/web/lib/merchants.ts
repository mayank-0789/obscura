import "server-only";
import { eq } from "drizzle-orm";
import { ensureAta, PublicKey } from "@payrail/solana";
import { privy } from "@/lib/privy-server";
import { db, merchants, users, type Merchant, type User } from "@/lib/db";
import { env } from "@/lib/env";
import { registerMerchantPayoutAddress } from "@/lib/helius";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";

/**
 * Typed error thrown by merchant-provisioning helpers. Carries only a code —
 * the raw underlying error (Privy response, DB driver error) is logged at the
 * throw site but NEVER stored in this error's message, because callers tend
 * to bubble `err.message` into HTTP responses and Privy errors contain
 * wallet IDs, app IDs, and stack fragments. (Same defensive posture as
 * `/api/x402/sign` — see route.ts:139 there.)
 */
export class MerchantProvisionError extends Error {
  constructor(
    public readonly code:
      | "privy_key_missing"
      | "privy_wallet_failed"
      | "db_insert_failed",
  ) {
    super(code);
    this.name = "MerchantProvisionError";
  }
}

/**
 * 1:1 lookup — a user has at most one merchant (enforced by the unique index
 * `merchants_owner_user_id_idx`). Returns null if the user hasn't registered
 * as a merchant yet.
 */
export async function getMerchantByOwner(
  userId: string,
): Promise<Merchant | null> {
  const [row] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.ownerUserId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Mint a new Privy-custodied Solana wallet for this user with our delegated
 * signer attached (so the v2 cash-out path can sign server-side). Does not
 * touch the database — callers combine this with the merchant insert in
 * whatever atomicity shape they need.
 */
export async function createMerchantWallet(
  user: User,
): Promise<{ id: string; address: string }> {
  if (!env.PRIVY_AUTHORIZATION_KEY_ID) {
    console.error(
      "[merchants/mint] PRIVY_AUTHORIZATION_KEY_ID missing; merchant wallet would be un-signable",
    );
    throw new MerchantProvisionError("privy_key_missing");
  }

  try {
    const wallet = await privy.walletApi.createWallet({
      chainType: "solana",
      owner: { userId: user.privyId },
      additionalSigners: [{ signerId: env.PRIVY_AUTHORIZATION_KEY_ID }],
    });
    return { id: wallet.id, address: wallet.address };
  } catch (err) {
    console.error("[merchants/mint] privy createWallet", err);
    throw new MerchantProvisionError("privy_wallet_failed");
  }
}

/**
 * Provision a merchant end-to-end for this user: mint Privy wallet, then
 * atomically INSERT-ON-CONFLICT the merchants row AND bump user.role (if
 * currently 'user') via db.batch. If the INSERT conflicts (concurrent call
 * already won the race), we re-read the winner's row and orphan our freshly
 * minted Privy wallet — the same accepted tradeoff as agents/create, since
 * @privy-io/server-auth provides no delete API.
 *
 * Returns `{ merchant, created }` — `created` distinguishes the happy path
 * (first caller) from the race-loser path (second caller reading winner's row).
 */
export async function provisionMerchant(
  user: User,
): Promise<{ merchant: Merchant; created: boolean }> {
  const existing = await getMerchantByOwner(user.id);
  if (existing) return { merchant: existing, created: false };

  const wallet = await createMerchantWallet(user);

  // Role bump is piggybacked into the same batch so that either both the
  // merchant row and the role change commit, or neither does. If the user is
  // already 'merchant' or 'both', no role change is needed — we just run the
  // insert alone.
  const needsRoleBump = user.role === "user";

  let insertedRow: Merchant | undefined;
  try {
    if (needsRoleBump) {
      const [insertResult] = await db.batch([
        db
          .insert(merchants)
          .values({
            ownerUserId: user.id,
            privyWalletId: wallet.id,
            payoutWallet: wallet.address,
          })
          .onConflictDoNothing({ target: merchants.ownerUserId })
          .returning(),
        db
          .update(users)
          .set({ role: "both", updatedAt: new Date() })
          .where(eq(users.id, user.id)),
      ]);
      insertedRow = insertResult[0];
    } else {
      const result = await db
        .insert(merchants)
        .values({
          ownerUserId: user.id,
          privyWalletId: wallet.id,
          payoutWallet: wallet.address,
        })
        .onConflictDoNothing({ target: merchants.ownerUserId })
        .returning();
      insertedRow = result[0];
    }
  } catch (err) {
    console.error("[merchants/provision] db insert", err);
    throw new MerchantProvisionError("db_insert_failed");
  }

  if (insertedRow) {
    // Initialise the merchant's USDC ATA so agents' x402 payments can land on
    // their very first call. Without this step, a freshly-signed-up merchant
    // has a wallet but no token account — and `/api/x402/sign` refuses to
    // add an ATA-create instruction (that'd make the agent pay rent for a
    // stranger's account). Treasury covers the ~0.002 SOL rent; ZERO USDC
    // moves. Best-effort: on failure, the merchant still works, they'll
    // just need to manually receive any USDC before agents can pay them.
    try {
      await ensureAta({
        connection: getConnection(),
        payer: getTreasury(),
        owner: new PublicKey(insertedRow.payoutWallet),
        mint: getStablecoinMint(),
      });
    } catch (err) {
      console.error(
        `[merchants/provision] ATA init failed for ${insertedRow.payoutWallet}; merchant must self-initialise before agents can pay:`,
        err,
      );
    }

    // Register the payout wallet with Helius so real-time webhooks fire on
    // incoming payments. Fire-and-forget: if Helius is unreachable or not
    // configured, the merchant still works (dashboards degrade to polling).
    // The inner helper already try/catches, but we belt-and-brace the
    // promise here so any future refactor that lets an error escape doesn't
    // become an unhandled rejection.
    void registerMerchantPayoutAddress(insertedRow.payoutWallet).catch(
      (err) => {
        console.error(
          "[merchants/provision] helius register unexpected failure:",
          err,
        );
      },
    );
    return { merchant: insertedRow, created: true };
  }

  // Conflict — another concurrent call won. Re-read their row. In the
  // extremely unlikely case it's still missing (someone deleted between
  // ON CONFLICT fire and our re-read), surface db_insert_failed.
  const winner = await getMerchantByOwner(user.id);
  if (!winner) throw new MerchantProvisionError("db_insert_failed");
  return { merchant: winner, created: false };
}
