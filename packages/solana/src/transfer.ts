import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  Transaction,
  TransactionExpiredBlockheightExceededError,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

export type TransferSplInput = {
  connection: Connection;
  // Keypair that signs and pays gas. For treasury transfers this is also the
  // source of the tokens.
  from: Keypair;
  // Destination wallet (NOT the ATA — we derive the ATA from wallet + mint).
  to: PublicKey;
  mint: PublicKey;
  // Amount in base units. USDC has 6 decimals, so 1 USDC = 1_000_000n.
  amount: bigint;
  decimals: number;
};

export type TransferSplResult = {
  signature: string;
};

// Build + sign + submit + confirm an SPL token transfer. The ATA-create
// instruction is idempotent, so racing creates from concurrent transfers are
// safe — whichever lands first wins, the other is a no-op.
//
// Throws on failure. Two failure modes matter:
//   - TransferAlreadyLanded  → caller should treat as success and look up the
//                              settled amount on-chain before retrying.
//   - TransferNeverLanded    → caller may safely retry.
// Any other thrown error is ambiguous; treat as a hard failure and surface to
// an operator.
export class TransferAlreadyLanded extends Error {
  constructor(public readonly signature: string) {
    super(`transferSpl: tx ${signature} already confirmed on-chain`);
    this.name = "TransferAlreadyLanded";
  }
}
export class TransferNeverLanded extends Error {
  constructor(public readonly signature: string) {
    super(`transferSpl: tx ${signature} expired without landing`);
    this.name = "TransferNeverLanded";
  }
}

export async function transferSpl({
  connection,
  from,
  to,
  mint,
  amount,
  decimals,
}: TransferSplInput): Promise<TransferSplResult> {
  const fromAta = await getAssociatedTokenAddress(mint, from.publicKey);
  const toAta = await getAssociatedTokenAddress(mint, to);

  // Idempotent ATA create: no-op if the ATA already exists, safe under concurrent
  // transfers. Always include it — the extra instruction costs negligible gas
  // and eliminates the pre-check → create race we'd have with the non-idempotent
  // variant.
  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      from.publicKey,
      toAta,
      to,
      mint,
    ),
  );
  tx.add(
    createTransferCheckedInstruction(
      fromAta,
      mint,
      toAta,
      from.publicKey,
      amount,
      decimals,
    ),
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.feePayer = from.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(from);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (err) {
    // Preflight simulation failures land here (e.g., insufficient-funds). Attach
    // the on-chain program logs to the thrown error so webhook_log.error
    // captures the real cause instead of the opaque default message.
    if (err instanceof SendTransactionError) {
      const logs = err.logs ?? (await err.getLogs(connection).catch(() => []));
      throw new Error(
        `transferSpl: send failed — ${err.message}${
          logs.length ? `\nLogs:\n${logs.join("\n")}` : ""
        }`,
      );
    }
    throw err;
  }

  try {
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    if (confirmation.value.err) {
      throw new Error(
        `transferSpl: on-chain error ${JSON.stringify(confirmation.value.err)}`,
      );
    }
    return { signature };
  } catch (err) {
    if (err instanceof TransactionExpiredBlockheightExceededError) {
      // The blockhash window passed before we saw confirmation. The tx MAY
      // still have landed — validator acceptance is independent of the RPC
      // node's cache. Query the signature directly to find out.
      const landed = await isSignatureLanded(connection, signature);
      throw landed
        ? new TransferAlreadyLanded(signature)
        : new TransferNeverLanded(signature);
    }
    throw err;
  }
}

async function isSignatureLanded(
  connection: Connection,
  signature: string,
): Promise<boolean> {
  try {
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    const confirmation = status.value?.confirmationStatus;
    // "processed" still counts — the tx is in a block, funds may have moved.
    // We err on the side of "landed" to avoid double-spend on retry.
    return (
      confirmation === "processed" ||
      confirmation === "confirmed" ||
      confirmation === "finalized"
    );
  } catch {
    // If the lookup itself fails, we can't be sure. Treat as landed to be
    // safe — better to stall than to double-spend.
    return true;
  }
}
