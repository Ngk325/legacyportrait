import { json, err, getPortrait, cleanAnswers, LIMITS } from "../../../_lib/util.js";
import { supportedLength } from "../../../_lib/draft.js";
import { canEdit, LOCKED_MESSAGE } from "../../../_lib/auth.js";

const publicView = (p) => ({
  id: p.id, status: p.status, answers: p.answers, generated: p.generated, edited: p.edited,
  photos: p.photos.map((x, i) => ({ index: i, name: x.name, width: x.width, height: x.height })),
  regenLeft: Math.max(0, LIMITS.regenerations - p.regen_count), draftCount: p.draft_count,
  supportedLength: supportedLength(p.answers), approvedAt: p.approved_at, hasEmail: !!p.email,
});

export async function onRequestGet({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  return json({ ...publicView(p), canEdit: await canEdit(env, request, p) });
}

// PUT: autosave answers and/or the customer's edits. Locked once approved (edits after approval need a new approval).
export async function onRequestPut({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  if (["paid", "delivered"].includes(p.status)) return err(409, "This portrait has already been ordered.");
  let body;
  try { body = await request.json(); } catch { return err(400, "Invalid request."); }

  const answers = body.answers ? cleanAnswers(body.answers) : p.answers;
  let edited = p.edited;
  if (body.edited) {
    const e = body.edited;
    edited = {
      subheadline: String(e.subheadline || "").slice(0, 200),
      body_paragraphs: (Array.isArray(e.body_paragraphs) ? e.body_paragraphs : []).map((x) => String(x).slice(0, 4000)).filter((x) => x.trim()).slice(0, 40),
      captions: (Array.isArray(e.captions) ? e.captions : []).map((x) => String(x).slice(0, 160)).slice(0, 2),
    };
  }
  // any change after approval sends it back to draft so the customer must approve the final text again
  const status = p.status === "approved" ? "draft" : p.status;
  await env.DB.prepare("UPDATE portraits SET answers = ?, edited = ?, status = ?, approved_at = CASE WHEN ? = 'draft' THEN NULL ELSE approved_at END, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(answers), edited ? JSON.stringify(edited) : null, status, status, p.id).run();
  return json({ ok: true, status });
}
