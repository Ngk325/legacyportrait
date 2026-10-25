import { json, err, logError } from "../../_lib/util.js";
import { isTeam } from "../../_lib/auth.js";
import { runFollowUps } from "../../_lib/followups.js";

// POST /api/admin/followups            dry run: which reminder emails are due
// POST /api/admin/followups?apply=1    send them (called hourly by workers/retention-cron)
export async function onRequestPost({ env, request }) {
  if (!isTeam(env, request)) return err(401, "Team only.");
  const url = new URL(request.url);
  try {
    return json(await runFollowUps(env, { origin: env.SITE_URL || url.origin, apply: url.searchParams.get("apply") === "1" }));
  } catch (e) {
    await logError(env, "followups", e);
    return err(500, "Follow-up run failed: " + String(e.message || e).slice(0, 200));
  }
}
