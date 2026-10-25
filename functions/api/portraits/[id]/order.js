import { json, err, getPortrait, newId } from "../../../_lib/util.js";
import { canEdit, LOCKED_MESSAGE } from "../../../_lib/auth.js";
import { isLiveMode } from "../../../_lib/flags.js";
import { validateChoice } from "../../../_lib/orders.js";
import { CURRENCY } from "../../../../config/products.js";

// The customer's choice of format, saved as one pending order per portrait. The price is always computed here,
// from config/products.js; nothing the browser sends about money is trusted. WP4 turns this row into a Stripe Checkout.

const view = (o) => {
  if (!o) return null;
  const opt = JSON.parse(o.options || "{}");
  return { id: o.id, product: o.product_type, size: o.size, color: opt.color || null, assembled: !!opt.assembled, gift: !!o.gift, giftRecipient: opt.giftRecipient || "", giftMessage: o.gift_message || "", amount: o.amount, currency: o.currency, status: o.status };
};

export async function onRequest({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that portrait.");
  const current = await env.DB.prepare("SELECT * FROM orders WHERE portrait_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(p.id).first();
  if (request.method === "GET") return json({ order: view(current), status: p.status });
  if (request.method !== "POST") return err(405, "Method not allowed.");

  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  if (["paid", "delivered"].includes(p.status)) return err(409, "This portrait has already been ordered.");
  if (p.status !== "approved") return err(409, "Please read and approve your text first.");

  let body = {};
  try { body = await request.json(); } catch {}
  const c = validateChoice(body);
  if (c.error) return err(400, c.error);

  const id = current ? current.id : newId(12);
  const options = JSON.stringify({ color: c.color, assembled: c.assembled, giftRecipient: c.giftRecipient });
  const live = (await isLiveMode(env)) ? 1 : 0;
  if (current) {
    await env.DB.prepare("UPDATE orders SET product_type = ?, size = ?, options = ?, gift = ?, gift_message = ?, amount = ?, currency = ?, livemode = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(c.product, c.size, options, c.gift ? 1 : 0, c.giftMessage, c.amount, CURRENCY, live, id).run();
  } else {
    await env.DB.prepare("INSERT INTO orders (id, portrait_id, status, product_type, size, options, gift, gift_message, amount, currency, livemode, updated_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))")
      .bind(id, p.id, c.product, c.size, options, c.gift ? 1 : 0, c.giftMessage, c.amount, CURRENCY, live).run();
  }
  const saved = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  // Stripe Checkout arrives in WP4; until then the choice is saved and the page says payment opens soon.
  return json({ order: view(saved), checkout: { available: false } });
}
