import { json, err, logError } from "../../_lib/util.js";
import { isTeam } from "../../_lib/auth.js";
import { runRetention } from "../../_lib/retention.js";

// POST /api/admin/retention            dry run: what would be deleted
// POST /api/admin/retention?apply=1    delete (called daily by workers/retention-cron)
// &tests=1 also removes portraits the team tagged as tests (utm.test)
export async function onRequestPost({ env, request }) {
  if (!isTeam(env, request)) return err(401, "Team only.");
  const url = new URL(request.url);
  try {
    const report = await runRetention(env, { apply: url.searchParams.get("apply") === "1", includeTests: url.searchParams.get("tests") === "1" });
    return json(report);
  } catch (e) {
    await logError(env, "retention", e);
    return err(500, "Retention run failed: " + String(e.message || e).slice(0, 200));
  }
}
