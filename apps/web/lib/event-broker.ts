import "server-only";

// Single-instance only. Multi-replica needs Redis Pub/Sub — webhook on A and
// SSE client on B will lose events.

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

export type DemoRunEvent = {
  kind: "demo_run";
  endpoint: string;
  amountUsdg: string;
  queueSignature: string;
  callbackSignature: string | null;
  ipShort: string;
  createdAt: string;
};

export const DEMO_RUNS_TOPIC = "demo:runs";

export type BrokerEvent = MerchantPaymentEvent | DemoRunEvent;

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
    // Snapshot — subscribers may unsubscribe during dispatch.
    for (const fn of [...set]) {
      try {
        fn(event);
      } catch (err) {
        console.error("[event-broker] subscriber threw:", err);
      }
    }
  }
}

// Attached to globalThis so HMR doesn't orphan active SSE subscriptions.
const GLOBAL_KEY = "__obscura_event_broker__";
type GlobalWithBroker = { [GLOBAL_KEY]?: EventBroker };
const g = globalThis as unknown as GlobalWithBroker;
export const eventBroker: EventBroker = g[GLOBAL_KEY] ?? (g[GLOBAL_KEY] = new EventBroker());

export function merchantPaymentTopic(etaAddress: string): string {
  return `merchant:${etaAddress}:payment`;
}
