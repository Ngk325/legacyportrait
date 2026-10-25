import { json, err } from "../../_lib/util.js";
import { isTeam } from "../../_lib/auth.js";
import { getConfig, setConfig, isLiveMode, flags } from "../../_lib/flags.js";

// GET  /api/admin/config: current switches.
// POST /api/admin/config { live_mode: "on" | "off" }: the admin half of the LIVE_MODE gate.
// Turning it on does nothing unless the LIVE_MODE env var is also "true" (set by Nick in Cloudflare).
export async function onRequest({ env, request }) {
  if (!isTeam(env, request)) return err(401, "Team only.");
  if (request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch {}
    if (!["on", "off"].includes(body.live_mode)) return err(400, 'live_mode must be "on" or "off".');
    await setConfig(env, "live_mode", body.live_mode);
  } else if (request.method !== "GET") {
    return err(405, "Method not allowed.");
  }
  return json({
    liveModeEnv: String(env.LIVE_MODE || "").toLowerCase() === "true",
    liveModeToggle: (await getConfig(env, "live_mode")) || "off",
    liveMode: await isLiveMode(env),
    ...flags(env),
  });
}
