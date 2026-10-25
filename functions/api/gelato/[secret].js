import { json, err, logError } from "../../_lib/util.js";
import { sha256Hex } from "../../_lib/auth.js";
import { sendEmail, trackingEmail } from "../../_lib/mail.js";
import { orderLabel } from "../../_lib/orders.js";

// POST /api/gelato/<GELATO_WEBHOOK_SECRET>   Gelato order webhooks (register this URL in the Gelato dashboard).
// Gelato's docs describe no signature scheme, so (master prompt 7.4):
//  - the URL carries a long random secret, compared in constant time
//  - the event must name an order we have (orderReferenceId = our order id) that was sent to Gelato
//  - each event is recorded once (gelato_events), so Gelato's retries do nothing twice
// Events used: order_status_updated (fulfillmentStatus), order_item_tracking_code_updated (trackingCode, trackingUrl).
// Field names follow Gelato's webhook docs as summarised in docs/INTEGRATIONS.md [VERIFY on the first real event].
export async function onRequestPost({ env, request, params }) {
  const want = String(env.GELATO_WEBHOOK_SECRET || "");
  if (want.length < 32 || !(await sameSecret(String(params.secret || ""), want))) return err(404, "Not found.");
  const raw = await request.text();
  let e;
  try { e = JSON.parse(raw); } catch { return err(400, "Bad JSON."); }
  const orderId = String(e.orderReferenceId || "");
  const order = /^[a-f0-9]{16,64}$/.test(orderId) ? await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first() : null;
  // unknown orders get 200 so Gelato doesn't retry, but nothing changes; the team sees it in the error log
  if (!order || order.provider !== "gelato") {
    await logError(env, "gelato-webhook", "Event for an unknown order", { detail: { event: e.event, orderReferenceId: orderId.slice(0, 64), gelatoOrderId: String(e.orderId || "").slice(0, 64) } });
    return json({ received: true, ignored: true });
  }
  if (order.provider_order_id && e.orderId && String(e.orderId) !== order.provider_order_id) {
    await logError(env, "gelato-webhook", "Gelato order id doesn't match ours", { portraitId: order.portrait_id, detail: { order: order.id, theirs: String(e.orderId).slice(0, 64), ours: order.provider_order_id } });
    return json({ received: true, ignored: true });
  }
  const eventId = String(e.id || "") || (await sha256Hex(raw)).slice(0, 40);
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO gelato_events (id, event, order_id) VALUES (?, ?, ?)").bind(eventId, String(e.event || ""), order.id).run();
  if (!ins.meta || ins.meta.changes === 0) return json({ received: true, duplicate: true });

  try {
    await handle(env, order, e);
    return json({ received: true });
  } catch (x) {
    await env.DB.prepare("DELETE FROM gelato_events WHERE id = ?").bind(eventId).run();
    await logError(env, "gelato-webhook", x, { portraitId: order.portrait_id, detail: { order: order.id, event: e.event } });
    return err(500, "Couldn't process the event.");
  }
}

async function handle(env, order, e) {
  const origin = env.SITE_URL || "";
  if (e.event === "order_item_tracking_code_updated") {
    const code = String(e.trackingCode || "").slice(0, 80) || null;
    const url = /^https:\/\/[^\s"<>]+$/.test(String(e.trackingUrl || "")) ? String(e.trackingUrl).slice(0, 500) : null;
    if (!code && !url) return;
    const first = !["shipped", "delivered"].includes(order.status);
    await env.DB.prepare(`UPDATE orders SET tracking_code = ?, tracking_url = ?, carrier = COALESCE(?, carrier),
        status = CASE WHEN status IN ('paid', 'ready', 'placed') THEN 'shipped' ELSE status END, shipped_at = COALESCE(shipped_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`)
      .bind(code, url, e.shipmentMethodName ? String(e.shipmentMethodName).slice(0, 40) : null, order.id).run();
    if (first && order.email && order.status !== "refunded") {
      const p = await env.DB.prepare("SELECT answers FROM portraits WHERE id = ?").bind(order.portrait_id).first();
      const m = trackingEmail({ name: JSON.parse(p?.answers || "{}").name, label: orderLabel(order).toLowerCase(), orderId: order.id,
        trackingUrl: url || `${origin}/thanks?id=${order.portrait_id}`, trackingCode: code, carrier: e.shipmentMethodName });
      await sendEmail(env, { to: order.email, ...m, template: "shipped", portraitId: order.portrait_id, orderId: order.id, kind: "transactional" });
    }
    return;
  }
  if (e.event === "order_status_updated") {
    const st = String(e.fulfillmentStatus || "").slice(0, 40);
    await env.DB.prepare("UPDATE orders SET fulfillment_status = ?, updated_at = datetime('now') WHERE id = ?").bind(st || null, order.id).run();
    if (st === "delivered" && order.status !== "refunded") {
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, datetime('now')) WHERE id = ?").bind(order.id),
        env.DB.prepare("UPDATE portraits SET status = 'delivered', updated_at = datetime('now') WHERE id = ? AND status = 'paid'").bind(order.portrait_id),
      ]);
    }
    if (["canceled", "cancelled", "failed"].includes(st)) await logError(env, "gelato", `Gelato says the order is ${st}`, { portraitId: order.portrait_id, detail: { order: order.id } });
  }
  // other events (order_item_status_updated, ...) are recorded in gelato_events only
}

// constant-time comparison of two secrets (hash both so lengths match)
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
