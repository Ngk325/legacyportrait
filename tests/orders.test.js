import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChoice } from "../functions/_lib/orders.js";
import { onRequestGet as products } from "../functions/api/products.js";

test("choices are validated and priced on the server", () => {
  assert.equal(validateChoice({ product: "framed", size: "11x14", color: "wood", assembled: true }).amount, 12400);
  assert.equal(validateChoice({ product: "print", size: "8x10", assembled: true }).amount, 3900, "assembly ignored on print-only");
  assert.equal(validateChoice({ product: "digital", size: "16x20" }).size, null);
  assert.match(validateChoice({ product: "framed", size: "11x14" }).error, /frame color/);
  assert.match(validateChoice({ product: "framed", size: "5x7", color: "wood" }).error, /size/);
  assert.match(validateChoice({ product: "poster" }).error, /format/);
  assert.match(validateChoice({ product: "framed", size: "11x14", color: "white" }).error, /frame color/, "no white frames");
});

test("gift fields are cleaned and capped; amount from the client is ignored", () => {
  const c = validateChoice({ product: "digital", gift: true, giftRecipient: "Grandma\u202E Rose", giftMessage: "x".repeat(500), amount: 1 });
  assert.equal(c.giftRecipient, "Grandma Rose");
  assert.equal(c.giftMessage.length, 200);
  assert.equal(c.amount, 1900);
  assert.equal(validateChoice({ product: "digital", gift: false, giftMessage: "hi" }).giftMessage, "");
});

test("products endpoint returns the offer, order-by dates and an arrival estimate", async () => {
  const d = await (await products()).json();
  assert.deepEqual(Object.keys(d.products), ["digital", "print", "framed"]);
  assert.match(d.estimatedArrival, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d.orderBy.physical || d.orderBy.missed || d.orderBy.physical === null);
});
