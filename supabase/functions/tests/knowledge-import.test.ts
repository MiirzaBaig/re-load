import { publicSourceUrl, publicAddress, sourceText, validateKnowledgeImport } from "../_shared/knowledge-import.ts";
function assert(v:unknown):asserts v{if(!v)throw new Error("Assertion failed");}
function rejects(fn:()=>unknown){let caught=false;try{fn();}catch{caught=true;}assert(caught);}
Deno.test("import source rejects private addresses and credential-bearing URLs",()=>{
 for(const url of ["https://127.0.0.1/help","https://localhost/help","https://[::1]/","https://user:pass@example.com","https://example.com:8080/"])rejects(()=>publicSourceUrl(url));
 for(const ip of ["10.0.0.1","172.16.0.2","192.168.1.2","169.254.169.254","127.0.0.1","::1","fd00::1","::ffff:127.0.0.1"])assert(!publicAddress(ip));
 assert(publicAddress("8.8.8.8") && publicSourceUrl("shop.example/help").hostname === "shop.example");
});
Deno.test("import validates exact source evidence and uses it as the draft answer",()=>{
 const text="Delivery within Riyadh takes 2–3 working days.";
 const out=validateKnowledgeImport(text,{entries:[{title:"How long does delivery take?",category:"DELIVERY",language:"en",sourceExcerpt:text,answer:"Guaranteed tomorrow!"}],warnings:[]});
 assert(out.entries[0].content === text && !out.entries[0].content.includes("tomorrow"));
 rejects(()=>validateKnowledgeImport(text,{entries:[{title:"Shipping",category:"DELIVERY",language:"en",sourceExcerpt:"Free delivery guaranteed"}]}));
});
Deno.test("import strips scripts and navigation without treating instructions as code",()=>{
 assert(sourceText('<nav>Menu</nav><script>secret()</script><p>Delivery &amp; warranty</p>') === "Delivery & warranty");
});
