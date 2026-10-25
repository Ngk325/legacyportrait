import { json, err, getPortrait, LIMITS, sniffImageType } from "../../../../_lib/util.js";
import { canEdit, LOCKED_MESSAGE } from "../../../../_lib/auth.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const BAD_FILE = "That file didn't work. Please try a JPG, PNG or iPhone photo under 8 MB.";

// POST   multipart "file" (+ width, height, name): add or replace photo n (0-2). The browser has already converted HEIC and resized.
// GET    streams the photo (the draft id acts as the access key).
// DELETE removes photo n and shifts the rest up.
export async function onRequest({ request, env, params }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 0 || n >= LIMITS.photos) return err(400, "Photo slot must be 0, 1 or 2.");
  const key = (i) => `photos/${p.id}/${i}`;

  if (request.method === "GET") {
    const obj = await env.PHOTOS.get(key(n));
    if (!obj) return err(404, "No photo in that slot.");
    return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "image/jpeg", "cache-control": "private, max-age=300", "x-robots-tag": "noindex" } });
  }

  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  if (["paid", "delivered"].includes(p.status)) return err(409, "This portrait has already been ordered.");

  if (request.method === "POST") {
    if (n > p.photos.length) return err(400, "Please fill the earlier photo slots first.");
    let form;
    try { form = await request.formData(); } catch { return err(400, "Invalid upload."); }
    const file = form.get("file");
    if (!file || typeof file === "string") return err(400, "No file received.");
    if (file.size > LIMITS.photoBytes) return err(413, "That photo is over 8 MB. Try a smaller version.");
    if (!file.size) return err(400, BAD_FILE);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type || !TYPES[type]) return err(415, BAD_FILE);
    const width = Math.max(1, Math.min(20000, parseInt(form.get("width"), 10) || 0));
    const height = Math.max(1, Math.min(20000, parseInt(form.get("height"), 10) || 0));
    await env.PHOTOS.put(key(n), bytes, { httpMetadata: { contentType: type }, customMetadata: { portrait: p.id, width: String(width), height: String(height) } });
    const photos = p.photos.slice();
    photos[n] = { name: String(form.get("name") || "photo").slice(0, 80), width, height, bytes: file.size, type };
    await env.DB.prepare("UPDATE portraits SET photos = ?, status = CASE WHEN status = 'approved' THEN 'draft' ELSE status END, approved_at = NULL, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(photos), p.id).run();
    return json({ ok: true, index: n, width, height }, 201);
  }

  if (request.method === "DELETE") {
    if (n >= p.photos.length) return json({ ok: true });
    // shift later photos up so slot 0 is always the main photo
    const photos = p.photos.slice();
    for (let i = n; i < photos.length - 1; i++) {
      const next = await env.PHOTOS.get(key(i + 1));
      if (next) await env.PHOTOS.put(key(i), next.body, { httpMetadata: next.httpMetadata, customMetadata: next.customMetadata });
    }
    await env.PHOTOS.delete(key(photos.length - 1));
    photos.splice(n, 1);
    await env.DB.prepare("UPDATE portraits SET photos = ?, status = CASE WHEN status = 'approved' THEN 'draft' ELSE status END, approved_at = NULL, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(photos), p.id).run();
    return json({ ok: true });
  }

  return err(405, "Method not allowed.");
}
