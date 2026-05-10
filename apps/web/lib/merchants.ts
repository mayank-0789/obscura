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

/** Code-only — callers bubble `err.message` into HTTP responses. */
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
 * Derive Umbra wallet → register → atomic batch insert (merchant + role
 * bump) → mint initial API key. Returns `created:false, apiKey:null` for
 * race-loser or pre-existing.
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
    if (needsRoleBump) {
      // Atomic with merchant insert; race-loser's role update no-ops against winner's 'both'.
      const insertResult = await db.transaction(async (tx) => {
        const rows = await tx
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
        await tx
          .update(users)
          .set({ role: "both", updatedAt: new Date() })
          .where(eq(users.id, user.id));
        return rows;
      });
      insertedRow = insertResult[0];
    } else {
      const result = await db
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

    // Keep key insert OUT of merchants batch: race-loser's onConflictDoNothing
    // drops the row, so a same-batch key insert would FK-trip and fail.
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

    // Helius push for legacy SPL transfers; mixer payments don't surface here.
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

  // Race-loser: re-read winner. Loser's ~0.05 SOL + Umbra registration are orphaned.
  const winner = await getMerchantByOwner(user.id);
  if (!winner) throw new MerchantProvisionError("db_insert_failed");
  return { merchant: winner, created: false, apiKey: null };
}
