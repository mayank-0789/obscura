import "server-only";
import { eq } from "drizzle-orm";
import {
  db,
  merchants,
  merchantApiKeys,
  users,
  type Merchant,
  type User,
} from "@/lib/db";
import { generateMerchantApiKey } from "@/lib/merchant-keys";
import { registerMerchantPayoutAddress } from "@/lib/helius";
import {
  deriveMerchantEtaAddress,
  fundSubjectAddressIfNeeded,
  registerSubjectOnUmbra,
} from "@/lib/umbra";

/**
 * Carries only a code — raw error is logged but never stored in `message`
 * because callers tend to bubble `err.message` into HTTP responses.
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

type CreatedWallet = {
  merchantId: string;
  etaAddress: string;
  umbraRegisteredAt: Date;
};

/** 1:1 lookup — a user has at most one merchant. Null if not registered yet. */
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

async function createMerchantWallet(): Promise<CreatedWallet> {
  const merchantId = crypto.randomUUID();
  const etaAddress = deriveMerchantEtaAddress(merchantId);
  console.info(
    `[merchants/provision] merchant=${merchantId} eta=${etaAddress} → ` +
      `setting up Umbra account`,
  );
  try {
    await fundSubjectAddressIfNeeded(etaAddress);
    await registerSubjectOnUmbra("merchant", merchantId);
    return { merchantId, etaAddress, umbraRegisteredAt: new Date() };
  } catch (err) {
    console.error(
      `[merchants/provision] umbra setup failed for merchant=${merchantId}:`,
      err,
    );
    throw new MerchantProvisionError("wallet_creation_failed");
  }
}

/**
 * Provision a merchant end-to-end: derive Umbra wallet, register on Umbra,
 * atomic batch insert (merchant row + role bump), then mint initial API key.
 * Returns `created: false` + `apiKey: null` for race-loser or pre-existing.
 */
export async function provisionMerchant(
  user: User,
): Promise<{
  merchant: Merchant;
  created: boolean;
  apiKey: { plaintext: string } | null;
}> {
  const existing = await getMerchantByOwner(user.id);
  if (existing) return { merchant: existing, created: false, apiKey: null };

  const wallet = await createMerchantWallet();
  const needsRoleBump = user.role === "user";

  let insertedRow: Merchant | undefined;
  try {
    const insertMerchant = db
      .insert(merchants)
      .values({
        id: wallet.merchantId,
        ownerUserId: user.id,
        etaAddress: wallet.etaAddress,
        umbraStatus: "active",
        umbraRegisteredAt: wallet.umbraRegisteredAt,
      })
      .onConflictDoNothing({ target: merchants.ownerUserId })
      .returning();

    if (needsRoleBump) {
      // db.batch keeps role-bump atomic with merchant insert. Race-loser path:
      // role update is an idempotent no-op against the winner's 'both'.
      const [insertResult] = await db.batch([
        insertMerchant,
        db
          .update(users)
          .set({ role: "both", updatedAt: new Date() })
          .where(eq(users.id, user.id)),
      ]);
      insertedRow = insertResult[0];
    } else {
      const result = await insertMerchant;
      insertedRow = result[0];
    }
  } catch (err) {
    console.error("[merchants/provision] db insert", err);
    throw new MerchantProvisionError("db_insert_failed");
  }

  if (insertedRow) {
    console.info(
      `[merchants/provision] ✓ merchant=${insertedRow.id} eta=${insertedRow.etaAddress} created`,
    );

    // Race + FK: keep initial-key insert OUT of the merchants batch. Race-loser's
    // onConflictDoNothing drops the merchant row, so a same-batch key insert
    // would FK-trip on the missing merchantId and roll the whole batch back.
    const apiKey = generateMerchantApiKey();
    let initialKeyMinted = false;
    try {
      await db.insert(merchantApiKeys).values({
        merchantId: insertedRow.id,
        keyHash: apiKey.hash,
        label: "Initial key",
      });
      initialKeyMinted = true;
    } catch (err) {
      console.error(
        `[merchants/provision] initial api key insert failed for merchant=${insertedRow.id}; ` +
          `merchant created without one (recoverable via POST /api/merchants/me/keys):`,
        err,
      );
    }

    // Best-effort: Helius push for legacy SPL transfers to eta_address. Mixer
    // payments don't surface via Helius; this catches raw USDC sent direct.
    void registerMerchantPayoutAddress(insertedRow.etaAddress).catch((err) => {
      console.error(
        "[merchants/provision] helius register unexpected failure:",
        err,
      );
    });
    return {
      merchant: insertedRow,
      created: true,
      apiKey: initialKeyMinted ? { plaintext: apiKey.plaintext } : null,
    };
  }

  // Race-loser: re-read winner. Loser's funded SOL + Umbra registration at
  // a different eta_address are orphaned (~0.05 SOL, reconcilable manually).
  const winner = await getMerchantByOwner(user.id);
  if (!winner) throw new MerchantProvisionError("db_insert_failed");
  return { merchant: winner, created: false, apiKey: null };
}
