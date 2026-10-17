import {
  customerFirstName,
  merchantDisplayName,
} from "../_shared/presentation.ts";
import { processFlow } from "../_shared/whatsapp-journey.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test(
  "greetings accept real Arabic and English names but omit symbols, numbers and controls",
  () => {
    for (const value of [".", "🔥", "12345", "@someone", "<script>", ""])
      assert(customerFirstName(value) === "");
    assert(customerFirstName("أحمد محمد") === "أحمد");
    assert(customerFirstName("Ahmed Ali") === "Ahmed");
    assert(customerFirstName("Jo-Anne Smith") === "Jo-Anne");
    assert(customerFirstName("\u202eAhmed") === "Ahmed");
  },
);
Deno.test(
  "merchant presentation preserves the chosen name and falls back to the connected store",
  () => {
    assert(merchantDisplayName("Riwa", "RIWA") === "Riwa");
    assert(merchantDisplayName("My Store", "RIWA") === "RIWA");
    assert(merchantDisplayName("متجري", null) === "Reload");
  },
);
Deno.test(
  "language greeting uses the routed merchant and omits invalid customer names",
  async () => {
    const admin = {
      rpc: async (name: string) =>
        name === "billing_snapshot" ? {data:{enforcementEnabled:false}} : name === "get_whatsapp_flow_state"
          ? { data: [{ step: "AWAITING_LANGUAGE", context: {} }] }
          : { error: null },
    } as any;
    const reply = await processFlow(
      admin,
      { id: "store", name: "Riwa", return_code: "route" },
      {
        id: "conversation",
        language: "en",
        contact_id: "contact",
        return_case_id: null,
      },
      "test",
      "hello",
      ".",
    );
    assert(reply.body.includes("Riwa"));
    assert(!reply.body.includes("Hi ."));
    assert(!reply.body.includes("My Store"));
  },
);

Deno.test(
  "activity labels hide internal button IDs without rewriting normal customer messages",
  async () => {
    const { customerActionLabel } =
      await import("../../../src/lib/support-workspace.ts");
    const t = (en: string, _ar: string) => en;
    const id = "11111111-1111-4111-8111-111111111111";
    for (const value of [
      `item:${id}`,
      `track:${id}`,
      "condition:new_unopened",
      "future_button_code",
    ]) {
      const label = customerActionLabel(value, t, true);
      assert(!label.includes(id) && !label.includes(":"));
    }
    assert(
      customerActionLabel("my_item_is_missing", t) === "my_item_is_missing",
    );
    assert(!customerActionLabel(`return ${id}`, t).includes(id));
  },
);
