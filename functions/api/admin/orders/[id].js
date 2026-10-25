import { json, err, logError, getPortrait } from "../../../_lib/util.js";
import { isTeam, signedPrintUrl } from "../../../_lib/auth.js";
import { orderLabel } from "../../../_lib/orders.js";
import { stripeKeys, stripeRequest } from "../../../_lib/stripe.js";
import { sendEmail, receiptEmail, trackingEmail } from "../../../_lib/mail.js";
import { applyRefund } from "../../../_lib/refunds.js";
import { fulfill } from "../../../_lib/fulfillment.js";
import { flags } from "../../../_lib/flags.js";
import { cleanText } from "../../../_lib/prompt.js";
import { PRODUCTS } from "../../../../config/products.js";
import { GELATO_PRODUCT_UIDS, skuKey } from "../../../../config/gelato-products.js";

// Rule of thumb for the low-resolution warning: shortest side of each photo, in pixels, per print size.
const MIN_PHOTO_PX = { "8x10": 900, "11x14": 1200, "16x20": 1600 };

// GET  /api/admin/orders/:id   everything the team needs for one order
// POST /api/admin/orders/:id   { action, ... }  review | fulfill | placed | tracking | delivered | refund | resend | note
export async function onRequest({ env, request, params }) {
  if (!isTeam(env, request)) return err(401, "Team only.");
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(params.id).first();
  if (!order) return err(404, "No such order.");
  const origin = env.SITE_URL || new URL(request.url).origin;
  if (request.method === "GET") return json(await detail(env, origin, order));
  if (request.method !== "POST") return err(405, "Method not allowed.");
  let b = {};
  try { b = await request.json(); } catch {}
  try {
    const msg = await act(env, origin, order, b);
    const fresh = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(order.id).first();
    return json({ ok: true, message: msg, ...(await detail(env, origin, fresh)) });
  } catch (e) {
    if (e.userFacing) return err(400, e.message);
    await logError(env, "admin", e, { portraitId: order.portrait_id, detail: { order: order.id, action: b.action } });
    return err(500, String(e.message || e).slice(0, 300));
  }
}

const fail = (message) => Object.assign(new Error(message), { userFacing: true });
const parse = (s) => { try { return JSON.parse(s || "null"); } catch { return null; } };

async function detail(env, origin, o) {
  const p = await getPortrait(env, o.portrait_id);
  const physical = !!PRODUCTS[o.product_type]?.physical;
  const minPx = MIN_PHOTO_PX[o.size] || 0;
  const photos = (p?.photos || []).map((x) => ({ width: x.width, height: x.height, lowRes: physical && Math.min(x.width || 0, x.height || 0) < minPx }));
  const words = (p?.edited?.body_paragraphs || []).join(" ").split(/\s+/).filter(Boolean).length;
  const { results: emails } = await env.DB.prepare("SELECT template, status, created_at FROM email_log WHERE order_id = ? OR (portrait_id = ? AND template = 'receipt') ORDER BY id DESC LIMIT 20").bind(o.id, o.portrait_id).all();
  const { results: errors } = await env.DB.prepare("SELECT source, message, created_at FROM errors WHERE portrait_id = ? ORDER BY id DESC LIMIT 10").bind(o.portrait_id).all();
  const sizes = physical ? [o.size] : ["8x10", "11x14", "16x20"];
  return {
    order: {
      id: o.id, portraitId: o.portrait_id, status: o.status, label: orderLabel(o), product: o.product_type, size: o.size, options: parse(o.options),
      physical, amount: o.amount, currency: o.currency, email: o.email, livemode: !!o.livemode, gift: !!o.gift, giftMessage: o.gift_message,
      shippingName: o.shipping_name, shippingAddress: parse(o.shipping_address), review: parse(o.review), note: o.admin_note,
      provider: o.provider, providerOrderId: o.provider_order_id, fulfillmentStatus: o.fulfillment_status, payload: parse(o.fulfillment_payload),
      trackingCode: o.tracking_code, trackingUrl: o.tracking_url, carrier: o.carrier,
      createdAt: o.created_at, placedAt: o.placed_at, shippedAt: o.shipped_at, deliveredAt: o.delivered_at, refundedAt: o.refunded_at,
      stripePaymentIntent: o.stripe_payment_intent,
    },
    portrait: p ? { name: p.answers?.name || "", status: p.status, words, shortStory: words > 0 && words < 250, photos, headline: p.edited?.headline || "" } : null,
    // signed links valid 24 h, so the team can download without the token in the URL (null until LINK_SECRET is set)
    files: await Promise.all(sizes.flatMap((s) => ["pdf", "png"].map(async (f) => ({ size: s, format: f, url: await signedPrintUrl(env, origin, o.portrait_id, s, f, 86400) })))),
    gelato: { mode: flags(env).fulfillmentMode, sku: skuKey(o), productUid: physical ? GELATO_PRODUCT_UIDS[skuKey(o)] || null : null, apiKey: !!env.GELATO_API_KEY },
    emails, errors,
  };
}

async function act(env, origin, o, b) {
  const physical = !!PRODUCTS[o.product_type]?.physical;
  const name = async () => JSON.parse((await env.DB.prepare("SELECT answers FROM portraits WHERE id = ?").bind(o.portrait_id).first())?.answers || "{}").name;
  const set = (sql, ...v) => env.DB.prepare(`UPDATE orders SET ${sql}, updated_at = datetime('now') WHERE id = ?`).bind(...v, o.id).run();
  const open = ["paid", "ready", "placed", "shipped"].includes(o.status);

  switch (b.action) {
    case "review": {
      // quality gate before the print file goes to Gelato: text fits, photo resolution OK, no blank areas
      if (!physical) throw fail("Digital orders don't need a print review.");
      if (!["paid", "ready"].includes(o.status)) throw fail(`Can't review an order that is ${o.status}.`);
      const r = { textFits: b.textFits === true, photoOk: b.photoOk === true, noBlank: b.noBlank === true, fit: cleanText(b.fit || "", 40), at: new Date().toISOString() };
      const passed = r.textFits && r.photoOk && r.noBlank;
      await set("review = ?, status = ?", JSON.stringify(r), passed ? "ready" : "paid");
      return passed ? "Review passed: ready to print." : "Review saved: not ready yet.";
    }
    case "fulfill": {
      if (o.status !== "ready") throw fail("Pass the review first.");
      const r = await fulfill(env, origin, o);
      if (r.mode === "manual") throw fail("Fulfillment is manual: place it in the Gelato dashboard, then use Mark placed.");
      return r.sent ? `Sent to Gelato as ${r.orderType === "draft" ? "a draft (confirm it in the Gelato dashboard)" : "a real order"}${r.providerOrderId ? `: ${r.providerOrderId}` : ""}.`
        : "Gelato order body built and saved (no GELATO_API_KEY, nothing sent).";
    }
    case "placed": {
      if (!physical) throw fail("Digital orders aren't printed.");
      if (!["ready", "placed"].includes(o.status)) throw fail(o.status === "paid" ? "Pass the review first." : `Can't mark an order that is ${o.status} as placed.`);
      const id = cleanText(b.providerOrderId || "", 80).trim();
      if (!id) throw fail("Paste the Gelato order id.");
      await set("status = 'placed', provider = 'gelato', provider_order_id = ?, placed_at = COALESCE(placed_at, datetime('now'))", id);
      return "Marked placed with Gelato.";
    }
    case "tracking": {
      if (!["placed", "shipped"].includes(o.status)) throw fail("Mark it placed first.");
      const code = cleanText(b.trackingCode || "", 80).trim();
      const url = String(b.trackingUrl || "").trim();
      if (!code && !url) throw fail("Paste a tracking number or link.");
      if (url && !/^https:\/\/[^\s"<>]+$/.test(url)) throw fail("The tracking link must start with https://");
      await set("status = 'shipped', tracking_code = ?, tracking_url = ?, carrier = ?, shipped_at = COALESCE(shipped_at, datetime('now'))", code || null, url || null, cleanText(b.carrier || "", 40).trim() || null);
      if (o.status !== "shipped" && o.email) {
        const m = trackingEmail({ name: await name(), label: orderLabel(o).toLowerCase(), orderId: o.id, trackingUrl: url || `${origin}/thanks?id=${o.portrait_id}`, trackingCode: code, carrier: b.carrier });
        const s = await sendEmail(env, { to: o.email, ...m, template: "shipped", portraitId: o.portrait_id, orderId: o.id, kind: "transactional" });
        return `Tracking saved. Email: ${s.status}.`;
      }
      return "Tracking saved.";
    }
    case "delivered": {
      if (!["shipped", "paid"].includes(o.status) || (o.status === "paid" && physical)) throw fail(physical ? "Only shipped orders can be marked delivered." : `Can't mark an order that is ${o.status} as delivered.`);
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(o.id),
        env.DB.prepare("UPDATE portraits SET status = 'delivered', updated_at = datetime('now') WHERE id = ? AND status = 'paid'").bind(o.portrait_id),
      ]);
      return "Marked delivered.";
    }
    case "refund": {
      if (!(open || o.status === "delivered")) throw fail(`Can't refund an order that is ${o.status}.`);
      if (!o.stripe_payment_intent) throw fail("No Stripe payment on this order.");
      if (b.confirm !== o.id) throw fail("Confirm the refund by sending the order id.");
      const { secret, live } = await stripeKeys(env);
      if (!secret) throw fail("Stripe isn't configured for the current mode.");
      if (!!o.livemode !== live) throw fail(`This order was paid in ${o.livemode ? "live" : "test"} mode; switch modes to refund it.`);
      const r = await stripeRequest(env, secret, "POST", "/v1/refunds", { payment_intent: o.stripe_payment_intent, reason: "requested_by_customer", metadata: { order_id: o.id } }, { idempotencyKey: `refund-${o.id}` });
      await applyRefund(env, o, { full: true, amountCents: r.amount, origin });
      return `Refunded $${((r.amount ?? o.amount) / 100).toFixed(2)}${["placed", "shipped"].includes(o.status) ? ". Cancel the Gelato order by hand if it hasn't shipped." : "."}`;
    }
    case "resend": {
      if (!o.email) throw fail("No email on this order.");
      if (o.status === "refunded" || o.status === "pending") throw fail(`Nothing to resend for an order that is ${o.status}.`);
      const shipped = o.status === "shipped" && (o.tracking_url || o.tracking_code);
      const m = shipped
        ? trackingEmail({ name: await name(), label: orderLabel(o).toLowerCase(), orderId: o.id, trackingUrl: o.tracking_url || `${origin}/thanks?id=${o.portrait_id}`, trackingCode: o.tracking_code, carrier: o.carrier })
        : receiptEmail({ name: await name(), label: orderLabel(o), amountCents: o.amount, orderId: o.id, downloadsUrl: `${origin}/thanks?id=${o.portrait_id}`, physical, gift: !!o.gift });
      const s = await sendEmail(env, { to: o.email, ...m, template: shipped ? "shipped" : "receipt", portraitId: o.portrait_id, orderId: o.id, kind: "transactional" });
      return `${shipped ? "Tracking" : "Receipt"} email: ${s.status}.`;
    }
    case "note":
      await set("admin_note = ?", cleanText(b.note || "", 1000).trim() || null);
      return "Note saved.";
    default:
      throw fail("Unknown action.");
  }
}
