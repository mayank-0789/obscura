import { eq } from "drizzle-orm";
import {
  getClaimableUtxoScannerFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraRelayer,
} from "@umbra-privacy/sdk";
import { getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver } from "@umbra-privacy/web-zk-prover";
import { db, merchants } from "@/lib/db";
import { apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { cronAuthGuard } from "@/lib/cron-auth";
import { buildSubjectUmbraClient } from "@/lib/umbra";

// GET /api/cron/claim-daemon — auto-claim daemon for ALL active merchants.
//
// For each merchant whose ETA has been registered on Umbra, scan the mixer
// indexer for receiver-claimable UTXOs, filter out ones we've already claimed
// (tracked via the on-chain nullifier check — the SDK rejects spent claims at
// the circuit), and submit the rest to the Umbra relayer for claiming. The
// relayer signs + pays gas, so the merchant's wallet never appears as fee
// payer.
//
// Schedule: every 2 minutes (see vercel.json). Vercel Cron guarantees no
// overlap per route — the scheduler waits for the previous invocation to
// finish before firing the next, so no lock-file is needed at this layer.
//
// **Overlap behavior**: Vercel Cron does not formally document whether
// invocations of the same path serialize. We assume the scheduler will fire
// the next tick whether or not the previous finished, so the merchant cap
// below has to keep us under the function deadline on its own.
//
// **Vercel deadline note**: hobby plan caps cron functions at 60s, paid plans
// at 300s. A single Groth16 claim proof takes ~30s. To stay safely under the
// hobby cap with one claim per merchant, we process at most 2 merchants per
// invocation (~60s worst case). On paid plans this could go higher; for
// production scale, switch to a long-running worker (Railway / Fly).
//
// **Spent-nullifier note**: this serverless route has no persistent local FS,
// so we rely on the relayer rejecting double-claims at submit time — wasteful
// (one redundant prove per spent UTXO) but correct. A Redis-backed
// claimedLeafIds set is the production fix; deferred.

const PER_INVOCATION_MERCHANT_LIMIT = 2;

interface MerchantClaimSummary {
  merchantId: string;
  scanned: number;
  claimedBatches: number;
  failedBatches: number;
  elapsedMs: number;
  error?: string;
}

export async function GET(req: Request): Promise<Response> {
  const guard = cronAuthGuard(req);
  if (guard) return guard;

  if (!env.UMBRA_INDEXER_URL || !env.UMBRA_RELAYER_URL) {
    return apiOk({
      ok: false,
      reason:
        "UMBRA_INDEXER_URL and UMBRA_RELAYER_URL must be set for the claim daemon to run",
    });
  }

  const startedAt = Date.now();

  // Pick up to N active merchants per run. Bounded so a busy merchant pool
  // doesn't blow Vercel's deadline. Round-robin would be fairer (oldest-first
  // by something like `last_claimed_at`) — for hackathon scale this is fine.
  const activeMerchants = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.umbraStatus, "active"))
    .limit(PER_INVOCATION_MERCHANT_LIMIT);

  if (activeMerchants.length === 0) {
    return apiOk({
      ok: true,
      merchants: 0,
      summaries: [],
      elapsedMs: Date.now() - startedAt,
    });
  }

  const summaries: MerchantClaimSummary[] = [];
  for (const m of activeMerchants) {
    const summary = await claimForMerchant(m.id);
    summaries.push(summary);
  }

  return apiOk({
    ok: true,
    merchants: activeMerchants.length,
    summaries,
    elapsedMs: Date.now() - startedAt,
  });
}

async function claimForMerchant(
  merchantId: string,
): Promise<MerchantClaimSummary> {
  const startedAt = Date.now();
  try {
    const client = await buildSubjectUmbraClient("merchant", merchantId);
    const scan = getClaimableUtxoScannerFunction({ client });
    // Always start the scan from tree 0, index 0. Without persistent state
    // we can't track a cursor; the scanner returns spent UTXOs too but the
    // relayer rejects them. Acceptable inefficiency for hackathon scope.
    const scanResult = await scan(0n as never, 0n as never);

    if (scanResult.received.length === 0) {
      return {
        merchantId,
        scanned: 0,
        claimedBatches: 0,
        failedBatches: 0,
        elapsedMs: Date.now() - startedAt,
      };
    }

    if (!client.fetchBatchMerkleProof) {
      throw new Error(
        "Umbra client missing fetchBatchMerkleProof — UMBRA_INDEXER_URL unreachable?",
      );
    }
    const relayer = getUmbraRelayer({ apiEndpoint: env.UMBRA_RELAYER_URL! });
    const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
      { client },
      {
        fetchBatchMerkleProof: client.fetchBatchMerkleProof,
        zkProver: getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver(),
        relayer: {
          submitClaim: relayer.submitClaim,
          pollClaimStatus: relayer.pollClaimStatus,
          getRelayerAddress: relayer.getRelayerAddress,
        },
      },
    );
    const result = await claim(scanResult.received);

    let claimedBatches = 0;
    let failedBatches = 0;
    for (const batch of result.batches.values()) {
      if (batch.status === "completed") claimedBatches += 1;
      else failedBatches += 1;
    }
    return {
      merchantId,
      scanned: scanResult.received.length,
      claimedBatches,
      failedBatches,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      merchantId,
      scanned: 0,
      claimedBatches: 0,
      failedBatches: 0,
      elapsedMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

