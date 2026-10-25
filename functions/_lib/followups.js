// Follow-up emails for drafts people started and left (master prompt 5, "Recovery loops").
// - draft with an email address: reminders after 24 h, 72 h and 7 days without activity
// - approved but not paid: reminders after 30 minutes and 24 hours
// Each reminder is sent once per portrait, in order; activity resets the clock (it is measured from the last change).
// Never sent after payment or unsubscribe, or to drafts older than 30 days (those are deleted by retention).

import { draftEmail, sendEmail, mailConfigured } from "./mail.js";
import { resumeToken, unsubscribeSig } from "./auth.js";
import { nextOrderBy } from "../../config/holidays.js";
import { BRAND } from "../../config/brand.js";

const H = 3600e3;
export const SEQUENCES = {
  draft: [{ key: "remind-24h", after: 24 * H }, { key: "remind-72h", after: 72 * H }, { key: "remind-7d", after: 7 * 24 * H }],
  approved: [{ key: "preview-30m", after: 0.5 * H }, { key: "preview-24h", after: 24 * H }],
};

const parseTime = (s) => Date.parse(String(s).replace(" ", "T") + "Z"); // D1 datetime('now') is UTC without a zone

// Which reminder (if any) is due for one portrait. Pure, so it can be unit tested.
export function dueStep(status, updatedAt, sentKeys, now) {
  const seq = SEQUENCES[status];
  if (!seq) return null;
  const idle = now - parseTime(updatedAt);
  for (const step of seq) {
    if (sentKeys.has(step.key)) continue;
    return idle >= step.after ? step : null; // steps go in order: stop at the first one not yet sent
  }
  return null;
}

function storyLine(a) {
  const src = String(a.story || (a.detail || {}).legacy || "").trim();
  const first = (src.match(/[^.!?]+[.!?]?/) || [""])[0].trim();
  return first.length > 12 && first.length <= 160 ? first : "";
}

function longDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric" });
}

export async function runFollowUps(env, { origin, apply = false, now = Date.now(), limit = 300 } = {}) {
  const since = new Date(now - 30 * 24 * H).toISOString().replace("T", " ").slice(0, 19);
  const rows = (await env.DB.prepare(`SELECT p.id, p.status, p.answers, p.updated_at, p.email, c.id AS customer_id FROM portraits p
      JOIN customers c ON c.id = p.customer_id
      WHERE p.email IS NOT NULL AND p.status IN ('draft', 'approved') AND c.unsubscribed_at IS NULL AND p.updated_at > ?
      ORDER BY p.updated_at LIMIT ?`).bind(since, limit).all()).results;
  const report = { apply, mailConfigured: mailConfigured(env), checked: rows.length, due: [], sent: 0, skipped: [] };
  const ob = nextOrderBy(new Date(now), "physical");
  const orderBy = ob ? { name: ob.name, date: longDate(ob.orderBy) } : null;

  for (const r of rows) {
    const sent = new Set((await env.DB.prepare("SELECT template FROM email_log WHERE portrait_id = ? AND status = 'sent'").bind(r.id).all()).results.map((x) => x.template));
    const step = dueStep(r.status, r.updated_at, sent, now);
    if (!step) continue;
    report.due.push({ portrait: r.id, step: step.key });
    if (!apply) continue;
    if (!mailConfigured(env)) { report.skipped.push({ portrait: r.id, reason: "email not configured" }); continue; }
    if (!BRAND.businessAddress) { report.skipped.push({ portrait: r.id, reason: "business address not set (required in reminder emails)" }); continue; }

    const a = JSON.parse(r.answers || "{}");
    let url;
    if (r.status === "draft") {
      const token = await resumeToken(env, r.id);
      if (!token) { report.skipped.push({ portrait: r.id, reason: "LINK_SECRET not set" }); continue; }
      url = `${origin}/create?id=${r.id}&t=${token}`;
    } else url = `${origin}/preview?id=${r.id}`;
    const sig = await unsubscribeSig(env, r.customer_id);
    const unsubscribeUrl = sig ? `${origin}/api/unsubscribe?c=${r.customer_id}&s=${sig}` : null;
    const m = draftEmail(step.key, { name: a.name, line: storyLine(a), url, orderBy, unsubscribeUrl });
    const res = await sendEmail(env, { to: r.email, ...m, template: step.key, portraitId: r.id, unsubscribeUrl, kind: "reminder" });
    if (res.sent) report.sent++; else report.skipped.push({ portrait: r.id, reason: res.status });
  }
  return report;
}
