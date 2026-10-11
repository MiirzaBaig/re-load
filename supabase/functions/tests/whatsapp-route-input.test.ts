import { whatsappRouteInput } from "../_shared/whatsapp-route-input.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("routing recognises short and existing UUID links", () => {
  assert(whatsappRouteInput("return rl-ab12cd34ef") === "RL-AB12CD34EF");
  assert(
    whatsappRouteInput("return 41b7e4a9-6b94-4856-b0c0-f94f641c4897") ===
      "41B7E4A9-6B94-4856-B0C0-F94F641C4897",
  );
  assert(whatsappRouteInput("hello") === null);
});
Deno.test("invalid explicit routes never reuse the previous merchant", () => {
  for (const text of [
    "return DEMO-NOVA",
    "return",
    "return RL-bad",
    "return RL-AB12CD34EF extra",
    "return <script>",
  ])
    assert(whatsappRouteInput(text) === "INVALID");
});
