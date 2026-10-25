import { test } from "node:test";
import assert from "node:assert/strict";
import { splitName, gelatoAddress, buildGelatoOrder } from "../functions/_lib/fulfillment.js";
import { GELATO_PRODUCT_UIDS, skuKey, missingGelatoUids } from "../config/gelato-products.js";

const order = {
  id: "a1b2c3d4e5f6a1b2c3d4e5f6", portrait_id: "f".repeat(32), product_type: "framed", size: "11x14",
  options: JSON.stringify({ color: "dark_wood", assembled: true }), currency: "usd", email: "kim@example.com",
  shipping_name: "Mary Ann de la Cruz",
  shipping_address: JSON.stringify({ line1: "12 Elm Street", line2: "Apt 4", city: "Dearborn", state: "MI", postal_code: "48126", country: "US", phone: "+13135550100" }),
};

test("product matrix: 21 SKUs, each order maps to one", () => {
  assert.equal(Object.keys(GELATO_PRODUCT_UIDS).length, 21);
  assert.equal(skuKey(order), "framed:11x14:dark_wood:assembled");
  assert.equal(skuKey({ product_type: "framed", size: "8x10", options: '{"color":"black"}' }), "framed:8x10:black:flat");
  assert.equal(skuKey({ product_type: "print", size: "16x20" }), "print:16x20");
  assert.equal(skuKey({ product_type: "digital" }), null);
  for (const k of [skuKey(order), "print:8x10"]) assert.ok(k in GELATO_PRODUCT_UIDS);
  assert.equal(missingGelatoUids().length, Object.values(GELATO_PRODUCT_UIDS).filter((v) => !v).length);
});

test("names split for Gelato's first/last fields", () => {
  assert.deepEqual(splitName("Mary Ann de la Cruz"), { firstName: "Mary Ann de la", lastName: "Cruz" });
  assert.deepEqual(splitName("Cher"), { firstName: "Cher", lastName: "Cher" });
  assert.deepEqual(splitName("  "), { firstName: "", lastName: "" });
});

test("Stripe address maps to Gelato's shippingAddress", () => {
  assert.deepEqual(gelatoAddress(order), {
    firstName: "Mary Ann de la", lastName: "Cruz", addressLine1: "12 Elm Street", addressLine2: "Apt 4",
    city: "Dearborn", postCode: "48126", state: "MI", country: "US", email: "kim@example.com", phone: "+13135550100",
  });
});

test("Gelato order body: draft by default shape, refuses missing pieces", () => {
  const body = buildGelatoOrder({ order, orderType: "draft", fileUrl: "https://x.test/f.pdf", productUid: "uid-1", shipmentMethodUid: "standard" });
  assert.equal(body.orderType, "draft");
  assert.equal(body.orderReferenceId, order.id);
  assert.equal(body.currency, "USD");
  assert.deepEqual(body.items, [{ itemReferenceId: order.id + "-1", productUid: "uid-1", files: [{ type: "default", url: "https://x.test/f.pdf" }], quantity: 1 }]);
  assert.equal(body.shipmentMethodUid, "standard");
  assert.throws(() => buildGelatoOrder({ order, orderType: "draft", fileUrl: "https://x", productUid: null }), /productUid/);
  assert.throws(() => buildGelatoOrder({ order, orderType: "draft", fileUrl: null, productUid: "u" }), /LINK_SECRET/);
  assert.throws(() => buildGelatoOrder({ order: { ...order, shipping_address: "{}" }, orderType: "draft", fileUrl: "https://x", productUid: "u" }), /missing/);
  const abroad = { ...order, shipping_address: JSON.stringify({ ...JSON.parse(order.shipping_address), country: "CA" }) };
  assert.throws(() => buildGelatoOrder({ order: abroad, orderType: "draft", fileUrl: "https://x", productUid: "u" }), /US/);
});
