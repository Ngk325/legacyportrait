import { json } from "../_lib/util.js";
import { PRODUCTS, SIZES, FRAME_COLORS, ASSEMBLY_CENTS, DIGITAL_VALUE_CENTS, HERO, CURRENCY } from "../../config/products.js";
import { nextOrderBy, missedHoliday, PHYSICAL_LEAD_DAYS } from "../../config/holidays.js";

// "today in New York" plus n days, as YYYY-MM-DD
function nyDatePlus(now, days) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// GET /api/products: the offer (from config/products.js) plus the dates the product page shows.
export async function onRequestGet() {
  const now = new Date();
  const pick = (x) => (x ? { name: x.name, holidayDate: x.holidayDate, orderBy: x.orderBy } : null);
  return json({
    currency: CURRENCY, products: PRODUCTS, sizes: SIZES, frameColors: FRAME_COLORS,
    assemblyCents: ASSEMBLY_CENTS, digitalValueCents: DIGITAL_VALUE_CENTS, hero: HERO,
    orderBy: { physical: pick(nextOrderBy(now, "physical")), digital: pick(nextOrderBy(now, "digital")), missed: missedHoliday(now) },
    // conservative: the same lead time the order-by dates use (Gelato worst case + review + carrier buffer)
    estimatedArrival: nyDatePlus(now, PHYSICAL_LEAD_DAYS),
  });
}
