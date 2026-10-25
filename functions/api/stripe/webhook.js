import { json, err, logError } from "../../_lib/util.js";
import { verifyStripeSignature } from "../../_lib/stripe.js";

// POST /api/stripe/webhook (register in the Stripe dashboard for: checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, charge.dispute.created)
// - signature checked on the raw body with the test and live endpoint secrets
// - every event id is recorded in stripe_events first, so a repeated delivery does nothing
// - if handling fails the record is removed and we answer 500, so Stripe retries
export async function onRequestPost({ env, request }) {
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get("stripe-signature"), [env.STRIPE_WEBHOOK_SECRET_TEST, env.STRIPE_WEBHOOK_SECRET_LIVE]);
  if (!ok) return err(400, "Bad signature.");
  let event;
  try { event = JSON.parse(raw); } catch { return err(400, "Bad JSON."); }

  const ins = await env.DB.prepare("INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)").bind(event.id, event.type).run();
  if (!ins.meta || ins.meta.changes === 0) return json({ received: true, duplicate: true });

  try {
    await handle(env, event);
    return json({ received: true });
  } catch (e) {
    await env.DB.prepare("DELETE FROM stripe_events WHERE id = ?").bind(event.id).run();
    await logError(env, "webhook", e, { detail: { event: event.id, type: event.type } });
    return err(500, "Webhook handling failed.");
  }
}

async function handle(env, event) {
  const o = event.data && event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      if (o.payment_status === "paid" || o.payment_status === "no_payment_required") await markPaid(env, o, event);
      return; // delayed payment methods: wait for async_payment_succeeded
    case "checkout.session.async_payment_succeeded":
      return markPaid(env, o, event);
    case "checkout.session.async_payment_failed":
      return logError(env, "payment-failed", "Delayed payment failed", { portraitId: o.metadata?.portrait_id || null, detail: { session: o.id } });
    case "charge.refunded":
      return markRefunded(env, o);
    case "charge.dispute.created":
      return logError(env, "dispute", "A customer opened a dispute", { detail: { charge: o.charge || o.id, amount: o.amount, reason: o.reason } });
    default:
      return; // not subscribed to anything else
  }
}

async function markPaid(env, s, event) {
  const orderId = s.metadata?.order_id;
  const order = orderId ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first() : null;
  if (!order) throw new Error(`No order for session ${s.id} (metadata order_id ${orderId})`);
  if (order.status === "paid") return;
  // newer API versions put shipping under collected_information; older ones at the top level
  const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || null;
  const addr = ship && ship.address;
  if (addr && addr.country && addr.country !== "US") throw new Error(`Non-US shipping address on session ${s.id}`); // Checkout only allows US; this should never happen
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET status = 'paid', email = ?, shipping_name = ?, shipping_address = ?, shipping_state = ?,
        stripe_session_id = ?, stripe_payment_intent = ?, amount = ?, livemode = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(s.customer_details?.email || null, ship?.name || null, addr ? JSON.stringify({ ...addr, phone: s.customer_details?.phone || null }) : null, addr?.state || null,
        s.id, typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null,
        Number.isInteger(s.amount_total) ? s.amount_total : order.amount, event.livemode ? 1 : 0, order.id),
    env.DB.prepare("UPDATE portraits SET status = 'paid', email = COALESCE(email, ?), updated_at = datetime('now') WHERE id = ?").bind(s.customer_details?.email || null, order.portrait_id),
  ]);
  // receipt and download emails arrive with WP6 (Resend)
}

async function markRefunded(env, charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const full = charge.refunded === true || charge.amount_refunded >= charge.amount;
  const order = await env.DB.prepare("SELECT id, portrait_id FROM orders WHERE stripe_payment_intent = ?").bind(pi).first();
  if (!order) throw new Error(`No order for refunded payment ${pi}`);
  const stmts = [env.DB.prepare(`UPDATE orders SET status = CASE WHEN ? THEN 'refunded' ELSE status END, refunded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(full ? 1 : 0, order.id)];
  // a full refund also closes the downloads: the portrait goes back to approved (the print files need "paid")
  if (full) stmts.push(env.DB.prepare("UPDATE portraits SET status = 'approved', updated_at = datetime('now') WHERE id = ? AND status = 'paid'").bind(order.portrait_id));
  await env.DB.batch(stmts);
}
