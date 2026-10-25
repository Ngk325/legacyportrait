// Holiday calendar and "order by" dates (master prompt Appendix C).
// Framed and print-only: order by = holiday - 15 days (11 days worst-case Gelato production + shipping,
// 2 days approval/review, 2 days carrier buffer). Digital and the printable gift card: until the day before.
// Cut-offs are the END of that day in New York (23:59:59 America/New_York).
// Shrink PHYSICAL_LEAD_DAYS only after a real Gelato test order proves faster delivery.

export const PHYSICAL_LEAD_DAYS = 15;
export const DIGITAL_LEAD_DAYS = 1;

export const HOLIDAYS = [
  { id: "thanksgiving-2026", name: "Thanksgiving", date: "2026-11-26", enabled: true },
  { id: "hanukkah-2026", name: "Hanukkah", date: "2026-12-04", enabled: true },
  { id: "christmas-2026", name: "Christmas", date: "2026-12-25", enabled: true },
  { id: "kwanzaa-2026", name: "Kwanzaa", date: "2026-12-26", enabled: true },
  { id: "orthodox-christmas-2027", name: "Orthodox Christmas", date: "2027-01-07", enabled: true },
  { id: "valentines-2027", name: "Valentine's Day", date: "2027-02-14", enabled: true },
  { id: "eid-al-fitr-2027", name: "Eid al-Fitr", date: "2027-03-09", enabled: true }, // moon sighting: verify in February
  { id: "easter-2027", name: "Easter", date: "2027-03-28", enabled: true },
  { id: "orthodox-easter-2027", name: "Orthodox Easter", date: "2027-05-02", enabled: true },
  { id: "mothers-day-2027", name: "Mother's Day", date: "2027-05-09", enabled: true },
  { id: "fathers-day-2027", name: "Father's Day", date: "2027-06-20", enabled: true },
];

// "2026-12-25" minus n days -> "2026-12-10" (calendar arithmetic, no time zones involved)
export function minusDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - n));
  return t.toISOString().slice(0, 10);
}

// The instant 23:59:59 on that day in New York (handles the EST/EDT switch).
export function endOfDayNewYork(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  for (const offset of [5, 4]) {
    const t = new Date(Date.UTC(y, m - 1, d, 23 + offset, 59, 59));
    const hour = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(t);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(t);
    if (hour === "23" && day === ymd) return t;
  }
  throw new Error("Could not place " + ymd + " in New York time");
}

export function orderByDate(holiday, kind) {
  return minusDays(holiday.date, kind === "digital" ? DIGITAL_LEAD_DAYS : PHYSICAL_LEAD_DAYS);
}

// The soonest holiday that can still be made for this kind ("physical" or "digital"), or null.
// { id, name, holidayDate, orderBy: "YYYY-MM-DD", cutoff: Date }
export function nextOrderBy(now = new Date(), kind = "physical", holidays = HOLIDAYS) {
  const list = holidays.filter((h) => h.enabled).slice().sort((a, b) => a.date.localeCompare(b.date));
  for (const h of list) {
    const orderBy = orderByDate(h, kind);
    const cutoff = endOfDayNewYork(orderBy);
    if (now <= cutoff) return { id: h.id, name: h.name, holidayDate: h.date, orderBy, cutoff };
  }
  return null;
}

// A holiday whose physical order-by has passed but which has not happened yet (the "gift card now" window), or null.
export function missedHoliday(now = new Date(), holidays = HOLIDAYS) {
  const list = holidays.filter((h) => h.enabled).slice().sort((a, b) => a.date.localeCompare(b.date));
  for (const h of list) {
    if (now > endOfDayNewYork(orderByDate(h, "physical")) && now <= endOfDayNewYork(h.date)) {
      return { id: h.id, name: h.name, holidayDate: h.date };
    }
  }
  return null;
}
