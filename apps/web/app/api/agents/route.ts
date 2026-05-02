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

const AGENTS_PER_USER_LIMIT = 50;

const CreateAgentBody = z.object({
  name: z.string().trim().min(1).max(60),
  monthlyCapInr: z.number().int().positive().max(1_000_000),
});

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

  // Pre-generate the agent UUID so eta_address derivation is deterministic before any I/O.
  const agentId = crypto.randomUUID();
  const etaAddress = deriveAgentEtaAddress(agentId);
  console.info(
    `[agents/create] user=${user.id} agent=${agentId} ` +
      `eta=${etaAddress.slice(0, 6)}… → setting up Umbra account`,
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
      `[agents/create] ✓ agent=${agentId} eta=${etaAddress.slice(0, 6)}… created`,
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

async function createAgentWallet(input: {
  agentId: string;
  etaAddress: string;
}): Promise<{ etaAddress: string; umbraRegisteredAt: Date } | Response> {
  try {
    await fundSubjectAddressIfNeeded(input.etaAddress);
    // Eager-register on Umbra so the recipient-pre-reg gotcha never bites later deposits/transfers.
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
  // db.batch (NOT db.transaction) — neon-http does not implement transaction()
  // and throws at runtime; batch() hits Neon's atomic /sql/transaction endpoint.
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
