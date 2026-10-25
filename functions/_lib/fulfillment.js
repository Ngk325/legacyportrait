// Fulfillment (master prompt 7.4): one interface, three modes chosen by FULFILLMENT_MODE.
//   manual        the team places the order by hand in the Gelato dashboard from /admin (default)
//   gelato_draft  build the exact Gelato order body and store it; if GELATO_API_KEY is set, also send it
//                 to Gelato as orderType "draft" (a draft is never produced or charged until confirmed in Gelato)
//   gelato_live   send orderType "order", but only when the LIVE_MODE gate is fully on; otherwise it falls back to a draft
// Gelato API shape from dashboard.gelato.com/docs (orders v4); see docs/INTEGRATIONS.md for what is still [VERIFY].
import { flags, isLiveMode } from "./flags.js";
import { signedPrintUrl } from "./auth.js";
import { GELATO_PRODUCT_UIDS, GELATO_SHIPMENT_METHOD_UID, skuKey } from "../../config/gelato-products.js";
import { CURRENCY } from "../../config/products.js";

// a problem the team fixes (config, address): shown in admin as a plain 400, not logged as a crash
const problem = (message) => Object.assign(new Error(message), { userFacing: true });
const cut = (s, n) => String(s ?? "").trim().slice(0, n);

// "Mary Ann de la Cruz" -> { firstName: "Mary Ann de la", lastName: "Cruz" }; one word -> it goes in both
export function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

// Stripe address JSON (as stored by the webhook) -> Gelato shippingAddress
export function gelatoAddress(order) {
  const a = typeof order.shipping_address === "string" ? JSON.parse(order.shipping_address || "{}") : (order.shipping_address || {});
  const { firstName, lastName } = splitName(order.shipping_name);
  return {
    firstName: cut(firstName, 25), lastName: cut(lastName, 25),
    addressLine1: cut(a.line1, 35), ...(a.line2 ? { addressLine2: cut(a.line2, 35) } : {}),
    city: cut(a.city, 30), postCode: cut(a.postal_code, 15), state: cut(a.state, 35), country: a.country || "US",
    email: order.email || "", ...(a.phone ? { phone: cut(a.phone, 25) } : {}),
  };
}

// The exact POST /v4/orders body. Pure: everything it needs is passed in. Throws with a team-facing message.
export function buildGelatoOrder({ order, orderType, fileUrl, productUid, shipmentMethodUid }) {
  if (!productUid) throw problem(`No Gelato productUid for ${skuKey(order)} (config/gelato-products.js).`);
  if (!fileUrl) throw problem("No signed print-file URL (LINK_SECRET not set).");
  const shippingAddress = gelatoAddress(order);
  const missing = ["firstName", "addressLine1", "city", "postCode", "state", "email"].filter((k) => !shippingAddress[k]);
  if (missing.length) throw problem("Shipping address is missing: " + missing.join(", "));
  if (shippingAddress.country !== "US") throw problem("Only US addresses are shipped (D4).");
  return {
    orderType,
    orderReferenceId: order.id,
    customerReferenceId: order.customer_id || order.id, // an id, not the email (the address block already carries it)
    currency: (order.currency || CURRENCY).toUpperCase(),
    items: [{ itemReferenceId: `${order.id}-1`, productUid, files: [{ type: "default", url: fileUrl }], quantity: 1 }],
    ...(shipmentMethodUid ? { shipmentMethodUid } : {}),
    shippingAddress,
  };
}

// Prepare (and in gelato_* modes, possibly send) one paid physical order.
// Returns { mode, payload, sent, providerOrderId, orderType }; throws on a problem the team must fix.
export async function fulfill(env, origin, order) {
  const { fulfillmentMode: mode } = flags(env);
  if (mode === "manual") return { mode, payload: null, sent: false };
  const live = mode === "gelato_live" && (await isLiveMode(env));
  const orderType = live ? "order" : "draft";
  const payload = buildGelatoOrder({
    order, orderType,
    fileUrl: await signedPrintUrl(env, origin, order.portrait_id, order.size, "pdf", 7 * 86400),
    productUid: GELATO_PRODUCT_UIDS[skuKey(order)],
    shipmentMethodUid: GELATO_SHIPMENT_METHOD_UID.standard,
  });
  await env.DB.prepare("UPDATE orders SET fulfillment_payload = ?, provider = 'gelato', updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(payload), order.id).run();
  if (!env.GELATO_API_KEY) return { mode, payload, sent: false, orderType };

  // GELATO_API_BASE is only for local tests against a fake server
  const res = await fetch((env.GELATO_API_BASE || "https://order.gelatoapis.com") + "/v4/orders", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.GELATO_API_KEY },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gelato ${res.status}: ${String(data.message || data.error || "order rejected").slice(0, 200)}`);
  await env.DB.prepare(`UPDATE orders SET provider_order_id = ?, fulfillment_status = ?, status = CASE WHEN ? THEN 'placed' ELSE status END,
      placed_at = CASE WHEN ? THEN datetime('now') ELSE placed_at END, updated_at = datetime('now') WHERE id = ?`)
    .bind(data.id || null, data.fulfillmentStatus || orderType, live ? 1 : 0, live ? 1 : 0, order.id).run();
  return { mode, payload, sent: true, providerOrderId: data.id || null, orderType };
}
