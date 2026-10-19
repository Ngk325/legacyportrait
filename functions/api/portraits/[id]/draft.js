import { json, err, getPortrait, LIMITS } from "../../../_lib/util.js";
import { generateDraft, hasRealKey, supportedLength } from "../../../_lib/draft.js";

// POST /api/portraits/:id/draft  { notes?: string }
// First call writes a draft. Later calls with notes are rewrites and count against the limit of 5.
export async function onRequestPost({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  if (["paid", "delivered"].includes(p.status)) return err(409, "This portrait has already been ordered.");
  let body = {};
  try { body = await request.json(); } catch {}
  const a = p.answers;
  if (!a.name || !a.relationship) return err(400, "Please add the ancestor's name and your relationship to them first.");
  if (!a.byline) return err(400, "Please add the name for the byline.");

  const isRewrite = p.draft_count > 0;
  if (isRewrite && p.regen_count >= LIMITS.regenerations) return err(429, "You've used all five rewrites for this draft. You can still edit the text by hand.");

  const notes = String(body.notes || "").trim().slice(0, 1000);
  const extraPhotoCount = Math.max(0, Math.min(2, p.photos.length - 1));
  let result;
  try {
    result = await generateDraft(env, a, { extraPhotoCount, notes, previous: isRewrite ? p.generated : null });
  } catch (e) {
    return err(502, e.message || "The draft could not be generated.");
  }
  const d = result.draft;
  const edited = { subheadline: d.subheadline_options[0] || "", body_paragraphs: d.body_paragraphs, captions: d.captions };
  const generated = { ...d, mode: result.mode, model: result.model, at: new Date().toISOString() };
  await env.DB.prepare("UPDATE portraits SET generated = ?, edited = ?, status = 'draft', approved_at = NULL, draft_count = draft_count + 1, regen_count = regen_count + ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(generated), JSON.stringify(edited), isRewrite ? 1 : 0, p.id).run();
  return json({ generated, edited, mode: result.mode, regenLeft: Math.max(0, LIMITS.regenerations - p.regen_count - (isRewrite ? 1 : 0)), supportedLength: supportedLength(a), aiConnected: hasRealKey(env) });
}
