import { isPublicEntry, publicActions, publicReply } from "../_shared/whatsapp-public.ts";
import { handleMessage } from "../_shared/whatsapp-journey.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value { if (!value) throw new Error(message); }
Deno.test("public visitors can explore, compare plans, join and find order help in both languages", () => {
  for (const language of ["ar", "en"] as const) {
    for (const action of ["menu", "explore", "pricing", "start", "order", "team", "knowledge"]) {
      const reply = publicReply(`public_${action}_${language}`);
      assert(reply.language === language);
      assert(reply.buttons.length > 0 && reply.buttons.length <= 3);
      assert(reply.body.length <= 1024);
      for (const button of reply.buttons) { assert(button.title.length <= 20); assert(isPublicEntry(button.id)); }
    }
  }
  assert(publicReply("reload").language === undefined);
  assert(publicReply("reload", "en").language === undefined);
  assert(publicReply("English", "ar").language === "en");
  assert(publicReply("عربي", "en").language === "ar");
});
Deno.test("ordinary questions get factual public replies without inventing checkout or a live handoff", () => {
  assert(publicReply("how much is it?", "en").body.includes("1,430.40"));
  assert(publicReply("بكم الاشتراك؟", "ar").body.includes("2,870.40"));
  assert(publicReply("i run an online store, what can reload do?", "en").body.includes("approved"));
  assert(publicReply("عندي متجر وش يسوي ريلود؟", "ar").body.includes("تعتمد"));
  assert(publicReply("where is my order?", "en").body.includes("store code"));
  assert(publicReply("ابي اتواصل مع فريقكم", "ar").body.includes("info@reload.sa"));
  assert(publicReply("how do i sign up?", "en").body.includes("/auth"));
  assert(publicReply("public_team_en").body.includes("https://www.reload.sa/interest"));
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
  let processed = false;
  const calls: Array<{ path: string; body: any }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({path:url.pathname,body});
    let data: unknown = null;
    if (url.pathname.endsWith("integration_events") && init?.method === "GET") data = processed ? {id:"test-event",status:"PROCESSED"} : null;
    else if (url.pathname.endsWith("integration_events") && init?.method === "PATCH" && body.status === "PROCESSED") processed = true;
    else if (url.pathname.endsWith("whatsapp_route_code")) { assert(body.p_code === (body.p_sender === "966500000001" ? null : body.p_sender === "966500000003" ? "RL-AB12CD34EF" : "INVALID")); data = null; }
    else if (url.pathname.endsWith("whatsapp_public_language")) data = "en";
    else if (url.pathname.endsWith("mark_whatsapp_send_started")) data = true;
    else if (url.hostname === "graph.facebook.com") data = { messaging_product:"whatsapp", messages:[{id:"out-test"}] };
    else assert(url.pathname.endsWith("integration_events") || url.pathname.endsWith("save_whatsapp_reply"), `Unexpected access: ${url.pathname}`);
    return new Response(JSON.stringify(data), {headers:{"Content-Type":"application/json"}});
  };
  try {
    await handleMessage("12345", {id:"public-test",from:"966500000000",type:"text",text:{body:"reload"}});
    const sent = calls.find(call=>call.path.endsWith("/messages"));
    assert(sent?.body.interactive.action.buttons[0].reply.title === "العربية");
    assert(calls.some(call=>call.path.endsWith("save_whatsapp_reply") && call.body.p_reply.storeId === null));
    assert(!calls.some(call=>call.path.endsWith("whatsapp_public_language") && call.body.p_language), "Showing the language picker must not save a guessed language");
    assert(!calls.some(call=>/billing|stores|contacts|ollama|catalog/.test(call.path)));
    await handleMessage("12345", {id:"public-test",from:"966500000000",type:"text",text:{body:"reload"}});
    assert(calls.filter(call=>call.path.endsWith("/messages")).length === 1, "A duplicate inbound id must not send twice");
    calls.length = 0;
    processed = false;
    await handleMessage("12345", {id:"public-question",from:"966500000001",type:"text",text:{body:"how much is it?"}});
    const price = calls.find(call=>call.path.endsWith("/messages"));
    assert(price?.body.interactive.body.text.includes("SAR 149"));
    assert(!calls.some(call=>/billing|stores|contacts|ollama|catalog/.test(call.path)));
    for (const [sender, body] of [["966500000002", "RL-bad"], ["966500000003", "RL-AB12CD34EF"]]) {
      processed = false; calls.length = 0;
      await handleMessage("12345", {id:`route-${sender}`,from:sender,type:"text",text:{body}});
      assert(calls.find(call=>call.path.endsWith("/messages"))?.body.interactive.body.text.includes("couldn’t open"));
      assert(!calls.some(call=>/billing|stores|contacts|ollama|catalog/.test(call.path)));
    }
    processed = false; calls.length = 0;
    await handleMessage("12345", {id:"public-recovery",from:"966500000000",type:"text",text:{body:"reload"}}, undefined, {
      plan: {kind:"text",to:"966500000000",body:"Saved public reply"}, storeId:null, conversationId:null,
    }, {messaging_product:"whatsapp",messages:[{id:"already-accepted"}]});
    assert(!calls.some(call=>call.path.endsWith("/messages")), "Accepted receipt recovery must not resend");
    assert(!calls.some(call=>call.path.endsWith("whatsapp_route_code")), "Recovery must not recompute routing");
  } finally { globalThis.fetch = original; }
});

Deno.test("language selection comes first and does not silently change on mixed-language questions", () => {
  const initial = publicReply("hello");
  assert(initial.language === undefined && initial.buttons[0].title === "العربية");
  assert(publicReply("English!").language === "en");
  assert(publicReply("can you reply in English please?", "ar").language === "en");
  assert(publicReply("بالعربي لو سمحت", "en").language === "ar");
  assert(publicReply("عربي؟").language === "ar");
  assert(publicReply("how much is it?", "ar").language === "ar");
  assert(publicReply("بكم الاشتراك؟", "en").language === "en");
  assert(publicReply("language", "en").language === undefined);
  assert(publicReply("اللغة", "ar").language === undefined);
  assert(publicReply("public_change_language", "en").buttons.length === 2);
  assert(publicReply("hello", null, true).body.includes("نفتح رابط المتجر"));
});
Deno.test("navigation is explicit and unsupported questions do not pretend to be answered", () => {
  for (const language of ["ar", "en"] as const) {
    const home = publicReply(`public_menu_${language}`);
    assert(home.buttons.some(b=>b.id === `public_start_${language}`));
    for (const topic of ["explore", "pricing", "start", "order", "team"]) {
      assert(publicReply(`public_${topic}_${language}`).buttons.some(b=>b.id===`public_menu_${language}`));
    }
  }
  assert(publicReply("back", "en").buttons[0].id === "public_explore_en");
  assert(publicReply("رجوع", "ar").buttons[0].id === "public_explore_ar");
  assert(publicReply("what is tomorrow's weather?", "en").body.includes("question is different"));
  assert(publicReply("public_explore_en").body.includes("stores and customers"));
  assert(!publicReply("public_explore_en").body.includes("your store"));
  assert(publicReply("language_en", "en").body.includes("store code"));
  assert(publicReply("i run a store", "en").body.includes("/auth"));
});

Deno.test("learning explanations preserve merchant approval and do not promise self-training", () => {
  const english = publicReply("how does your AI agent learn about my store?", "en");
  const arabic = publicReply("كيف يتعلم المساعد معلومات متجري؟", "ar");
  assert(english.body.includes("after you approve"));
  assert(english.body.includes("don’t automatically change"));
  assert(arabic.body.includes("بعد اعتمادك"));
  assert(arabic.body.includes("ما تغيّر"));
  assert(publicReply("i want to learn more", "en").body.includes("stores and customers"));
  assert(!english.body.includes("info@reload.sa"));
});
