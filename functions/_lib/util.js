// Shared helpers for the Pages Functions.

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export const err = (status, message, extra = {}) => json({ error: message, ...extra }, status);

export function newId(bytes = 16) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const LIMITS = { field: 4000, detail: 8000, paste: 12000, photos: 3, photoBytes: 8 * 1024 * 1024, regenerations: 5 };

// Trim and cap every string in the answers object; drop anything that is not a string/bool/plain object.
export function cleanAnswers(input) {
  const out = {};
  const walk = (src, dst, depth = 0) => {
    for (const [k, v] of Object.entries(src || {})) {
      if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
      if (typeof v === "string") dst[k] = v.trim().slice(0, k === "paste" ? LIMITS.paste : LIMITS.detail);
      else if (typeof v === "boolean") dst[k] = v;
      else if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) { dst[k] = {}; walk(v, dst[k], depth + 1); }
    }
  };
  walk(input, out);
  return out;
}

export async function getPortrait(env, id) {
  if (!/^[a-f0-9]{32}$/.test(id || "")) return null;
  const row = await env.DB.prepare("SELECT * FROM portraits WHERE id = ?").bind(id).first();
  if (!row) return null;
  return {
    ...row,
    answers: JSON.parse(row.answers || "{}"),
    generated: row.generated ? JSON.parse(row.generated) : null,
    edited: row.edited ? JSON.parse(row.edited) : null,
    photos: JSON.parse(row.photos || "[]"),
  };
}

export async function verifyTurnstile(env, request, token) {
  if (!env.TURNSTILE_SECRET) return true; // not configured yet (local dev)
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token || "", remoteip: request.headers.get("cf-connecting-ip") || "" });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}
