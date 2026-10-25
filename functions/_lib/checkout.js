// Stripe Checkout Session for a pending order (hosted payment page: cards, Apple Pay, Google Pay).
import { stripeKeys, stripeRequest } from "./stripe.js";
import { orderLabel } from "./orders.js";
import { sha256Hex } from "./auth.js";
import { PRODUCTS } from "../../config/products.js";

// Returns { url, sessionId } or null when Stripe isn't configured for the current mode.
export async function createCheckout(env, origin, portrait, order) {
  const { secret, live } = await stripeKeys(env);
  if (!secret) return null;
  const physical = PRODUCTS[order.product_type]?.physical;
  const name = portrait.answers?.name || "your family";
  const params = {
    mode: "payment",
    client_reference_id: portrait.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: order.currency || "usd",
        unit_amount: order.amount, // computed on the server from config/products.js
        product_data: { name: `Legacy Portrait: ${orderLabel(order)}`, description: `A portrait of ${name}.` + (physical ? " Includes the digital file." : "") },
      },
    }],
    metadata: { app: "legacyportrait", order_id: order.id, portrait_id: portrait.id, product: order.product_type, size: order.size || "", gift: order.gift ? "1" : "0" },
    payment_intent_data: { metadata: { app: "legacyportrait", order_id: order.id, portrait_id: portrait.id } },
    allow_promotion_codes: "true",
    // Prices include tax (Nick's decision); Stripe Tax stays off unless STRIPE_TAX_ENABLED is set
    ...(String(env.STRIPE_TAX_ENABLED).toLowerCase() === "true" ? { automatic_tax: { enabled: "true" } } : {}),
    ...(physical ? { shipping_address_collection: { allowed_countries: ["US"] }, phone_number_collection: { enabled: "true" } } : {}),
    success_url: `${origin}/thanks?id=${portrait.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/keep?id=${portrait.id}&canceled=1`,
  };
  // same order, amount and choice -> same session (a double click doesn't create two)
  // the key covers the whole choice (hashed: options can hold a gift recipient's name), so two choices within one second never share a key
  const choice = (await sha256Hex(`${order.amount}|${order.product_type}|${order.size || ""}|${order.options || ""}|${order.gift ? 1 : 0}|${order.gift_message || ""}`)).slice(0, 24);
  const idempotencyKey = `checkout-${order.id}-${choice}-${order.updated_at || ""}-${live ? "live" : "test"}`;
  const s = await stripeRequest(env, secret, "POST", "/v1/checkout/sessions", params, { idempotencyKey });
  await env.DB.prepare("UPDATE orders SET stripe_session_id = ?, livemode = ? WHERE id = ?").bind(s.id, live ? 1 : 0, order.id).run();
  // a changed choice makes a new session: close the old one so an old tab can't pay the old price for the new choice
  if (order.stripe_session_id && order.stripe_session_id !== s.id) {
    try { await stripeRequest(env, secret, "POST", `/v1/checkout/sessions/${encodeURIComponent(order.stripe_session_id)}/expire`); }
    catch { /* already completed or expired: nothing to close */ }
  }
  return { url: s.url, sessionId: s.id };
}
