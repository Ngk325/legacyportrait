import { json, err, getPortrait } from "../../../_lib/util.js";
import { buildRenderData } from "../../../_lib/render.js";

// GET /api/portraits/:id/render: the JSON the newspaper template draws from (live preview). Watermarked until paid.
export async function onRequestGet({ env, params }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  return json(buildRenderData(p, { watermark: !["paid", "delivered"].includes(p.status) }));
}
