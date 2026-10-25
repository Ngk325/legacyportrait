import { test } from "node:test";
import assert from "node:assert/strict";
import { priceCents, PRODUCTS, SIZES } from "../config/products.js";

test("prices match the D2 table", () => {
  assert.equal(priceCents({ product: "digital" }), 1900);
  assert.deepEqual(SIZES.map((size) => priceCents({ product: "print", size })), [3900, 4900, 6900]);
  assert.deepEqual(SIZES.map((size) => priceCents({ product: "framed", size })), [7900, 10900, 14900]);
  assert.deepEqual(SIZES.map((size) => priceCents({ product: "framed", size, assembled: true })), [9400, 12400, 16400]);
});

test("assembly only applies to framed; unknown configurations return null", () => {
  assert.equal(priceCents({ product: "print", size: "11x14", assembled: true }), 4900);
  assert.equal(priceCents({ product: "framed", size: "5x7" }), null);
  assert.equal(priceCents({ product: "poster", size: "11x14" }), null);
  assert.ok(Object.values(PRODUCTS).every((p) => p.label));
});
