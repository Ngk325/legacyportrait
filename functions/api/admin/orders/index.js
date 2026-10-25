import { json, err } from "../../../_lib/util.js";
import { isTeam } from "../../../_lib/auth.js";
import { orderLabel } from "../../../_lib/orders.js";
import { PRODUCTS } from "../../../../config/products.js";

// GET /api/admin/orders?view=open|done|all   the orders queue (paid and later; checkout-abandoned "pending" rows only with view=all)
export async function onRequestGet({ env, request }) {
  if (!isTeam(env, request)) return err(401, "Team only.");
  const view = new URL(request.url).searchParams.get("view") || "open";
  const where = {
    open: "o.status IN ('paid', 'ready', 'placed', 'shipped')",
    done: "o.status IN ('delivered', 'refunded')",
    all: "1 = 1",
  }[view];
  if (!where) return err(400, "view must be open, done or all.");
  const { results } = await env.DB.prepare(`SELECT o.*, p.answers AS p_answers FROM orders o LEFT JOIN portraits p ON p.id = o.portrait_id
      WHERE ${where} ORDER BY o.created_at DESC LIMIT 200`).all();
  return json({
    orders: results.map((o) => ({
      id: o.id, portraitId: o.portrait_id, status: o.status, product: o.product_type, physical: !!PRODUCTS[o.product_type]?.physical,
      label: orderLabel(o), amount: o.amount, email: o.email, name: safeName(o.p_answers), shippingState: o.shipping_state,
      gift: !!o.gift, livemode: !!o.livemode, createdAt: o.created_at, updatedAt: o.updated_at,
      providerOrderId: o.provider_order_id, trackingCode: o.tracking_code,
    })),
  });
}

function safeName(answers) {
  try { return JSON.parse(answers || "{}").name || ""; } catch { return ""; }
}
