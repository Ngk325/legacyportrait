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

