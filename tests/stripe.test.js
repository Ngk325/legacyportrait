import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyStripeSignature, hmacSha256Hex, formEncode, stripeKeys } from "../functions/_lib/stripe.js";
import { orderLabel } from "../functions/_lib/orders.js";

const SECRET = "whsec_test_secret";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const now = 1792900000000;
const t = Math.floor(now / 1000);
const header = async (ts = t, secret = SECRET, payload = body) => `t=${ts},v1=${await hmacSha256Hex(secret, `${ts}.${payload}`)},v0=deadbeef`;

test("a correctly signed event passes", async () => {
  assert.equal(await verifyStripeSignature(body, await header(), [SECRET], { now }), true);
});

test("tampered body, wrong secret, old timestamp and v0-only signatures fail", async () => {
  assert.equal(await verifyStripeSignature(body.replace("evt_1", "evt_2"), await header(), [SECRET], { now }), false);
  assert.equal(await verifyStripeSignature(body, await header(t, "whsec_other"), [SECRET], { now }), false);
  assert.equal(await verifyStripeSignature(body, await header(t - 301), [SECRET], { now }), false, "older than 5 minutes");
  const v0only = `t=${t},v0=${await hmacSha256Hex(SECRET, `${t}.${body}`)}`;
  assert.equal(await verifyStripeSignature(body, v0only, [SECRET], { now }), false, "only v1 counts");
  assert.equal(await verifyStripeSignature(body, "", [SECRET], { now }), false);
  assert.equal(await verifyStripeSignature(body, "garbage", [SECRET], { now }), false);
});

test("either the test or the live endpoint secret is accepted; a rolled secret's extra v1 is fine", async () => {
  assert.equal(await verifyStripeSignature(body, await header(t, "whsec_live"), [SECRET, "whsec_live"], { now }), true);
  const two = `t=${t},v1=${await hmacSha256Hex("whsec_old", `${t}.${body}`)},v1=${await hmacSha256Hex(SECRET, `${t}.${body}`)}`;
  assert.equal(await verifyStripeSignature(body, two, [SECRET], { now }), true);
  assert.equal(await verifyStripeSignature(body, await header(), [undefined, ""], { now }), false, "no secrets configured");
});

test("form encoding matches Stripe's bracket style", () => {
  assert.equal(
    formEncode({ mode: "payment", line_items: [{ quantity: 1, price_data: { unit_amount: 12400, product_data: { name: "A & B" } } }], shipping_address_collection: { allowed_countries: ["US"] }, skip: null }),
    "mode=payment&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=12400&line_items%5B0%5D%5Bprice_data%5D%5Bproduct_data%5D%5Bname%5D=A%20%26%20B&shipping_address_collection%5Ballowed_countries%5D%5B0%5D=US",
  );
});

test("test mode only uses a test key, live mode only a live key", async () => {
  const DB = { prepare: () => ({ bind: () => ({ first: async () => ({ value: "on" }) }) }) };
  assert.equal((await stripeKeys({ DB, STRIPE_SECRET_KEY_TEST: "sk_test_abc" })).secret, "sk_test_abc");
  assert.equal((await stripeKeys({ DB, STRIPE_SECRET_KEY_TEST: "sk_live_oops" })).secret, null, "a live key in the test slot is refused");
  assert.equal((await stripeKeys({ DB, LIVE_MODE: "true", STRIPE_SECRET_KEY_LIVE: "sk_live_abc", STRIPE_SECRET_KEY_TEST: "sk_test_abc" })).secret, "sk_live_abc");
  assert.equal((await stripeKeys({ DB, LIVE_MODE: "true", STRIPE_SECRET_KEY_LIVE: "sk_test_abc" })).secret, null);
});

test("order labels read naturally", () => {
  assert.equal(orderLabel({ product_type: "framed", size: "11x14", options: '{"color":"dark_wood","assembled":true}' }), "Framed print, 11 × 14 in, dark wood frame, ready to hang");
  assert.equal(orderLabel({ product_type: "print", size: "8x10", options: "{}" }), "Print only, 8 × 10 in");
  assert.equal(orderLabel({ product_type: "digital", options: "{}" }), "Digital portrait (PDF and image)");
});
