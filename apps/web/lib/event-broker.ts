import "server-only";

// In-process pub/sub broker used to fan out real-time payment events from the
// Helius webhook handler to any SSE streams currently subscribed to a given
// merchant's ETA address.
//
// ⚠ Single-instance only. In a multi-replica deployment (horizontal scaling
// across Vercel regions / multiple Node pods), the webhook lands on instance
// A while an SSE client is connected to instance B — the event is lost.
// For single-instance deployments this is fine. Multi-replica production
// would swap to Redis Pub/Sub or similar without changing the call sites.

export type MerchantPaymentEvent = {
  kind: "payment";
  transactionId: string;
  amountUsdg: string;
  counterparty: string;
  merchantHost: string | null;
  solanaSig: string;
  createdAt: string;
  confirmedAt: string;
};

export type BrokerEvent = MerchantPaymentEvent;

type Subscriber = (event: BrokerEvent) => void;

class EventBroker {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  subscribe(topic: string, fn: Subscriber): () => void {
    let set = this.subscribers.get(topic);
    if (!set) {
      set = new Set<Subscriber>();
      this.subscribers.set(topic, set);
    }
    set.add(fn);
    return () => {
      const s = this.subscribers.get(topic);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.subscribers.delete(topic);
    };
  }

  publish(topic: string, event: BrokerEvent): void {
    const set = this.subscribers.get(topic);
    if (!set) return;
    // Snapshot the subscriber set before iterating — a subscriber may
    // unsubscribe itself during dispatch (e.g. on client disconnect).
    for (const fn of [...set]) {
      try {
        fn(event);
      } catch (err) {
        console.error("[event-broker] subscriber threw:", err);
      }
    }
  }
}

// HMR-safe singleton. Next.js rebuilds modules on every hot reload in dev,
// which would otherwise orphan active SSE subscriptions. Attaching to
// globalThis preserves the broker across reloads.
const GLOBAL_KEY = "__obscura_event_broker__";
type GlobalWithBroker = { [GLOBAL_KEY]?: EventBroker };
const g = globalThis as unknown as GlobalWithBroker;
export const eventBroker: EventBroker = g[GLOBAL_KEY] ?? (g[GLOBAL_KEY] = new EventBroker());

export function merchantPaymentTopic(etaAddress: string): string {
  return `merchant:${etaAddress}:payment`;
}
