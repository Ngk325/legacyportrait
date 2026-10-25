import { json, err, logError } from "../../_lib/util.js";
import { verifyStripeSignature } from "../../_lib/stripe.js";
import { sendEmail, receiptEmail } from "../../_lib/mail.js";
import { orderLabel } from "../../_lib/orders.js";
import { PRODUCTS } from "../../../config/products.js";
import { applyRefund } from "../../_lib/refunds.js";

// POST /api/stripe/webhook (register in the Stripe dashboard for: checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, charge.dispute.created)
// - signature checked on the raw body with the test and live endpoint secrets
// - every event id is recorded in stripe_events first, so a repeated delivery does nothing
// - if handling fails the record is removed and we answer 500, so Stripe retries
export async function onRequestPost({ env, request }) {
  const origin = env.SITE_URL || new URL(request.url).origin;
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get("stripe-signature"), [env.STRIPE_WEBHOOK_SECRET_TEST, env.STRIPE_WEBHOOK_SECRET_LIVE]);
  if (!ok) return err(400, "Bad signature.");
  let event;
  try { event = JSON.parse(raw); } catch { return err(400, "Bad JSON."); }

  const ins = await env.DB.prepare("INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)").bind(event.id, event.type).run();
  if (!ins.meta || ins.meta.changes === 0) return json({ received: true, duplicate: true });

  try {
    await handle(env, event, origin);
    return json({ received: true });
  } catch (e) {
    await env.DB.prepare("DELETE FROM stripe_events WHERE id = ?").bind(event.id).run();
    await logError(env, "webhook", e, { detail: { event: event.id, type: event.type } });
    return err(500, "Webhook handling failed.");
  }
}

// The Stripe account is shared with other products, so the endpoint also receives their events.
// Ours carry our metadata (checkout) or match an order we stored (charges, disputes); everything else is acknowledged and ignored.
const isOurSession = (s) => !!(s && s.metadata && s.metadata.order_id && s.metadata.portrait_id);
const orderByIntent = (env, pi) => (pi ? env.DB.prepare("SELECT * FROM orders WHERE stripe_payment_intent = ?").bind(typeof pi === "string" ? pi : pi.id).first() : null);

async function handle(env, event, origin) {
  const o = event.data && event.data.object;
  if (event.type.startsWith("checkout.session.") && !isOurSession(o)) return;
  switch (event.type) {
    case "checkout.session.completed":
      if (o.payment_status === "paid" || o.payment_status === "no_payment_required") await markPaid(env, o, event, origin);
      return; // delayed payment methods: wait for async_payment_succeeded
    case "checkout.session.async_payment_succeeded":
      return markPaid(env, o, event, origin);
    case "checkout.session.async_payment_failed":
      return logError(env, "payment-failed", "Delayed payment failed", { portraitId: o.metadata?.portrait_id || null, detail: { session: o.id } });
    case "charge.refunded":
      return markRefunded(env, o, origin);
    case "charge.dispute.created": {
      const order = await orderByIntent(env, o.payment_intent);
      if (!order) return;
      return logError(env, "dispute", "A customer opened a dispute", { portraitId: order.portrait_id, detail: { order: order.id, charge: o.charge || o.id, amount: o.amount, reason: o.reason } });
    }
    default:
      return; // not subscribed to anything else
  }
}

async function markPaid(env, s, event, origin) {
  const orderId = s.metadata?.order_id;
  const order = orderId ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first() : null;
  if (!order) throw new Error(`No order for session ${s.id} (metadata order_id ${orderId})`);
  if (order.status !== "pending") return; // already paid (or further along): never move an order backwards
  // the endpoint accepts both test and live signatures, so the event's mode must match the mode the checkout was made in
  // (logged, not thrown: a retry can never fix it)
  if (!!event.livemode !== !!order.livemode) return logError(env, "payment", `Ignored a ${event.livemode ? "live" : "test"} payment for a ${order.livemode ? "live" : "test"} order`, { portraitId: order.portrait_id, detail: { order: order.id, session: s.id } });
  // an older checkout link for this order was paid (new links expire the old one, but one can still complete in the gap)
  if (order.stripe_session_id && s.id !== order.stripe_session_id) await logError(env, "payment", "Paid an older checkout session; check the product and amount", { portraitId: order.portrait_id, detail: { order: order.id, paid: s.id, current: order.stripe_session_id, amount: s.amount_total, metadata: s.metadata } });
  // newer API versions put shipping under collected_information; older ones at the top level
  const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || null;
  const addr = ship && ship.address;
  if (addr && addr.country && addr.country !== "US") throw new Error(`Non-US shipping address on session ${s.id}`); // Checkout only allows US; this should never happen
  // a digital order is delivered the moment it is paid (the files are on the thank-you page); this starts the retention clock
  const digital = !PRODUCTS[order.product_type]?.physical;
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET status = ?, delivered_at = CASE WHEN ? THEN datetime('now') ELSE delivered_at END, email = ?, shipping_name = ?, shipping_address = ?, shipping_state = ?,
        stripe_session_id = ?, stripe_payment_intent = ?, amount = ?, livemode = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(digital ? "delivered" : "paid", digital ? 1 : 0, s.customer_details?.email || null, ship?.name || null, addr ? JSON.stringify({ ...addr, phone: s.customer_details?.phone || null }) : null, addr?.state || null,
        s.id, typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null,
        Number.isInteger(s.amount_total) ? s.amount_total : order.amount, event.livemode ? 1 : 0, order.id),
    env.DB.prepare("UPDATE portraits SET status = ?, email = COALESCE(email, ?), updated_at = datetime('now') WHERE id = ?").bind(digital ? "delivered" : "paid", s.customer_details?.email || null, order.portrait_id),
  ]);
  // receipt with the download link; a failed email must not fail the payment (the team sees it in email_log/errors)
  const email = s.customer_details?.email;
  if (email) {
    try {
      const portrait = await env.DB.prepare("SELECT answers FROM portraits WHERE id = ?").bind(order.portrait_id).first();
      const name = JSON.parse(portrait?.answers || "{}").name;
      const m = receiptEmail({ name, label: orderLabel(order), amountCents: Number.isInteger(s.amount_total) ? s.amount_total : order.amount, orderId: order.id,
        downloadsUrl: `${origin}/thanks?id=${order.portrait_id}`, physical: !!PRODUCTS[order.product_type]?.physical, gift: !!order.gift });
      await sendEmail(env, { to: email, ...m, template: "receipt", portraitId: order.portrait_id, orderId: order.id, kind: "transactional" });
    } catch (e) { await logError(env, "email", e, { portraitId: order.portrait_id, detail: { order: order.id } }); }
  }
}

async function markRefunded(env, charge, origin) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const full = charge.refunded === true || charge.amount_refunded >= charge.amount;
  const order = await orderByIntent(env, pi);
  if (!order) return; // another product's payment on the shared account
  await applyRefund(env, order, { full, amountCents: charge.amount_refunded, origin });
}
