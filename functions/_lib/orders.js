// Order helpers shared by the order and (WP4) checkout endpoints.
import { cleanText } from "./prompt.js";
import { PRODUCTS, SIZES, FRAME_COLORS, priceCents } from "../../config/products.js";

// Check a format choice from the browser against config/products.js and price it.
// Returns the clean choice with amount (cents), or { error } with a customer-facing message.
export function validateChoice(b) {
  const product = String(b.product || "");
  const p = PRODUCTS[product];
  if (!p) return { error: "Please choose a format." };
  const size = p.physical ? String(b.size || "") : null;
  if (p.physical && !SIZES.includes(size)) return { error: "Please choose a size." };
  const color = p.colors ? String(b.color || "") : null;
  if (p.colors && !FRAME_COLORS.some((c) => c.id === color)) return { error: "Please choose a frame color." };
  const assembled = !!(p.assembly && b.assembled === true);
  const gift = b.gift === true;
  const giftRecipient = gift ? cleanText(b.giftRecipient || "", 80).trim() : "";
  const giftMessage = gift ? cleanText(b.giftMessage || "", 200).trim() : "";
  const amount = priceCents({ product, size, assembled });
  if (amount == null) return { error: "That combination isn't available." };
  return { product, size, color, assembled, gift, giftRecipient, giftMessage, amount };
}


const SIZE_TEXT = { "8x10": "8 × 10 in", "11x14": "11 × 14 in", "16x20": "16 × 20 in" };
const COLOR_TEXT = Object.fromEntries(FRAME_COLORS.map((c) => [c.id, c.label.toLowerCase()]));

// "Framed print, 11 × 14 in, black frame, ready to hang" (shown in Stripe Checkout and on receipts)
export function orderLabel(o) {
  const opt = typeof o.options === "string" ? JSON.parse(o.options || "{}") : (o.options || {});
  const product = o.product_type || o.product;
  if (product === "digital") return "Digital portrait (PDF and image)";
  if (product === "print") return `Print only, ${SIZE_TEXT[o.size]}`;
  return `Framed print, ${SIZE_TEXT[o.size]}, ${COLOR_TEXT[opt.color] || "wood"} frame, ${opt.assembled ? "ready to hang" : "assemble yourself"}`;
}
