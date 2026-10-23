import test from "node:test";
import assert from "node:assert/strict";
import {
  checkoutInput,
  zidValidationCode,
} from "../src/lib/zid/checkout-contract";
import { checkoutMessages } from "../src/lib/zid/checkout-page";

test("the provider-required second address line is mandatory, bounded and preserved", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    product: "shoe-1",
    quantity: "1",
    shipping: "12",
    name: "Test user",
    email: "test@example.com",
    phone: "0500000000",
    city: "Riyadh",
    address: "Test street",
    addressExtra: "Building 12",
    consent: "yes",
  }))
    form.set(key, value);
  assert.equal(checkoutInput(form).addressExtra, "Building 12");
  for (const value of ["", "x".repeat(201), "building\ninvalid"]) {
    form.set("addressExtra", value);
    assert.throws(() => checkoutInput(form));
  }
});

test("Zid field errors become reviewed bilingual help without reflecting provider text or personal data", () => {
  const code = zidValidationCode({
    status: "validation_error",
    message: {
      validations: [
        {
          field: "consignee.address.line_2",
          errors: ["The consignee.address.line 2 field is required."],
        },
      ],
    },
  });
  assert.equal(code, "address_details_required");
  assert(checkoutMessages[code][0].includes("تفاصيل العنوان"));
  assert(checkoutMessages[code][1].includes("Address details"));
  for (const reply of [
    null,
    {},
    { message: "private raw error" },
    {
      message: {
        validations: [{ field: "unknown", errors: ["test@example.com"] }],
      },
    },
  ]) {
    assert.equal(zidValidationCode(reply), "validation_failed");
  }
});
