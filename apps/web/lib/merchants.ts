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

type CreatedWallet = {
  merchantId: string;
  etaAddress: string;
  umbraRegisteredAt: Date;
};

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
 * Provision the merchant's Umbra-side wallet. Mirrors `createAgentWallet` in
 * `/api/agents` POST:
 *   1. Pre-generate the merchant UUID — same UUID is the canonical input to
 *      the HMAC seed-derivation, so a re-run with the same UUID lands on the
 *      same on-chain account.
 *   2. Lazy-fund the derived address with SOL from treasury so it can pay its
 *      own Umbra registration fees (~3 txs, ~0.01 SOL). Idempotent.
 *   3. Eager-register on Umbra (`{confidential: true, anonymous: true}`) so
 *      the merchant can both receive direct deposits AND be addressed via
 *      the mixer (Path B is what `/api/x402/sign` writes to).
 *
 * Returns `{ merchantId, etaAddress, umbraRegisteredAt }` on success or
 * throws `MerchantProvisionError("wallet_creation_failed")` on failure. The
 * funded SOL is orphaned on subsequent failure paths (caller's race-loser
 * branch); minimal cost (~0.05 SOL) per orphan, same trade-off as agents.
 */
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
 * Provision a merchant end-to-end:
 *   1. Existence check — short-circuit if user already has a merchant.
 *   2. Derive Umbra wallet + register on Umbra.
 *   3. Atomic batch insert: merchants row (+ users.role bump from 'user' →
 *      'both' when the caller was an agent-developer adding the merchant
 *      side). The role bump piggybacks the merchant insert so a failed insert
 *      never leaves a user claiming 'both' with no merchant row.
 *   4. On creation success only: a follow-up insert of an initial API key.
 *      Kept OUT of the merchants batch on purpose — see "Race + FK" below.
 *
 * Returns `{ merchant, created, apiKey }`:
 *   - `created: true` on first-call success → `apiKey` is the plaintext
 *     initial key (shown to the user once).
 *   - `created: false` on the race-loser path or pre-existing merchant →
 *     `apiKey` is null. Existing merchants mint additional keys via
 *     POST /api/merchants/me/keys.
 *
 * Race + FK: a naive batch of [insertMerchant + insertKey] breaks under
 * concurrent provisioning. The race-loser's `onConflictDoNothing` drops zero
 * rows, but the same batch then tries to insert a key referencing the
 * loser's wallet.merchantId — which never made it into merchants — and the
 * FK check fires immediately, rolling the whole batch back. The loser would
 * then see `db_insert_failed` even though a winner exists. Splitting the
 * key insert into a follow-up step (only when `insertedRow` is truthy)
 * avoids this entirely.
 *
 * Race safety: rate-limit (1 per 10s shared with /api/onboarding/role) +
 * unique index on `merchants.owner_user_id`. The losing INSERT trips
 * `onConflictDoNothing` and we re-read the winner's row. Loser's funded SOL
 * is orphaned at the loser's eta_address (~0.05 SOL); acceptable for
 * hackathon scale, reconcilable manually if it ever matters.
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
      // db.batch hits Neon's /sql/transaction endpoint — both writes commit
      // together or neither does. Keeps the role-bump atomic with the
      // merchant insert. Note: when the insert hits onConflictDoNothing
      // (race-loser), the role update STILL runs — but its target is the
      // same 'both' the winner just wrote, so it's a no-op idempotent write.
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

    // Mint the initial API key as a follow-up. If this insert fails the
    // merchant row still exists and the user can mint a key via
    // /api/merchants/me/keys — better than collapsing the entire creation
    // because key issuance hiccupped. We surface `apiKey: null` so the
    // caller doesn't return a plaintext that won't authenticate.
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

    // Best-effort: Helius enhanced-webhooks push for legacy SPL transfers to
    // the eta_address. Umbra mixer payments don't surface as Helius events
    // (Arcium MPC callback semantics), but if anyone ever sends raw USDC to
    // this address we'd still want the dashboard to react. Fire-and-forget
    // because creation must succeed even when push-update plumbing is
    // unconfigured or flaky; failures are logged inside the helper.
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

  // Conflict — another concurrent call won the unique-index race. Re-read
  // their row. The losing call's SOL + Umbra registration at
  // wallet.etaAddress are orphaned (different from the winner's eta).
  const winner = await getMerchantByOwner(user.id);
  if (!winner) throw new MerchantProvisionError("db_insert_failed");
  return { merchant: winner, created: false, apiKey: null };
}
