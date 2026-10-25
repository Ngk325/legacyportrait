import { err, getPortrait, logError } from "../../../_lib/util.js";
import { isTeam } from "../../../_lib/auth.js";
import { buildRenderData } from "../../../_lib/render.js";
import { renderPrint, SIZES } from "../../../_lib/print.js";

// GET /api/portraits/:id/print?size=11x14&format=pdf|png
// Only for paid orders (customer download / Gelato file) or the team (ADMIN_TOKEN header or ?token=).
// Results are cached in R2 so each file is rendered once (Browser Run time is limited).
// Bump the "v2" in the key when the rendering itself changes, so old files are not served.
export async function onRequestGet({ env, params, request }) {
  const url = new URL(request.url);
  const size = url.searchParams.get("size") || "11x14";
  const format = (url.searchParams.get("format") || "pdf").toLowerCase();
  if (!SIZES[size]) return err(400, "Size must be one of " + Object.keys(SIZES).join(", ") + ".");
  if (!["pdf", "png"].includes(format)) return err(400, "Format must be pdf or png.");

  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that portrait.");

  const paid = ["paid", "delivered"].includes(p.status);
  if (!paid && !isTeam(env, request)) return err(403, "The print file is available after the order is paid.");
  if (!p.edited || !p.edited.body_paragraphs?.length) return err(409, "This portrait has no approved text yet.");

  const stamp = (p.updated_at || "").replace(/\D/g, "");
  const key = `prints/v2/${p.id}/${stamp}-${size}.${format}`;
  const headers = (type) => ({ "content-type": type, "cache-control": "private, no-store", "x-robots-tag": "noindex", "content-disposition": `attachment; filename="legacy-portrait-${size}.${format}"` });

  const cached = await env.PHOTOS.get(key);
  if (cached) return new Response(cached.body, { headers: headers(cached.httpMetadata?.contentType || "application/octet-stream") });

  if (!env.BROWSER) return err(503, "Print rendering isn't switched on yet (Browser Run binding missing).");
  try {
    const out = await renderPrint(env, url.origin, buildRenderData(p), size, format);
    await env.PHOTOS.put(key, out.body, { httpMetadata: { contentType: out.type }, customMetadata: { fitOk: String(out.fit?.ok), bodyPt: String(out.fit?.bodyPt) } });
    return new Response(out.body, { headers: { ...headers(out.type), "x-fit-ok": String(out.fit?.ok), "x-body-pt": String(out.fit?.bodyPt), "x-browser": out.how } });
  } catch (e) {
    await logError(env, "print", e, { portraitId: p.id, detail: { size, format } });
    return err(502, "We couldn't make the print file just now. Please try again in a minute.", { detail: String(e.message || e).slice(0, 200) });
  }
}
