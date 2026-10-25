import { json, err, getPortrait } from "../../../_lib/util.js";
import { sha256Hex, editCookie } from "../../../_lib/auth.js";

// POST /api/portraits/:id/claim  { token }
// Opens a draft for editing on another device, from a private link that carries the edit token (?t=...).
// The token is checked against the stored hash and then kept as this device's cookie.
export async function onRequestPost({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  let body = {};
  try { body = await request.json(); } catch {}
  const token = String(body.token || "");
  if (!p.edit_token_hash || !/^[a-f0-9]{48}$/.test(token) || (await sha256Hex(token)) !== p.edit_token_hash) {
    return err(403, "That private link isn't valid for this draft.");
  }
  const res = json({ ok: true });
  res.headers.append("set-cookie", editCookie(p.id, token, request));
  return res;
}
