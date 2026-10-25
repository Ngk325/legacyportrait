// Daily retention trigger. Pages Functions can't run on a schedule, so this tiny Worker calls the
// team-only retention endpoint once a day. Secrets: ADMIN_TOKEN (same as the Pages project). Var: SITE_URL.
export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(`${env.SITE_URL}/api/admin/retention?apply=1`, { method: "POST", headers: { "x-admin-token": env.ADMIN_TOKEN } });
    const body = await res.text();
    if (!res.ok) throw new Error(`retention failed: ${res.status} ${body.slice(0, 300)}`); // shows in the Worker's logs and error metrics
    console.log("retention", body);
  },
};
