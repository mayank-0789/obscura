import { z } from "zod";
import { count, desc, eq } from "drizzle-orm";
import { privy } from "@/lib/privy-server";
import {
  db,
  agents,
  budgets,
  agentApiKeys,
  type Agent,
  type User,
} from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { quoteInrToUsdg } from "@/lib/rates";
import { generateAgentApiKey } from "@/lib/agent-keys";
import { serializeAgent } from "@/lib/agent-serialize";
import { checkLimit } from "@/lib/ratelimit";

// Hard ceiling on agents per user. Protects Privy wallet quota + keeps a single
// account from ballooning the DB. Raise as we learn real usage patterns.
const AGENTS_PER_USER_LIMIT = 50;

const CreateAgentBody = z.object({
  name: z.string().trim().min(1).max(60),
  // Monthly spend cap in whole rupees. Stored as paise internally.
  monthlyCapInr: z.number().int().positive().max(1_000_000),
});

// GET /api/agents — list the current user's agents with their budgets.
export async function GET(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const rows = await db
    .select({ agent: agents, budget: budgets })
    .from(agents)
    .leftJoin(budgets, eq(budgets.agentId, agents.id))
    .where(eq(agents.userId, user.id))
    .orderBy(desc(agents.createdAt));

  return apiOk({
    agents: rows.map(({ agent, budget }) => serializeAgent(agent, budget)),
  });
}

// POST /api/agents — create an agent: Privy Solana wallet + agents row +
// budgets row + first API key. Returns the plaintext key exactly once.
export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const body = await parseBody(req);
  if (body instanceof Response) return body;

  // Rate limit ahead of any billable side effects (Privy wallet, DB writes).
  const allowed = await checkLimit("create-agent", user.id, 5, "1 h");
  if (!allowed) return apiError("rate_limited");

  // Count check before the Privy call — we don't want to create a wallet only
  // to reject the insert. The read-then-insert is racy: two parallel creates
  // may both pass the check and land, briefly exceeding the cap. The
  // practical overshoot is bounded by the rate limit (5 creates/hour/user)
  // and the cap is generous (50), so worst case is ~6 extra. Acceptable for
  // v1; if this ever starts mattering, migrate to an atomic UPDATE-RETURNING
  // on a users.agent_count column or a dedicated agent_quota table.
  const [{ value: agentCount } = { value: 0 }] = await db
    .select({ value: count() })
    .from(agents)
    .where(eq(agents.userId, user.id));
  if (agentCount >= AGENTS_PER_USER_LIMIT) return apiError("agent_limit_reached");

  const wallet = await createAgentWallet(user.privyId);
  if (wallet instanceof Response) return wallet;

  const capInrPaise = BigInt(body.monthlyCapInr) * 100n;
  const { usdg: capUsdg, rate } = quoteInrToUsdg(capInrPaise);
  const apiKey = generateAgentApiKey();

  try {
    const agent = await insertAgentRows({
      user,
      name: body.name,
      wallet,
      capInrPaise,
      capUsdg,
      apiKeyHash: apiKey.hash,
    });

    return apiOk(
      {
        agent: serializeAgent(agent, {
          period: "monthly",
          capInr: capInrPaise,
          capUsdg,
          spentUsdg: 0n,
        }),
        rateSnapshot: rate,
        apiKey: apiKey.plaintext,
      },
      { status: 201 },
    );
  } catch (err) {
    // Privy wallet exists but the DB rows don't. We can't compensate by
    // deleting the wallet — @privy-io/server-auth doesn't expose a delete
    // method; wallets are permanent once minted. Reconciliation must be a
    // post-MVP background job that pages Privy's REST API and marks wallets
    // with no matching agents row as archived. For hackathon-scale traffic
    // the cost of an occasional orphan (free-tier Privy quota) is negligible.
    console.error("[agents/create] db insert", err);
    return apiError("server_error");
  }
}

async function parseBody(req: Request) {
  try {
    return CreateAgentBody.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }
}

async function createAgentWallet(privyUserId: string) {
  // Attach our delegated signer so the x402 hot path can sign for this wallet
  // server-side. Verified via scripts/spike-privy-variants.ts (2026-04-20):
  // `additionalSigners: [{ signerId: <auth-key-id> }]` is the parameter Privy
  // honours at signTransaction time. The seemingly-equivalent
  // `authorizationKeyIds: [...]` is silently ignored by the sign endpoint
  // even though createWallet accepts it — see project_privy_delegated_signing.md.
  if (!env.PRIVY_AUTHORIZATION_KEY_ID) {
    console.error(
      "[agents/create] PRIVY_AUTHORIZATION_KEY_ID is not set; agents would be un-signable",
    );
    return apiError("server_error");
  }

  try {
    const wallet = await privy.walletApi.createWallet({
      chainType: "solana",
      owner: { userId: privyUserId },
      additionalSigners: [{ signerId: env.PRIVY_AUTHORIZATION_KEY_ID }],
    });
    return { id: wallet.id, address: wallet.address };
  } catch (err) {
    console.error("[agents/create] privy createWallet", err);
    return apiError("server_error");
  }
}

async function insertAgentRows(input: {
  user: User;
  name: string;
  wallet: { id: string; address: string };
  capInrPaise: bigint;
  capUsdg: bigint;
  apiKeyHash: string;
}): Promise<Agent> {
  // We use db.batch (not db.transaction) because our driver is neon-http,
  // which does not implement transaction() — it throws at runtime. batch()
  // is supported and hits Neon's atomic /sql/transaction endpoint, so all
  // three inserts commit together or none do.
  //
  // Pre-generating the agent id keeps the child inserts independent of the
  // parent's RETURNING — batch doesn't let us await a query's result and
  // then build the next, so every row needs its keys known up front.
  const agentId = crypto.randomUUID();

  const [inserted] = await db.batch([
    db
      .insert(agents)
      .values({
        id: agentId,
        userId: input.user.id,
        name: input.name,
        privyWalletId: input.wallet.id,
        publicKey: input.wallet.address,
      })
      .returning(),
    db.insert(budgets).values({
      agentId,
      capInr: input.capInrPaise,
      capUsdg: input.capUsdg,
    }),
    db.insert(agentApiKeys).values({
      agentId,
      keyHash: input.apiKeyHash,
      label: "Initial key",
    }),
  ]);

  const agent = inserted[0];
  if (!agent) throw new Error("agents insert returned no rows");
  return agent;
}
