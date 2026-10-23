import { processFlow } from "../_shared/whatsapp-journey.ts";
import { adminClient } from "../_shared/supabase.ts";
import { encrypt } from "../_shared/crypto.ts";
import { encode } from "npm:@toon-format/toon@4.4.0";
Deno.env.set("SUPABASE_URL", "https://example.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
Deno.env.set("INTEGRATION_ENCRYPTION_KEY", btoa("x".repeat(32)));
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("paid Standard product help finds live products without Ollama and saves a scoped selection", async () => {
  const original = globalThis.fetch;
  const link = await encrypt(
    "https://zam-mcp-server.zid.sa/mcp/test-only-link-123456",
  );
  let state: { step: string; context: Record<string, any> } = {
    step: "MENU",
    context: { serviceMode: "PRODUCT" },
  };
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    assert(!url.includes("ollama.com"));
    if (url.includes("billing_snapshot")) {
      return json({
        enforcementEnabled: true,
        plan: "standard",
        status: "ACTIVE",
        periodStart: new Date(Date.now() - 1000).toISOString(),
        periodEnd: new Date(Date.now() + 60_000).toISOString(),
      });
    }
    if (url.includes("get_whatsapp_flow_state")) return json([state]);
    if (url.includes("set_whatsapp_flow_state")) {
      state = { step: body.p_step, context: body.p_context };
      return json(null);
    }
    if (url.includes("get_zid_credential")) {
      assert(body.p_store_id === "store-a");
      return json([{ link_ciphertext: link }]);
    }
    if (url.includes("zid_catalog_sync")) {
      return json({ synced_at: new Date().toISOString() });
    }
    if (url.includes("zid_catalog_products")) {
      assert(url.includes("store_id=eq.store-a"));
      return json([{
        product_id: "p1",
        name_en: "Running shoes",
        search_text: "running shoes",
      }]);
    }
    if (url.includes("zam-mcp-server.zid.sa")) {
      if (body.method !== "tools/call") return json({ result: {} });
      assert(
        body.params.name === "Products" &&
          body.params.arguments.action === "get",
      );
      return json({
        result: {
          content: [{
            type: "text",
            text: encode({
              id: "p1",
              name: { en: "Running shoes" },
              price: 100,
              quantity: 5,
              is_published: true,
              is_draft: false,
              cost: 5,
              html_url: "https://shop.example/shoes",
            }),
          }],
        },
      });
    }
    throw new Error("Unexpected test route");
  };
  try {
    const reply = await processFlow(
      adminClient(),
      { id: "store-a", name: "Nova", return_code: "demo" },
      {
        id: "conversation-a",
        contact_id: "contact-a",
        language: "en",
        return_case_id: null,
      },
      "966500000000",
      "running shoes",
    );
    assert(
      reply.result.kind === "list" &&
        reply.result.rows[0].description?.includes("100.00 SAR"),
    );
    assert(
      state.context.shopping.storeId === "store-a" &&
        state.context.shopping.conversationId === "conversation-a",
    );
    assert(
      state.context.shopping.stage === "PRODUCT" &&
        !JSON.stringify(state).includes('"cost"'),
    );
    assert(!reply.body.includes("payment link"));
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("quantity side questions retain selection and resume context but drop stale order verification", async () => {
  Deno.env.set("OLLAMA_API_KEY", "test-only-model-key");
  const original = globalThis.fetch;
  let state: {step:string;context:Record<string,any>} = {step:"MENU",context:{
    serviceMode:"PRODUCT", shopping:{storeId:"store-a",conversationId:"conversation-a",expiresAt:Date.now()+60_000,token:"abc12345",stage:"QUANTITY",productId:"p1",candidates:[{id:"p1",name:"Shoes"}]},
    order:{orderId:"private-old-order"}, verificationToken:"old-verification", emailVerified:true,
    returnResume:{step:"AWAITING_REASON",context:{order:{orderId:"resumable-order"}}},
  }};
  let modelCalls=0;
  const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
  globalThis.fetch=async(input,init)=>{
    const url=String(input), body=init?.body?JSON.parse(String(init.body)):{};
    if(url.includes("billing_snapshot"))return json({enforcementEnabled:false});
    if(url.includes("get_whatsapp_flow_state"))return json([state]);
    if(url.includes("set_whatsapp_flow_state")){state={step:body.p_step,context:body.p_context};return json(null);}
    if(url.includes("ollama.com")) {
      modelCalls++;
      return json({message:{content:JSON.stringify(modelCalls===1?{intent:"QUESTION",search:""}:{answer:"Delivery costs SAR 20.",sourceIds:["delivery"],needsReview:false})}});
    }
    if(url.includes("billing_cost_events"))return json(null);
    if(url.includes("store_knowledge"))return json([{id:"delivery",title:"Delivery",content:"Delivery costs SAR 20.",language:"en",category:"delivery"}]);
    if(url.includes("commerce_connections"))return json(null);
    throw new Error(`Unexpected access ${new URL(url).pathname}`);
  };
  try {
    const reply=await processFlow(adminClient(),{id:"store-a",name:"Nova",return_code:"demo"},{id:"conversation-a",contact_id:"contact-a",language:"en",return_case_id:null},"966500000000","is delivery free?");
    assert(reply.body.includes("Delivery costs SAR 20.") && reply.body.includes("How many"));
    assert(state.context.shopping.stage==="QUANTITY" && state.context.shopping.productId==="p1");
    assert(state.context.returnResume.step==="AWAITING_REASON");
    assert(!state.context.order && !state.context.verificationToken && !state.context.emailVerified && !state.context.serviceMode);
    assert(modelCalls===2);
  } finally {globalThis.fetch=original;}
});
