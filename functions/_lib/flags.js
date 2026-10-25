// Feature flags and the LIVE_MODE gate (hard rule 1).
// Live mode needs BOTH: the LIVE_MODE env var set to "true" (Nick sets it in Cloudflare) AND the admin toggle
// (config.live_mode = "on"). Either one off means test mode: Stripe test keys, Gelato draft/manual.

export async function getConfig(env, key) {
  try {
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = ?").bind(key).first();
    return row ? row.value : null;
  } catch {
    return null; // table missing (migration 0002 not applied yet) counts as "not set"
  }
}

export async function setConfig(env, key, value) {
  await env.DB.prepare("INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, String(value)).run();
}

export async function isLiveMode(env) {
  if (String(env.LIVE_MODE || "").toLowerCase() !== "true") return false;
  return (await getConfig(env, "live_mode")) === "on";
}

const FULFILLMENT_MODES = ["manual", "gelato_draft", "gelato_live"];

export function flags(env) {
  const mode = String(env.FULFILLMENT_MODE || "manual");
  return {
    fulfillmentMode: FULFILLMENT_MODES.includes(mode) ? mode : "manual",
    stripeTaxEnabled: String(env.STRIPE_TAX_ENABLED || "").toLowerCase() === "true", // off: prices include tax (Nick)
    turnstile: !!env.TURNSTILE_SECRET,
  };
}
