import "server-only";
import { eq } from "drizzle-orm";
import { ensureAta, PublicKey } from "@payrail-app/solana";
import { db, merchants, users, type Merchant, type User } from "@/lib/db";
import { registerMerchantPayoutAddress } from "@/lib/helius";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";

/**
 * Typed error thrown by merchant-provisioning helpers. Carries only a code —
 * the raw underlying error is logged at the throw site but NEVER stored in
 * this error's message, because callers tend to bubble `err.message` into
 * HTTP responses and SDK errors can contain wallet IDs and stack fragments.
 */
export class MerchantProvisionError extends Error {
  constructor(
    public readonly code:
      | "wallet_creation_failed"
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
 * STAGE 8 STUB (Day 8–9): merchant wallet creation will derive an Umbra
 * keypair server-side, eagerly register on Umbra, and return the encrypted-
 * account address. Until that lands this throws, so the merchants POST
 * route surfaces a clean error rather than half-creating a row.
 *
 * Returns `{ etaAddress }` — the merchant's Umbra-side L1 address (where
 * agents pay them via ETA→ETA confidential transfer).
 */
export async function createMerchantWallet(
  _user: User,
): Promise<{ etaAddress: string }> {
  void _user;
  console.error(
    "[merchants/provision] wallet creation not yet migrated to Umbra (Stage 8 / Days 8–9)",
  );
  throw new MerchantProvisionError("wallet_creation_failed");
}

/**
 * Provision a merchant end-to-end: derive Umbra wallet (Stage 8 stub), then
 * atomically INSERT the merchants row AND bump user.role (if currently 'user')
 * via db.batch. Conflict path re-reads the winner's row.
 *
 * Returns `{ merchant, created }` — `created` distinguishes the happy path
 * (first caller) from the race-loser path.
 */
export async function provisionMerchant(
  user: User,
): Promise<{ merchant: Merchant; created: boolean }> {
  const existing = await getMerchantByOwner(user.id);
  if (existing) return { merchant: existing, created: false };

  const wallet = await createMerchantWallet(user);

  const needsRoleBump = user.role === "user";

  let insertedRow: Merchant | undefined;
  try {
    if (needsRoleBump) {
      const [insertResult] = await db.batch([
        db
          .insert(merchants)
          .values({
            ownerUserId: user.id,
            etaAddress: wallet.etaAddress,
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
          etaAddress: wallet.etaAddress,
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
    // Initialise the merchant's stablecoin ATA so any non-Umbra (legacy SPL)
    // agent payment can still land. Treasury covers the ~0.002 SOL rent; ZERO
    // tokens move. Best-effort — fall through on failure. STAGE 8 may drop
    // this call entirely once ETA→ETA replaces SPL on the agent path.
    try {
      await ensureAta({
        connection: getConnection(),
        payer: getTreasury(),
        owner: new PublicKey(insertedRow.etaAddress),
        mint: getStablecoinMint(),
      });
    } catch (err) {
      console.error(
        `[merchants/provision] ATA init failed for ${insertedRow.etaAddress}; merchant must self-initialise before agents can pay:`,
        err,
      );
    }

    void registerMerchantPayoutAddress(insertedRow.etaAddress).catch((err) => {
      console.error(
        "[merchants/provision] helius register unexpected failure:",
        err,
      );
    });
    return { merchant: insertedRow, created: true };
  }

  // Conflict — another concurrent call won. Re-read their row.
  const winner = await getMerchantByOwner(user.id);
  if (!winner) throw new MerchantProvisionError("db_insert_failed");
  return { merchant: winner, created: false };
}
