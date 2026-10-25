import { test } from "node:test";
import assert from "node:assert/strict";
import { nextOrderBy, missedHoliday, endOfDayNewYork, minusDays, HOLIDAYS } from "../config/holidays.js";

const at = (iso) => new Date(iso);

test("order-by is holiday minus 15 days, matching Appendix C", () => {
  const ob = (id) => minusDays(HOLIDAYS.find((h) => h.id === id).date, 15);
  assert.equal(ob("christmas-2026"), "2026-12-10");
  assert.equal(ob("hanukkah-2026"), "2026-11-19");
  assert.equal(ob("orthodox-christmas-2027"), "2026-12-23");
  assert.equal(ob("valentines-2027"), "2027-01-30");
  assert.equal(ob("mothers-day-2027"), "2027-04-24");
  assert.equal(ob("fathers-day-2027"), "2027-06-05");
});

test("cut-off is 23:59:59 New York time, in both EST and EDT", () => {
  assert.equal(endOfDayNewYork("2026-12-10").toISOString(), "2026-12-11T04:59:59.000Z"); // EST, UTC-5
  assert.equal(endOfDayNewYork("2027-06-05").toISOString(), "2027-06-06T03:59:59.000Z"); // EDT, UTC-4
  // DST edges: 2026-11-01 (fall back) and 2027-03-14 (spring forward)
  assert.equal(endOfDayNewYork("2026-11-01").toISOString(), "2026-11-02T04:59:59.000Z");
  assert.equal(endOfDayNewYork("2027-03-14").toISOString(), "2027-03-15T03:59:59.000Z");
});

test("today (Oct 25) the next physical order-by is Thanksgiving, Nov 11", () => {
  const n = nextOrderBy(at("2026-10-25T12:00:00Z"), "physical");
  assert.equal(n.name, "Thanksgiving");
  assert.equal(n.orderBy, "2026-11-11");
});

test("Christmas: last minute of Dec 10 ET still counts, one second later it is gone", () => {
  assert.equal(nextOrderBy(at("2026-12-11T04:59:59Z"), "physical").id, "christmas-2026");
  const after = nextOrderBy(at("2026-12-11T05:00:00Z"), "physical");
  assert.equal(after.id, "kwanzaa-2026");
  assert.equal(after.orderBy, "2026-12-11");
});

test("after Kwanzaa's cut-off the next framed holiday is Orthodox Christmas (Dec 23)", () => {
  const n = nextOrderBy(at("2026-12-12T12:00:00Z"), "physical");
  assert.equal(n.id, "orthodox-christmas-2027");
  assert.equal(n.orderBy, "2026-12-23");
});

test("digital runs until the day before the holiday", () => {
  const n = nextOrderBy(at("2026-12-20T12:00:00Z"), "digital");
  assert.equal(n.id, "christmas-2026");
  assert.equal(n.orderBy, "2026-12-24");
});

test("missedHoliday names the holiday in the gift-card window and nothing outside it", () => {
  assert.equal(missedHoliday(at("2026-10-25T12:00:00Z")), null);
  assert.equal(missedHoliday(at("2026-12-15T12:00:00Z")).id, "christmas-2026");
  assert.equal(missedHoliday(at("2026-12-26T12:00:00Z")).id, "kwanzaa-2026"); // Christmas over; Kwanzaa cut-off was Dec 11
});

test("disabled holidays are skipped; no holidays left returns null", () => {
  const list = [{ id: "a", name: "A", date: "2026-11-26", enabled: false }, { id: "b", name: "B", date: "2026-12-25", enabled: true }];
  assert.equal(nextOrderBy(at("2026-10-25T12:00:00Z"), "physical", list).id, "b");
  assert.equal(nextOrderBy(at("2027-12-01T00:00:00Z"), "physical"), null);
});
