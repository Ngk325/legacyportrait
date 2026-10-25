import { json } from "../_lib/util.js";
import { BRAND } from "../../config/brand.js";
import { nextOrderBy, missedHoliday } from "../../config/holidays.js";
import { isLiveMode } from "../_lib/flags.js";

// GET /api/config: what the pages need to know (brand, Turnstile site key, order-by dates, test/live).
export async function onRequestGet({ env }) {
  const now = new Date();
  const pick = (x) => (x ? { name: x.name, holidayDate: x.holidayDate, orderBy: x.orderBy } : null);
  return json({
    brand: { company: BRAND.company, product: BRAND.product },
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    liveMode: await isLiveMode(env),
    orderBy: { physical: pick(nextOrderBy(now, "physical")), digital: pick(nextOrderBy(now, "digital")), missed: missedHoliday(now) },
  });
}
