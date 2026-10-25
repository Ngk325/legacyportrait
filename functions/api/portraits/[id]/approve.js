import { json, err, getPortrait } from "../../../_lib/util.js";
import { canEdit, LOCKED_MESSAGE } from "../../../_lib/auth.js";

// POST /api/portraits/:id/approve  { confirm: true }
// The customer confirms they have read the whole text. Required before checkout.
export async function onRequestPost({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  let body = {};
  try { body = await request.json(); } catch {}
  if (body.confirm !== true) return err(400, "Please confirm you have read the text.");
  if (!p.edited || !p.edited.body_paragraphs || !p.edited.body_paragraphs.length) return err(400, "There is no text to approve yet.");
  if (!p.photos.length) return err(400, "Please add at least one photo first.");
  if (!p.answers.rights) return err(400, "Please confirm you have the right to use these photos.");
  await env.DB.prepare("UPDATE portraits SET status = 'approved', approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(p.id).run();
  return json({ ok: true, status: "approved" });
}
