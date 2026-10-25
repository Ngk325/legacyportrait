// Stripe Checkout Session for a pending order (hosted payment page: cards, Apple Pay, Google Pay).
import { stripeKeys, stripeRequest } from "./stripe.js";
import { orderLabel } from "./orders.js";
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
    metadata: { order_id: order.id, portrait_id: portrait.id, product: order.product_type, size: order.size || "", gift: order.gift ? "1" : "0" },
    payment_intent_data: { metadata: { order_id: order.id, portrait_id: portrait.id } },
    allow_promotion_codes: "true",
    // Prices include tax (Nick's decision); Stripe Tax stays off unless STRIPE_TAX_ENABLED is set
    ...(String(env.STRIPE_TAX_ENABLED).toLowerCase() === "true" ? { automatic_tax: { enabled: "true" } } : {}),
    ...(physical ? { shipping_address_collection: { allowed_countries: ["US"] }, phone_number_collection: { enabled: "true" } } : {}),
    success_url: `${origin}/thanks?id=${portrait.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/keep?id=${portrait.id}&canceled=1`,
  };
  // same order, amount and choice -> same session (a double click doesn't create two)
  const idempotencyKey = `checkout-${order.id}-${order.amount}-${order.updated_at || ""}-${live ? "live" : "test"}`;
  const s = await stripeRequest(env, secret, "POST", "/v1/checkout/sessions", params, { idempotencyKey });
  await env.DB.prepare("UPDATE orders SET stripe_session_id = ?, livemode = ? WHERE id = ?").bind(s.id, live ? 1 : 0, order.id).run();
  return { url: s.url, sessionId: s.id };
}
