import { json, err } from "../../_lib/util.js";
import { isTeam } from "../../_lib/auth.js";
import { isLiveMode, flags } from "../../_lib/flags.js";

// GET /api/admin/stats?days=30            funnel, emails captured, AI cost, recent errors and emails
// GET /api/admin/stats?days=30&format=csv one row per day for the shared Google Sheet (master prompt 9.9)
// Portraits tagged as tests (utm.test) are left out. Revenue counts test-mode and live-mode payments separately.
export async function onRequestGet({ env, request }) {
  if (!isTeam(env, request)) return err(401, "Team only.");
  const url = new URL(request.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days"), 10) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const real = "json_extract(COALESCE(p.utm, '{}'), '$.test') IS NULL";
  const one = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const all = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results;

  const daily = await all(`
    WITH d AS (
      SELECT date(p.created_at) AS day, COUNT(*) AS starts, SUM(p.generated IS NOT NULL) AS drafts,
             SUM(p.approved_at IS NOT NULL OR p.status IN ('paid', 'delivered')) AS approved, SUM(p.email IS NOT NULL) AS emails
      FROM portraits p WHERE p.created_at >= ? AND ${real} GROUP BY 1),
    o AS (
      SELECT date(o.created_at) AS day, COUNT(*) AS checkouts,
             SUM(o.status NOT IN ('pending')) AS purchases,
             SUM(CASE WHEN o.status NOT IN ('pending', 'refunded') AND o.livemode = 1 THEN o.amount ELSE 0 END) AS revenue_live,
             SUM(CASE WHEN o.status NOT IN ('pending', 'refunded') AND o.livemode = 0 THEN o.amount ELSE 0 END) AS revenue_test,
             SUM(o.status = 'refunded') AS refunds
      FROM orders o JOIN portraits p ON p.id = o.portrait_id WHERE o.created_at >= ? AND ${real} GROUP BY 1),
    a AS (SELECT date(created_at) AS day, SUM(cost_usd) AS ai_usd, COUNT(*) AS ai_calls FROM ai_calls WHERE created_at >= ? GROUP BY 1)
    SELECT day, COALESCE(d.starts, 0) AS starts, COALESCE(d.drafts, 0) AS drafts, COALESCE(d.approved, 0) AS approved, COALESCE(d.emails, 0) AS emails,
           COALESCE(o.checkouts, 0) AS checkouts, COALESCE(o.purchases, 0) AS purchases, COALESCE(o.revenue_live, 0) AS revenue_live_cents,
           COALESCE(o.revenue_test, 0) AS revenue_test_cents, COALESCE(o.refunds, 0) AS refunds, ROUND(COALESCE(a.ai_usd, 0), 4) AS ai_usd, COALESCE(a.ai_calls, 0) AS ai_calls
    FROM (SELECT day FROM d UNION SELECT day FROM o UNION SELECT day FROM a) days
    LEFT JOIN d USING (day) LEFT JOIN o USING (day) LEFT JOIN a USING (day) ORDER BY day`, since, since, since);

  if (url.searchParams.get("format") === "csv") {
    const cols = ["day", "starts", "drafts", "approved", "emails", "checkouts", "purchases", "revenue_live_cents", "revenue_test_cents", "refunds", "ai_usd", "ai_calls"];
    const csv = [cols.join(","), ...daily.map((r) => cols.map((c) => r[c]).join(","))].join("\n") + "\n";
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="legacy-portrait-${since}-${days}d.csv"`, "cache-control": "no-store" } });
  }

  const sum = (k) => daily.reduce((n, r) => n + Number(r[k] || 0), 0);
  const byStatus = await all(`SELECT p.status, COUNT(*) AS n FROM portraits p WHERE ${real} GROUP BY 1`);
  const ordersByStatus = await all("SELECT status, COUNT(*) AS n FROM orders GROUP BY 1");
  const aiByPurpose = await all("SELECT purpose, provider, COUNT(*) AS calls, SUM(ok = 0) AS failed, ROUND(SUM(cost_usd), 4) AS usd FROM ai_calls WHERE created_at >= ? GROUP BY 1, 2 ORDER BY usd DESC", since);
  const aiPerPortrait = await one("SELECT ROUND(AVG(t), 4) AS avg_usd, ROUND(MAX(t), 4) AS max_usd FROM (SELECT SUM(cost_usd) AS t FROM ai_calls WHERE created_at >= ? AND portrait_id IS NOT NULL GROUP BY portrait_id)", since);
  const errors = await all("SELECT source, message, portrait_id, created_at FROM errors ORDER BY id DESC LIMIT 25");
  const emails = await all("SELECT template, status, COUNT(*) AS n FROM email_log WHERE created_at >= ? GROUP BY 1, 2 ORDER BY n DESC", since);
  const customers = await one("SELECT COUNT(*) AS n FROM customers");

  return json({
    days, since,
    mode: { liveMode: await isLiveMode(env), ...flags(env) },
    totals: { starts: sum("starts"), drafts: sum("drafts"), approved: sum("approved"), emails: sum("emails"), checkouts: sum("checkouts"), purchases: sum("purchases"),
      revenueLiveCents: sum("revenue_live_cents"), revenueTestCents: sum("revenue_test_cents"), refunds: sum("refunds"), aiUsd: Math.round(sum("ai_usd") * 10000) / 10000 },
    portraitsByStatus: byStatus, ordersByStatus, aiByPurpose, aiPerPortrait, emails, customers: customers?.n || 0, errors, daily,
  });
}
