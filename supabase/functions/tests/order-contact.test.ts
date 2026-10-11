import { normalizeOrderContact } from "../_shared/order-contact.ts";
function equal(a: string, b: string) { if (a !== b) throw new Error(`${a} !== ${b}`); }
Deno.test("Saudi local formats match their full international number", () => {
  equal(normalizeOrderContact("055 236 2631"), normalizeOrderContact("+966 55 236 2631"));
  equal(normalizeOrderContact("552362631"), normalizeOrderContact("00966552362631"));
});
Deno.test("country codes are never dropped to compare suffixes", () => {
  if (normalizeOrderContact("+966552362631") === normalizeOrderContact("+91552362631")) throw new Error("cross-country collision");
});
Deno.test("emails retain case-insensitive exact matching", () => { equal(normalizeOrderContact(" Ahmed@Example.com "), "ahmed@example.com"); });
Deno.test("short or empty phone values cannot verify an order", () => { equal(normalizeOrderContact(""), ""); equal(normalizeOrderContact("1234"), ""); });
