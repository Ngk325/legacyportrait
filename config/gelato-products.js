// Gelato product UIDs for every SKU we sell (master prompt 7.4: 3 sizes × (3 frame colors × assembled/not + print only) = 21).
// Fill each null from Gelato's Catalog API or dashboard for the exact product (framed poster, wood colors, NO white).
// `node scripts/check-gelato-products.mjs` fails while any UID is missing; gelato_draft/gelato_live refuse to build an order for a missing one.
import { SIZES, FRAME_COLORS } from "./products.js";

// key: "print:11x14" or "framed:11x14:dark_wood:assembled" / "framed:11x14:dark_wood:flat"
export const GELATO_PRODUCT_UIDS = Object.fromEntries([
  ...SIZES.map((s) => [`print:${s}`, null]),
  ...SIZES.flatMap((s) => FRAME_COLORS.flatMap((c) => [[`framed:${s}:${c.id}:assembled`, null], [`framed:${s}:${c.id}:flat`, null]])),
]);

// US shipment methods: standard only for now (express hidden until Yara's test order proves a real speed gain, D4/D2).
export const GELATO_SHIPMENT_METHOD_UID = { standard: null };

export function skuKey(order) {
  const opt = typeof order.options === "string" ? JSON.parse(order.options || "{}") : (order.options || {});
  const product = order.product_type || order.product;
  if (product === "print") return `print:${order.size}`;
  if (product === "framed") return `framed:${order.size}:${opt.color || "wood"}:${opt.assembled ? "assembled" : "flat"}`;
  return null; // digital: nothing to print
}

export const missingGelatoUids = () => Object.entries(GELATO_PRODUCT_UIDS).filter(([, v]) => !v).map(([k]) => k);
