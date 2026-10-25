// Who may do what.
// - The team: ADMIN_TOKEN in the x-admin-token header or ?token= (Cloudflare Access can replace this later).
// - The customer: the draft id lets you READ a draft; CHANGING it needs the edit token, a cookie set on the
//   device that started the draft. A leaked link alone cannot overwrite (or re-approve) someone's portrait.

import { newId } from "./util.js";

export function isTeam(env, request) {
  const url = new URL(request.url);
  const supplied = request.headers.get("x-admin-token") || url.searchParams.get("token") || "";
  return !!env.ADMIN_TOKEN && supplied.length > 0 && timingSafeEqual(supplied, env.ADMIN_TOKEN);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
}

export const EDIT_COOKIE = "lp_edit";
const EDIT_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export const newEditToken = () => newId(24);

// Scoped to this draft's API path, so each draft has its own cookie and pages never see it.
export function editCookie(id, token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${EDIT_COOKIE}=${token}; Path=/api/portraits/${id}; Max-Age=${EDIT_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

export function suppliedEditToken(request) {
  return request.headers.get("x-edit-token") || readCookie(request, EDIT_COOKIE);
}

// true if this request may change portrait p. Drafts made before edit tokens existed (no hash) stay open.
export async function canEdit(env, request, p) {
  if (isTeam(env, request)) return true;
  if (!p.edit_token_hash) return true;
  const t = suppliedEditToken(request);
  return !!t && (await sha256Hex(t)) === p.edit_token_hash;
}

// (once draft emails exist in WP6, add: "or use the private link we emailed you")
export const LOCKED_MESSAGE = "This draft can only be changed on the device where it was started. Please open it there.";

// ---------- private links (WP2/WP6) ----------
// The "finish later" link carries an edit token derived from LINK_SECRET and the portrait id, so reminder emails can
// rebuild the same link later without the token ever being stored. Without LINK_SECRET, a random token is used and
// reminders can't include a link (they are skipped).
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg))), (x) => x.toString(16).padStart(2, "0")).join("");
}
export async function resumeToken(env, portraitId) {
  if (!env.LINK_SECRET) return null;
  return (await hmacHex(env.LINK_SECRET, `resume:${portraitId}`)).slice(0, 48);
}
export async function unsubscribeSig(env, customerId) {
  if (!env.LINK_SECRET) return null;
  return (await hmacHex(env.LINK_SECRET, `unsubscribe:${customerId}`)).slice(0, 32);
}
