import {
  verifyShippingInvoice,
  topupAmount,
} from "../_shared/shipping-topup-contract.ts";
import { reconcileShippingTopup } from "../_shared/shipping-topup-reconcile.ts";
import { StreamProvider } from "../_shared/stream-provider.ts";
const id = (n: number) =>
  `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const checkout = {
  id: id(1),
  store_id: id(2),
  environment: "sandbox",
  state: "READY",
  payment_link_id: id(3),
  consumer_id: id(4),
  product_id: id(5),
  amount_halalas: 10000,
};
const link = {
  id: id(3),
  currency: "SAR",
  organization_consumer_id: id(4),
  amount: "100.000",
  max_number_of_payments: 1,
  items: [{ product_id: id(5), quantity: 1 }],
};
const invoice = {
  id: id(6),
  payment_link_id: id(3),
  organization_consumer_id: id(4),
  currency: "SAR",
  total_amount: "100.000",
  total_refunded: "0",
  status: "COMPLETED",
  items: [{ product_id: id(5), quantity: 1 }],
  payments: [
    {
      id: id(7),
      current_status: "SUCCEEDED",
      payment_method: "VISA",
      currency: "SAR",
      amount: "100.000",
    },
  ],
};
function assert(v: unknown): asserts v {
  if (!v) throw Error("Assertion failed");
}
function rejects(work: () => unknown) {
  let caught = false;
  try {
    work();
  } catch {
    caught = true;
  }
  assert(caught);
}
Deno.test(
  "shipping amount boundaries use integer halalas without implicit conversion",
  () => {
    assert(topupAmount(10000) === 10000);
    for (const value of [0, 99, 10000001, 1.1, "100", null, NaN])
      rejects(() => topupAmount(value));
  },
);
Deno.test(
  "shipping payment validates exact invoice, product, consumer, link and settled amount",
  () => {
    assert(verifyShippingInvoice(checkout, invoice, link).refunded === 0);
    for (const bad of [
      { ...invoice, status: "SENT" },
      { ...invoice, total_amount: "99.00" },
      { ...invoice, currency: "USD" },
      { ...invoice, payment_link_id: id(8) },
      { ...invoice, organization_consumer_id: id(8) },
      { ...invoice, subscription: { id: id(8) } },
      { ...invoice, items: [{ product_id: id(8), quantity: 1 }] },
      {
        ...invoice,
        payments: [{ ...invoice.payments[0], current_status: "PENDING" }],
      },
      {
        ...invoice,
        payments: [{ ...invoice.payments[0], payment_method: "BANK_TRANSFER" }],
      },
    ])
      rejects(() => verifyShippingInvoice(checkout, bad, link));
    for (const bad of [
      { ...link, amount: "101" },
      { ...link, max_number_of_payments: null },
      { ...link, items: [{ product_id: id(5), quantity: 2 }] },
    ])
      rejects(() => verifyShippingInvoice(checkout, invoice, bad));
  },
);
Deno.test(
  "duplicated payment identities do not prove fully settled wallet funds",
  () => {
    rejects(() =>
      verifyShippingInvoice(
        checkout,
        {
          ...invoice,
          payments: [
            { ...invoice.payments[0], amount: "50" },
            { ...invoice.payments[0], amount: "50" },
          ],
        },
        link,
      ),
    );
  },
);
Deno.test(
  "shipping reconciliation never credits a live, unknown or mismatched invoice",
  async () => {
    let calls = 0;
    const admin = {
      rpc: async () => {
        calls++;
        return { data: null, error: null };
      },
    };
    assert(
      !(await reconcileShippingTopup(
        admin,
        new StreamProvider("test"),
        "live",
        invoice,
      )),
    );
    assert(calls === 0);
    assert(
      !(await reconcileShippingTopup(
        admin,
        new StreamProvider("test"),
        "sandbox",
        invoice,
      )),
    );
    assert(Number(calls) === 1);
  },
);
Deno.test(
  "shipping reconciliation applies credit only after authoritative reads and atomic matching",
  async () => {
    const old = fetch;
    const calls: string[] = [];
    globalThis.fetch = async (url) => {
      assert(
        String(url) ===
          `https://stream-app-service.streampay.sa/api/v2/payment_links/${id(3)}`,
      );
      return new Response(JSON.stringify(link));
    };
    const admin = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push(name);
        if (name === "shipping_topup_by_link")
          return { data: checkout, error: null };
        assert(
          name === "shipping_topup_complete" &&
            args.p_invoice === id(6) &&
            args.p_amount === 10000,
        );
        return { data: true, error: null };
      },
    };
    try {
      assert(
        await reconcileShippingTopup(
          admin,
          new StreamProvider("test"),
          "sandbox",
          invoice,
        ),
      );
      assert(
        calls.join(",") === "shipping_topup_by_link,shipping_topup_complete",
      );
    } finally {
      globalThis.fetch = old;
    }
  },
);
Deno.test(
  "provider refunds hold previously credited funds for review rather than crediting again",
  async () => {
    const old = fetch;
    let held = false,
      credited = false;
    globalThis.fetch = async () => new Response(JSON.stringify(link));
    const admin = {
      rpc: async (name: string) => {
        if (name === "shipping_topup_by_link")
          return { data: { ...checkout, state: "PAID" }, error: null };
        if (name === "shipping_topup_refund_review") held = true;
        if (name === "shipping_topup_complete") credited = true;
        return { data: true, error: null };
      },
    };
    try {
      assert(
        await reconcileShippingTopup(
          admin,
          new StreamProvider("test"),
          "sandbox",
          { ...invoice, total_refunded: "50.00" },
        ),
      );
      assert(held && !credited);
    } finally {
      globalThis.fetch = old;
    }
  },
);

Deno.test(
  "payment-level refunds prevent credit while invoice totals catch up",
  () => {
    assert(
      verifyShippingInvoice(
        checkout,
        {
          ...invoice,
          payments: [
            {
              ...invoice.payments[0],
              current_status: "PARTIALLY_REFUNDED",
              amount_refunded: "25.00",
            },
          ],
        },
        link,
      ).refunded === 2500,
    );
    rejects(() =>
      verifyShippingInvoice(
        checkout,
        { ...invoice, total_refunded: "101.00" },
        link,
      ),
    );
  },
);
