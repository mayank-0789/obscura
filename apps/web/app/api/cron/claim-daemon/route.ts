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

// Bounded per tick to stay under the serverless deadline (one Groth16 claim ≈ 30s).
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
    // No persistent cursor: relayer rejects spent-nullifier double-claims, so correctness is fine; one redundant prove per spent UTXO.
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
