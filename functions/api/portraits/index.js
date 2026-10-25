import { json, err, newId, verifyTurnstile } from "../../_lib/util.js";
import { newEditToken, sha256Hex, editCookie } from "../../_lib/auth.js";

// POST /api/portraits: start a new draft. Returns the id that doubles as the "return to my draft" link,
// and sets the edit-token cookie: only this device can change the draft.
export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch {}
  if (!(await verifyTurnstile(env, request, body.turnstile))) return err(403, "Verification failed. Please reload and try again.");
  const id = newId(16);
  const utm = JSON.stringify(Object(body.utm) === body.utm ? Object.fromEntries(Object.entries(body.utm).slice(0, 8).map(([k, v]) => [String(k).slice(0, 30), String(v).slice(0, 100)])) : {});
  const token = newEditToken();
  await env.DB.prepare("INSERT INTO portraits (id, utm, edit_token_hash) VALUES (?, ?, ?)").bind(id, utm, await sha256Hex(token)).run();
  const res = json({ id }, 201);
  res.headers.append("set-cookie", editCookie(id, token, request));
  return res;
}
