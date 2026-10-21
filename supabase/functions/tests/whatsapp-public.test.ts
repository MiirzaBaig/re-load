import { isPublicEntry, publicActions, publicReply } from "../_shared/whatsapp-public.ts";
import { handleMessage } from "../_shared/whatsapp-journey.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value { if (!value) throw new Error(message); }
Deno.test("public visitors can explore, compare plans, join and find order help in both languages", () => {
  for (const language of ["ar", "en"] as const) {
    for (const action of ["menu", "explore", "pricing", "start", "order", "team"]) {
      const reply = publicReply(`public_${action}_${language}`);
      assert(reply.language === language);
      assert(reply.buttons.length > 0 && reply.buttons.length <= 3);
      assert(reply.body.length <= 1024);
      for (const button of reply.buttons) { assert(button.title.length <= 20); assert(isPublicEntry(button.id)); }
    }
  }
  assert(publicReply("reload").language === "ar");
  assert(publicReply("reload", "en").language === "en");
  assert(publicReply("English", "ar").language === "en");
  assert(publicReply("عربي", "en").language === "ar");
});
Deno.test("ordinary questions get factual public replies without inventing checkout or a live handoff", () => {
  assert(publicReply("how much is it?").body.includes("1,430.40"));
  assert(publicReply("بكم الاشتراك؟").body.includes("2,870.40"));
  assert(publicReply("i run an online store, what can reload do?").body.includes("approved"));
  assert(publicReply("عندي متجر وش يسوي ريلود؟").body.includes("تعتمد"));
  assert(publicReply("where is my order?").body.includes("store code"));
  assert(publicReply("ابي اتواصل مع فريقكم").body.includes("info@reload.sa"));
  assert(publicReply("how do i sign up?").body.includes("/auth"));
  assert(publicReply("public_team_en").body.includes("form"));
  assert(publicReply("hello", "en", true).body.includes("couldn’t open"));
  assert(!isPublicEntry("public_unknown_en"));
  assert(!isPublicEntry("return RL-1234567890"));
  assert(new Set(publicActions).size === publicActions.length);
});
Deno.test("public entry clears a previous merchant route and sends no tenant queries or AI calls", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.invalid");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-only-server");
  Deno.env.set("WHATSAPP_PHONE_NUMBER_ID", "12345");
  Deno.env.set("WHATSAPP_ACCESS_TOKEN", "test-only-meta");
  const original = globalThis.fetch;
  const calls: Array<{ path: string; body: any }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({path:url.pathname,body});
    let data: unknown = null;
    if (url.pathname.endsWith("integration_events") && init?.method === "GET") data = null;
    else if (url.pathname.endsWith("whatsapp_route_code")) { assert(body.p_code === (body.p_sender === "966500000001" ? null : "INVALID")); data = null; }
    else if (url.pathname.endsWith("whatsapp_public_language")) data = "en";
    else if (url.pathname.endsWith("mark_whatsapp_send_started")) data = true;
    else if (url.hostname === "graph.facebook.com") data = { messaging_product:"whatsapp", messages:[{id:"out-test"}] };
    else assert(url.pathname.endsWith("integration_events") || url.pathname.endsWith("save_whatsapp_reply"), `Unexpected access: ${url.pathname}`);
    return new Response(JSON.stringify(data), {headers:{"Content-Type":"application/json"}});
  };
  try {
    await handleMessage("12345", {id:"public-test",from:"966500000000",type:"text",text:{body:"reload"}});
    const sent = calls.find(call=>call.path.endsWith("/messages"));
    assert(sent?.body.interactive.body.text.includes("welcome to Reload"));
    assert(calls.some(call=>call.path.endsWith("save_whatsapp_reply") && call.body.p_reply.storeId === null));
    assert(!calls.some(call=>/billing|stores|contacts|ollama|catalog/.test(call.path)));
    calls.length = 0;
    await handleMessage("12345", {id:"public-question",from:"966500000001",type:"text",text:{body:"how much is it?"}});
    const price = calls.find(call=>call.path.endsWith("/messages"));
    assert(price?.body.interactive.body.text.includes("SAR 149"));
    assert(!calls.some(call=>/billing|stores|contacts|ollama|catalog/.test(call.path)));
  } finally { globalThis.fetch = original; }
});
