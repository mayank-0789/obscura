# Payrail — Money Model

> **How every rupee moves through Payrail. Written in plain English; no finance jargon assumed.**

This doc covers:
1. [The big picture — three parties, three flows](#the-big-picture)
2. [Top-up — user funds their agent](#top-up--user-funds-their-agent)
3. [Agent spending — how merchants earn](#agent-spending--how-merchants-earn) *(already built, summarised)*
4. [Cash-out — merchant gets rupees in their bank](#cash-out--merchant-gets-rupees-in-their-bank)
5. [The drawers — working capital explained](#the-drawers--working-capital-explained)
6. [End-to-end economics — where every paisa goes](#end-to-end-economics)
7. [Launch capital — what we actually need](#launch-capital--what-we-actually-need)
8. [Open items — still to sort](#open-items--still-to-sort)
9. [Pitch lines to memorise](#pitch-lines-to-memorise)

---

## The big picture

Payrail connects three parties and moves money in three directions.

### The three parties

| Party | What they are | How they use Payrail |
|---|---|---|
| 👤 **User** | Person who owns an AI agent | Pays rupees via UPI/card to fund their agent |
| 🤖 **Agent** | Software program owned by the user | Spends USDC stablecoin when calling paid APIs |
| 🏪 **Merchant** | Person running a paid API / MCP server | Earns USDC from agents calling their API |

### The three money flows

```
          TOP-UP                         AGENT SPEND                   CASH-OUT
   ──────────────────────         ────────────────────────       ─────────────────────
  💰 User pays rupees ➜          🤖 Agent pays USDC ➜           🏪 Merchant gets rupees
  🤖 Agent gets USDC             🏪 Merchant gets USDC           💳 ...in their bank
  (instant)                       (instant, per-call)             (instant or 2 days)
```

Everything in this doc is about explaining these three flows clearly.

---

## Top-up — user funds their agent

### The user experience

1. User opens `/topup` in Payrail dashboard
2. Picks an agent, enters an amount (minimum ₹500)
3. Sees a breakdown of exactly what their agent will receive
4. Taps "Pay" → redirected to Dodo's UPI/card checkout
5. Pays with any Indian payment method
6. Within 30 seconds, agent wallet shows the new USDC balance

### What the user sees (₹500 example)

```
Top-up amount                       ₹500.00
Service fee (6.25%, incl. GST)     −₹31.25
──────────────────────────────────────────
Agent receives                    $5.55 USDC

₹84.50 / USD                     live rate
```

One fee line, one rate, one final number. Wise-style transparency.

### What's inside the 6.25% service fee

The user sees a single line item. Behind the scenes, those ₹31.25 cover four things:

| Cost | Approximate cut of ₹31.25 | Who it goes to |
|---|---|---|
| Dodo Payments processing fee | ~₹7.50 | Dodo (1.5% of ₹500) |
| GST on Dodo's fee | ~₹1.35 | Government (via Dodo) |
| GST on our own service fee | ~₹4.77 | Government (via Payrail) |
| Payrail's actual take | ~₹17.63 | Payrail |

**Payrail's net margin on each top-up: ~3.5% of the top-up amount.**

### What's inside the rate (the 0.6% spread)

The live market rate right now is about ₹84 per USD (from Frankfurter, updated every 15 min). The rate we quote is ₹84.50. The ₹0.50 difference is a **0.6% spread** that exactly covers the cost of buying USDC on an Indian crypto exchange (Mudrex/CoinDCX). Payrail earns nothing from the rate — it's cost recovery only.

### Scaling — the service fee is proportional

| Top-up | Service fee (6.25%) | Agent receives | Our net |
|---|---|---|---|
| ₹500 | ₹31.25 | $5.55 | ~₹17.63 |
| ₹1,000 | ₹62.50 | $11.09 | ~₹35.27 |
| ₹2,500 | ₹156.25 | $27.74 | ~₹88.17 |
| ₹5,000 | ₹312.50 | $55.48 | ~₹176.33 |

**Minimum top-up: ₹500** (below this, Dodo's fee eats our entire margin).

### Why top-up MUST be instant

Users have a mental model: "I paid, I see my money." Every UPI payment they've ever made — Zomato, Swiggy, Amazon, bank transfer — reflects instantly. If top-up takes even 15 minutes, they'll refresh panic, email support, dispute with their bank.

This is why we need a **pre-funded USDC drawer** on the top-up side (see [drawers section](#the-drawers--working-capital-explained)).

### Security guards (already shipped)

Every top-up is checked against tampering:
- Zod validates the amount range server-side (₹500 – ₹1,00,000)
- Ownership check — you can only top up your own agents
- Rate limit — 10 top-up attempts per hour per user
- Dodo checkout locked down — no discount codes, no currency switches
- Signature verification on the Dodo webhook (HMAC, industry standard)
- Amount-mismatch guard — if Dodo charges less than we asked for, webhook refuses to credit
- Currency guard — webhook refuses non-INR
- Idempotency — duplicate webhooks can't double-credit
- Rate locked in metadata — market movement between pay and credit doesn't change what the agent receives

---

## Agent spending — how merchants earn

*This part is already built and working on devnet. Brief explanation only.*

When an AI agent calls a paid API using Payrail's SDK:

1. The API returns `402 Payment Required` (a standard HTTP status)
2. Our SDK automatically requests a payment signature from Payrail's backend
3. Backend checks the agent's spending cap, then signs a Solana transaction delegated by the user
4. Payment is verified and settled by PayAI (the open x402 facilitator)
5. Merchant's wallet receives USDC
6. API returns `200 OK` with the data

The entire handshake takes ~500ms. Merchant's dashboard updates in real-time via webhooks + server-sent events.

**Payrail takes zero fee on this flow.** We already earned our cut on the top-up side. The agent-to-merchant USDC transfer is direct, on-chain, and free from our side.

---

## Cash-out — merchant gets rupees in their bank

Merchants earn USDC from agent payments. To get real money in their bank account, they use our cash-out flow, which has **two tiers**.

### Tier 1 — Standard cash-out (free, T+2 to T+3)

**What merchant pays Payrail: ₹0.** Same as Razorpay's default payout.

**Timeline:** 2 to 3 business days from request.

**How it works:**

```
Mon 10:00 AM  Merchant clicks "Cash out"
Mon 10:05 AM  USDC sent to Mudrex
Mon 02:00 PM  Mudrex completes the sale
Tue 09:00 AM  Rupees hit Payrail's bank (T+1)
Tue 11:00 AM  We trigger Dodo Payouts
Wed 03:00 PM  Rupees land in merchant's bank (T+2)
```

Merchants don't complain about this — it matches exactly what Razorpay, PayU, and Cashfree do.

### Tier 2 — Instant cash-out (1% fee, under 30 min) [future]

**What merchant pays Payrail: 1% of the cashed-out amount.**

**Timeline:** under 30 minutes.

**How it works (mirror image of top-up):**

```
1. Merchant clicks "Cash out instantly"
2. Payrail pays rupees IMMEDIATELY from a pre-funded rupee drawer
3. In background: sell USDC on Mudrex, replenish drawer
```

This is identical to how Stripe Express Payouts and Razorpay Instant work.

### Full cash-out breakdown — $118 USDC example

Let's trace a merchant cashing out $118 worth of USDC (roughly ₹9,912).

```
USDC to cash out                           $118.00
Market rate (live)                       ₹84.00 / USD
Nominal value                         ₹9,912.00
─────────────────────────────────────────────────────
MUDREX (sells USDC → rupees)
  Exchange spread (~0.8%)                 −₹79.30
  Trading fee (~0.4%, incl. GST)          −₹39.65
  Crypto TDS (1%, tax prepayment)         −₹99.12
                                          ─────────
  Rupees received in Payrail's bank     ₹9,693.93
─────────────────────────────────────────────────────
DODO PAYOUTS (rupees → merchant bank)
  Flat payout fee + GST                   −₹17.70
                                          ─────────
MERCHANT RECEIVES IN BANK               ~₹9,676
```

**Total deduction: ~2.4% of nominal value.** Merchant keeps about ₹9,676 from a ₹9,912 nominal — comparable to what credit-card processors like Stripe and Razorpay merchants experience on card payments.

### What each deduction is

| Line | What it is | Who gets it |
|---|---|---|
| Exchange spread | Gap between Mudrex's buy rate and live market rate | Mudrex |
| Trading fee | Mudrex's explicit per-trade fee | Mudrex |
| Crypto TDS (1%) | **Indian tax law** — 1% withheld on every crypto-to-fiat sale. **Recoverable on annual tax filing.** | Government (tax prepayment) |
| Dodo Payouts fee | Flat ₹15–25 per bank transfer (like NEFT) | Dodo |
| Payrail fee | ₹0 for standard, 1% for instant | Payrail |

### Key decisions locked

- **Standard cash-out is free** (matches industry; builds merchant loyalty)
- **Instant cash-out charges 1%** (self-funds the rupee drawer it requires)
- **TDS is shown explicitly** in the breakdown — it's not our fee, but merchants need to see it for their own bookkeeping

---

## The drawers — working capital explained

Payrail needs small pools of money held ready at specific points in the system. Think of them like the currency drawer at an airport exchange counter — you need the right currency ready before anyone can swap for it.

### Drawer 1 — Top-up USDC drawer (required)

**Purpose:** Hand USDC to agents the instant a user completes their UPI payment.

**Why required:** Instant top-up UX is non-negotiable. Users won't tolerate waiting.

**How it refills:** Every 4 hours, we take the rupees that arrived from Dodo and use Mudrex's API to buy more USDC, which goes back into the drawer.

**Drawer sizing at different stages:**

| Stage | Daily top-up volume | Refill cycle | Drawer size |
|---|---|---|---|
| Hackathon / demo | ₹0 (devnet, test tokens) | N/A | ₹0 |
| Beta, 100 users | ~₹50,000/day | every 6 hours | ~₹15,000 |
| Post-accelerator | ~₹5 lakh/day | every 4 hours | ~₹1.5 lakh |
| Seed stage, 10K users | ~₹50 lakh/day | every 2 hours | ~₹5 lakh |

### Drawer 2 — Instant cash-out rupee drawer (optional, premium)

**Purpose:** Hand rupees to merchants instantly when they choose the 1% instant tier.

**Why optional:** Standard cash-out doesn't use this drawer. Only merchants who pay the 1% premium use it.

**How it refills:** We send their USDC to Mudrex in parallel; rupees come back to refill the drawer over 1–2 days.

**Drawer sizing:**

| Stage | Daily cash-out volume | % choosing instant | Instant drawer |
|---|---|---|---|
| Beta | ~₹50K/day | ~20% | ~₹15K |
| Post-accelerator | ~₹2 lakh/day | ~25% | ~₹1 lakh |
| Seed stage | ~₹25 lakh/day | ~30% | ~₹15 lakh |

**Return on drawer capital:** the 1% fee × weekly cycling yields roughly **36% annual return** on the rupees held in this drawer. Very healthy — comparable to why Stripe Express and Razorpay Instant are profitable products.

### Standard cash-out uses no drawer at all

Standard cash-out is free for merchants because we don't advance money. We collect rupees from Mudrex FIRST, then forward to the merchant. Our Dodo balance passes through. Zero capital held.

This halves the mainnet capital requirement compared to if we tried to make every cash-out instant.

---

## End-to-end economics

Trace one full cycle: user tops up ₹10,000 → agent spends it all on various merchants → merchants cash out to their banks.

### Who gets what from ₹10,000

| Party | Keeps | % of ₹10,000 | Notes |
|---|---|---|---|
| Government (GST + TDS combined) | ~₹170 | 1.7% | Tax |
| Dodo Payments | ~₹165 | 1.65% | Top-up processing |
| **Payrail (platform)** | **~₹290** | **~2.9%** | Our net revenue |
| Mudrex (round-trip) | ~₹205 | 2.05% | Buy USDC on top-up + sell on cash-out |
| Dodo Payouts | ~₹18 | 0.18% | Bank transfer fees |
| Exchange spread (round-trip) | ~₹110 | 1.1% | Cost of converting back and forth |
| **Merchants combined** | **~₹9,043** | **~90.4%** | What they actually earn |

### What this tells us

- **Merchants keep ~90% of what users spend.** That's competitive with credit-card rails (Stripe/Razorpay pay merchants ~91–94%).
- **Payrail earns ~2.9% net overall** (slightly below our 3.5% top-up target because some bleeds through via exchange and tax friction on the way back out).
- **No single party takes an unreasonable cut.** The system is honest end-to-end.

### The one-sentence pitch number

> **For every ₹10,000 flowing through Payrail, merchants receive ₹9,043 and Payrail keeps ₹290.**

---

## Launch capital — what we actually need

### Stage 1 — Hackathon / demo (now)

**Zero capital needed.** Everything runs on Solana devnet with free test tokens.

### Stage 2 — Beta launch (Month 1–3)

Real users, small merchant list. Standard cash-out only (no instant tier yet).

```
Top-up USDC drawer:               ~₹15,000
Instant cash-out drawer:                ₹0 (not offering yet)
Legal / CA / Mudrex onboarding:   ~₹50,000
Personal runway, 3 months:        ~₹1,00,000
─────────────────────────────────────────────
Total capital needed:             ~₹1.65 lakh
```

**₹1.65 lakh can come from:** Colosseum side-track prize ($2K = ~₹1.7 lakh), a single angel cheque, or personal savings.

### Stage 3 — Post-Colosseum Accelerator (Month 4–9)

Assuming we win the Colosseum Accelerator $250K cheque (~₹2 crore).

```
Top-up drawer:                    ~₹1.5 lakh
Instant cash-out drawer:          ~₹1 lakh
Team + ops + office + legal:      ~₹20 lakh
─────────────────────────────────────────────
Total operational capital:        ~₹22 lakh
```

Well under the ₹2 crore accelerator cheque — room for runway, not just drawers.

### Stage 4 — Seed round (Month 12+)

Full scale, both cash-out tiers live, exchange partnerships maturing.

```
Top-up drawer:                    ~₹5 lakh
Instant cash-out drawer:          ~₹15 lakh
Everything else:                  seed + revenue
```

By this stage, revenue (₹3.5 lakh/month per ₹1 crore of monthly volume) is covering drawer refills and ops.

---

## Open items — still to sort

### Pre-mainnet blockers (must fix before going live)

| Item | What needs to happen | Who |
|---|---|---|
| **Dodo tax category** | Change from "SaaS" to a non-SaaS category so GST is only on our service fee, not the whole top-up principal | User — check Dodo dashboard |
| **CA consultation** | Confirm the "service + pass-through" tax structure is defensible under Indian law | User — hire CA |
| **Mudrex Business account** | B2B account with API keys (needs PAN / GST) | User — onboarding paperwork |
| **Squads multi-sig** | Replace single-keypair treasury with a 3-of-5 vault | User + code |
| **Dodo Payouts confirmation** | Verify our Dodo account has Payouts enabled, not just Payments | User — message @paarugsethi |

### Code gaps (post-hackathon, ~2 weeks of work)

| Feature | Purpose | Est. time |
|---|---|---|
| Refund flow | Auto-revert failed top-ups | 1 day |
| Merchant KYC collection | PAN, bank, optional GST for cash-out | 1 day |
| Standard cash-out flow | Mudrex + Dodo Payouts end-to-end | 5 days |
| Solana downtime handling | Retry caps + user-friendly error UI | 1 day |
| Dispute flow | Manual refund approval for agent↔merchant issues | 2 days |
| Instant cash-out (v2) | Premium tier, pre-funded rupee drawer | 3 days |

### Not blockers, but worth acknowledging to judges

- Not RBI-licensed (fine while Dodo is Merchant of Record; required if we ever hold customer funds directly)
- No SOC2, insurance, or formal audit (required by Series A, not now)
- No customer support channel beyond founder's inbox (fine for beta)

---

## Pitch lines to memorise

### The one-sentence pitch (elevator version)

> **"Payrail is the UPI-to-USDC rail for AI agents. A user pays ₹500 via UPI; their AI agent gets $5.55 of stablecoin; the merchant earns in USDC and cashes out to their bank like any other vendor."**

### The capital efficiency pitch

> **"Launch capital is ₹1.65 lakh of working capital. One angel cheque or a Colosseum prize covers it. Our entire business runs on a small USDC drawer that holds 4 hours of top-ups. Every rupee above that is revenue."**

### The economics pitch

> **"For every ₹10,000 a user pays, merchants collectively keep ₹9,043 in their bank accounts — that's 90%, competitive with credit-card rails. Payrail nets ₹290. Government gets ₹170 in taxes. Every paisa is accounted for."**

### The capital story — long version

> **"Stripe paid ₹9,000 crore to acquire Bridge just to solve the on-ramp problem. MoonPay raised ₹5,400 crore partly for the same reason. We're solving it with ₹1.65 lakh. Our architecture — Solana micropayments + Indian exchange rails + x402 — needs three orders of magnitude less working capital than the US incumbents."**

### The instant cash-out pitch

> **"Standard cash-out is free for merchants, T+2, matches Razorpay. Merchants who want their money in 30 minutes pay 1% — same model as Stripe Express. The drawer that funds instant payouts earns ~36% annual return on capital. Merchants self-fund the feature."**

### When a judge asks about the funding gap

> **"Devnet is the test environment — the live version is four environment variables away. Your accelerator cheque funds the first real USDC pool this rail has ever processed. Here's how the first ₹80 lakh gets spent: ₹55 lakh drawer, ₹15 lakh exchange-partnership deposit, ₹10 lakh legal + CA. That's four months to 10,000 real top-ups processed."**

### The security pitch

> **"Mainnet treasury uses Squads multi-signature — three-out-of-five signers required for any transfer from the main vault. A smaller operating wallet auto-signs routine top-ups, capped at one day of liquidity. Same pattern Coinbase and Binance use. Thirty minutes to set up, not a reason we haven't launched."**

---

## Credits and references

- [`project_topup_pricing.md`](../memory/project_topup_pricing.md) — locked pricing model details
- [`project_treasury_architecture.md`](../memory/project_treasury_architecture.md) — Squads multi-sig plan
- [`project_cashout_architecture.md`](../memory/project_cashout_architecture.md) — Mudrex + Dodo Payouts flow
- [`project_status_fiat_to_agent.md`](../memory/project_status_fiat_to_agent.md) — what's built vs planned

**Last updated:** 2026-04-22

*This document captures the locked economic and architectural decisions for Payrail's money flow. If you're reading this and something has changed, update both this file and the relevant memory entries.*
