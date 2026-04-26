import { z } from "zod";
import { count, desc, eq } from "drizzle-orm";
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
import { quoteInrToUsdg } from "@/lib/fx";
import { generateAgentApiKey } from "@/lib/agent-keys";
import { serializeAgent } from "@/lib/agent-serialize";
import { checkLimit } from "@/lib/ratelimit";
import {
  deriveAgentEtaAddress,
  fundSubjectAddressIfNeeded,
  registerSubjectOnUmbra,
} from "@/lib/umbra";

// Hard ceiling on agents per user. Keeps a single account from ballooning the
// DB. Raise as we learn real usage patterns.
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

// POST /api/agents — create an agent end-to-end:
//   1. Derive the Umbra-side keypair from the new agent's UUID + the env-stored
//      master seed. Pure derivation, no I/O.
//   2. Lazy-fund the derived address with SOL from treasury so it can pay its
//      own Umbra registration fees (~3 txs, ~0.01 SOL). Idempotent.
//   3. Eager-register on Umbra (`confidential: true, anonymous: false`). ~3-5s
//      end-to-end. Eager (not lazy at first top-up) so the recipient-pre-reg
//      gotcha never bites: by the time anyone tries to deposit/transfer to
//      this agent, it's already a valid Umbra subject.
//   4. Atomic batch insert: agents row (with eta_address + umbra_status='active'
//      + umbra_registered_at), budgets row, first API key.
//
// Failure modes:
//   - Lazy fund fails (RPC error) → 500. Try again; idempotent.
//   - Register fails → 500. SOL has landed at the eta_address but no DB rows
//     exist yet — orphan SOL, recoverable manually if it ever matters.
//   - DB batch fails → 500. Agent registered on Umbra but no DB row.
//     Acceptable orphan at this scale; reconcile by re-running creation with
//     the same UUID (deterministic eta_address, register is idempotent).
export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const body = await parseBody(req);
  if (body instanceof Response) return body;

  const allowed = await checkLimit("create-agent", user.id, 5, "1 h");
  if (!allowed) return apiError("rate_limited");

  const [{ value: agentCount } = { value: 0 }] = await db
    .select({ value: count() })
    .from(agents)
    .where(eq(agents.userId, user.id));
  if (agentCount >= AGENTS_PER_USER_LIMIT) return apiError("agent_limit_reached");

  // Pre-generate the agent UUID so we can derive the eta_address before any
  // I/O happens. This UUID is the canonical input to the HMAC seed-derivation
  // — same agentId always produces the same eta_address, so re-running this
  // route with the same UUID would land on the same on-chain account.
  const agentId = crypto.randomUUID();
  const etaAddress = deriveAgentEtaAddress(agentId);
  console.info(
    `[agents/create] user=${user.id} agent=${agentId} ` +
      `etaAddress=${etaAddress} → setting up Umbra account`,
  );

  const wallet = await createAgentWallet({ agentId, etaAddress });
  if (wallet instanceof Response) return wallet;

  const capInrPaise = BigInt(body.monthlyCapInr) * 100n;
  const { usdg: capUsdg, rate } = await quoteInrToUsdg(capInrPaise);
  const apiKey = generateAgentApiKey();

  try {
    const agent = await insertAgentRows({
      agentId,
      user,
      name: body.name,
      etaAddress: wallet.etaAddress,
      umbraRegisteredAt: wallet.umbraRegisteredAt,
      capInrPaise,
      capUsdg,
      apiKeyHash: apiKey.hash,
    });
    console.info(
      `[agents/create] ✓ agent=${agentId} eta=${etaAddress} created`,
    );

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

// Funds the agent's derived eta_address with SOL (lazy) and registers it on
// Umbra (eager). Returns the registration timestamp for persistence; the
// caller pairs it with the eta_address into the agents row.
//
// Returns either `{ etaAddress, umbraRegisteredAt }` on success or a
// `Response` (apiError) on failure — same pattern as authGuard. Errors are
// logged with full context server-side; the client gets a generic
// `server_error` to avoid leaking SDK details.
async function createAgentWallet(input: {
  agentId: string;
  etaAddress: string;
}): Promise<{ etaAddress: string; umbraRegisteredAt: Date } | Response> {
  try {
    await fundSubjectAddressIfNeeded(input.etaAddress);
    await registerSubjectOnUmbra("agent", input.agentId);
    return { etaAddress: input.etaAddress, umbraRegisteredAt: new Date() };
  } catch (err) {
    console.error(
      `[agents/create] umbra setup failed for agent=${input.agentId}:`,
      err,
    );
    return apiError("server_error");
  }
}

async function insertAgentRows(input: {
  agentId: string;
  user: User;
  name: string;
  etaAddress: string;
  umbraRegisteredAt: Date;
  capInrPaise: bigint;
  capUsdg: bigint;
  apiKeyHash: string;
}): Promise<Agent> {
  // We use db.batch (not db.transaction) because our driver is neon-http,
  // which does not implement transaction() — it throws at runtime. batch()
  // is supported and hits Neon's atomic /sql/transaction endpoint, so all
  // three inserts commit together or none do.
  const [inserted] = await db.batch([
    db
      .insert(agents)
      .values({
        id: input.agentId,
        userId: input.user.id,
        name: input.name,
        etaAddress: input.etaAddress,
        umbraStatus: "active",
        umbraRegisteredAt: input.umbraRegisteredAt,
      })
      .returning(),
    db.insert(budgets).values({
      agentId: input.agentId,
      capInr: input.capInrPaise,
      capUsdg: input.capUsdg,
    }),
    db.insert(agentApiKeys).values({
      agentId: input.agentId,
      keyHash: input.apiKeyHash,
      label: "Initial key",
    }),
  ]);

  const agent = inserted[0];
  if (!agent) throw new Error("agents insert returned no rows");
  return agent;
}
