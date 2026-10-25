// Scheduled jobs for the site. Pages Functions can't run on a schedule, so this tiny Worker calls the team-only
// endpoints: follow-up emails every hour, data retention once a day (07:17 UTC, about 3 a.m. in New York).
// Secrets: ADMIN_TOKEN (same as the Pages project). Var: SITE_URL.
async function call(env, path) {
  const res = await fetch(`${env.SITE_URL}${path}`, { method: "POST", headers: { "x-admin-token": env.ADMIN_TOKEN } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${body.slice(0, 300)}`); // shows in the Worker's logs and error metrics
  console.log(path, body.slice(0, 1000));
}

export default {
  async scheduled(event, env) {
    await call(env, "/api/admin/followups?apply=1");
    if (new Date(event.scheduledTime).getUTCHours() === 7) await call(env, "/api/admin/retention?apply=1");
  },
};
