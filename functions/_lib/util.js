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

// Record a failure for the team (errors table). Never throws: logging must not break the request.
export async function logError(env, source, error, { portraitId = null, detail = null } = {}) {
  const message = String((error && error.message) || error || "").slice(0, 500);
  console.error(`[${source}]`, message, detail || "");
  try {
    await env.DB.prepare("INSERT INTO errors (source, message, detail, portrait_id) VALUES (?, ?, ?, ?)")
      .bind(source, message, detail == null ? null : String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 2000), portraitId).run();
  } catch { /* errors table missing (migration 0002 not applied) */ }
}

// What the bytes actually are (the browser's claimed type can be wrong or faked).
export function sniffImageType(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
