import "server-only";
import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PaymentRequirements } from "x402-solana";

// Build the unsigned Solana VersionedTransaction for an x402 payment.
//
// Mirrors x402-solana/client/transaction-builder.ts, which isn't re-exported
// from the package's public API. Reimplementing here lets us (a) avoid
// reaching into dist/ paths that could change across versions, and (b)
// later add our own memo instruction / compute-budget tuning without
// monkeypatching an upstream module.
//
// Important: the fee payer is the FACILITATOR (from requirements.extra.feePayer),
// not the agent. The agent only signs the SPL transfer authorization. The
// facilitator co-signs and broadcasts during /settle, paying the SOL gas.
const DEFAULT_COMPUTE_UNIT_LIMIT = 20_000; // sufficient for 1 SPL transfer
const DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 1;

export async function buildUnsignedX402PaymentTx(input: {
  connection: Connection;
  agentPubkey: PublicKey;
  requirements: PaymentRequirements;
}): Promise<VersionedTransaction> {
  const { connection, agentPubkey, requirements } = input;

  const feePayer = requirements.extra?.feePayer as string | undefined;
  if (!feePayer) {
    throw new Error("requirements.extra.feePayer missing (facilitator pubkey)");
  }
  if (!requirements.payTo) throw new Error("requirements.payTo missing");
  if (!requirements.asset) throw new Error("requirements.asset missing (mint)");

  const feePayerPubkey = new PublicKey(feePayer);
  const recipientPubkey = new PublicKey(requirements.payTo);
  const mintPubkey = new PublicKey(requirements.asset);

  // Detect whether this mint is Token or Token-2022 so ATAs + the transfer
  // instruction target the right program.
  const mintInfo = await connection.getAccountInfo(mintPubkey, "confirmed");
  const programId =
    mintInfo?.owner?.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58()
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

  const mint = await getMint(connection, mintPubkey, undefined, programId);

  const sourceAta = await getAssociatedTokenAddress(
    mintPubkey,
    agentPubkey,
    false,
    programId,
  );
  const destinationAta = await getAssociatedTokenAddress(
    mintPubkey,
    recipientPubkey,
    false,
    programId,
  );

  // Both ATAs must already exist — x402 doesn't include ATA-create in the
  // payment tx, and the facilitator won't add it either. For our agents, the
  // ATA is created on first top-up. For merchants, they create it at setup.
  const [sourceInfo, destInfo] = await Promise.all([
    connection.getAccountInfo(sourceAta, "confirmed"),
    connection.getAccountInfo(destinationAta, "confirmed"),
  ]);
  if (!sourceInfo) {
    throw new Error(
      `agent ATA ${sourceAta.toBase58()} does not exist — fund the agent first`,
    );
  }
  if (!destInfo) {
    throw new Error(
      `merchant ATA ${destinationAta.toBase58()} does not exist — merchant must initialise their payout wallet`,
    );
  }

  const amount = BigInt(requirements.amount);

  const instructions: TransactionInstruction[] = [
    // Facilitator REQUIRES ComputeBudget instructions in positions 0 and 1.
    ComputeBudgetProgram.setComputeUnitLimit({
      units: DEFAULT_COMPUTE_UNIT_LIMIT,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
    }),
    createTransferCheckedInstruction(
      sourceAta,
      mintPubkey,
      destinationAta,
      agentPubkey,
      amount,
      mint.decimals,
      [],
      programId,
    ),
  ];

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: feePayerPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
