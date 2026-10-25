// Offer and prices (master prompt D2). Amounts are US cents, tax included. Logic reads these; never hard-code a price.
// Every physical product includes the digital file, so there is no separate digital add-on at checkout.

export const CURRENCY = "usd";
export const SIZES = ["8x10", "11x14", "16x20"];
export const FRAME_COLORS = [
  { id: "wood", label: "Wood" },
  { id: "dark_wood", label: "Dark wood" },
  { id: "black", label: "Black" },
];
export const ASSEMBLY_CENTS = 1500; // "Ready to hang (+$15)"
export const DIGITAL_VALUE_CENTS = 1900; // shown as "Includes the digital file ($19 value)"

export const PRODUCTS = {
  digital: { label: "Digital portrait", physical: false, prices: { any: 1900 } },
  print: { label: "Print only (no frame)", physical: true, prices: { "8x10": 3900, "11x14": 4900, "16x20": 6900 } },
  framed: { label: "Framed print", physical: true, prices: { "8x10": 7900, "11x14": 10900, "16x20": 14900 }, colors: true, assembly: true },
};

export const HERO = { product: "framed", size: "11x14", assembled: true }; // "Most popular"

// Price in cents for one configuration, or null if the configuration does not exist.
export function priceCents({ product, size, assembled = false } = {}) {
  const p = PRODUCTS[product];
  if (!p) return null;
  if (!p.physical) return p.prices.any;
  const base = p.prices[size];
  if (base == null) return null;
  return base + (p.assembly && assembled ? ASSEMBLY_CENTS : 0);
}
