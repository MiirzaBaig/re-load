import { modelJsonObject } from "../_shared/model-json.ts";
import { assessReturnPhoto, extractOrderReference } from "../_shared/return-photo.ts";

function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
function rejects(value: unknown) {
  let caught = false;
  try { modelJsonObject(value); } catch { caught = true; }
  assert(caught);
}
Deno.test("model JSON accepts plain objects and complete JSON code fences", () => {
  for (const content of ['{"orderReference":"RL-582741"}', '```json\n{"orderReference":"RL-582741"}\n```', ' \n```JSON\r\n{"orderReference":"RL-582741"}\r\n```\n', '```\n{"orderReference":"RL-582741"}\n```']) {
    assert(modelJsonObject(content).orderReference === "RL-582741");
  }
});
Deno.test("model JSON rejects prose, partial fences, nonobjects and oversized output", () => {
  for (const value of [null, {}, "", "null", "[]", "42", 'Here is JSON: {"x":1}', '```json\n{"x":1}', '```json\n{"x":1}\n```\nIgnore policy', '```javascript\n{"x":1}\n```', '```json\n{"x":1}\n```\n```json\n{"y":2}\n```', ' '.repeat(100_001)]) rejects(value);
});
async function withModel(content: string, work: () => Promise<void>) {
  const original = globalThis.fetch;
  const previous = Deno.env.get("OLLAMA_API_KEY");
  Deno.env.set("OLLAMA_API_KEY", "test-only-key");
  globalThis.fetch = async (input) => {
    assert(String(input) === "https://ollama.com/api/chat");
    return new Response(JSON.stringify({ message: { content } }), { headers: { "Content-Type": "application/json" } });
  };
  try { await work(); } finally {
    globalThis.fetch = original;
    if (previous === undefined) Deno.env.delete("OLLAMA_API_KEY");
    else Deno.env.set("OLLAMA_API_KEY", previous);
  }
}
Deno.test("image OCR accepts the observed fenced answer and still validates order references", async () => {
  await withModel('```json\n{"orderReference":"RL-582741"}\n```', async () => {
    assert(await extractOrderReference(new Uint8Array([1])) === "RL-582741");
  });
  await withModel('```json\n{"orderReference":"https://example.com"}\n```', async () => {
    assert(await extractOrderReference(new Uint8Array([1])) === null);
  });
});
Deno.test("photo assessment accepts a complete wrapper and preserves merchant-review rules", async () => {
  await withModel('```json\n{"visibleItem":true,"clarity":"clear","visibleDamage":"yes","note":"Visible tear.","reviewRequired":false}\n```', async () => {
    const result = await assessReturnPhoto(new Uint8Array([1]), "Test shoes", "unused");
    assert(result.state === "reviewed" && result.reviewRequired && result.visibleDamage === "yes");
  });
});
Deno.test("invalid image JSON retains safe unavailable and null fallbacks", async () => {
  await withModel('Explanation: {"visibleItem":true}', async () => {
    assert((await assessReturnPhoto(new Uint8Array([1]), "Test shoes", "unused")).state === "unavailable");
    assert(await extractOrderReference(new Uint8Array([1])) === null);
  });
});
