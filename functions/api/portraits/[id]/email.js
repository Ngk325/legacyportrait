import { json, err, getPortrait, newId, logError } from "../../../_lib/util.js";
import { canEdit, LOCKED_MESSAGE, resumeToken, newEditToken, sha256Hex, editCookie, unsubscribeSig } from "../../../_lib/auth.js";
import { sendEmail, draftEmail } from "../../../_lib/mail.js";

// POST /api/portraits/:id/email { email, marketing }
// "Save your progress": links the draft to an email address and sends a private link to finish on any device.
// The draft's edit token becomes the link's token (this device gets it as its cookie too, so nothing changes here).
export async function onRequestPost({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  let body = {};
  try { body = await request.json(); } catch {}
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err(400, "Please check the email address.");
  const marketing = body.marketing === true;

  let customer = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(email).first();
  if (!customer) {
    customer = { id: newId(12) };
    await env.DB.prepare("INSERT INTO customers (id, email, marketing_opt_in) VALUES (?, ?, ?)").bind(customer.id, email, marketing ? 1 : 0).run();
  } else if (marketing) {
    await env.DB.prepare("UPDATE customers SET marketing_opt_in = 1 WHERE id = ?").bind(customer.id).run();
  }
  // a reminder link the server can rebuild later (needs LINK_SECRET), else a one-off random token
  const token = (await resumeToken(env, p.id)) || newEditToken();
  await env.DB.prepare("UPDATE portraits SET email = ?, customer_id = ?, edit_token_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(email, customer.id, await sha256Hex(token), p.id).run();

  const origin = new URL(request.url).origin;
  const url = `${origin}/create?id=${p.id}&t=${token}`;
  const sig = await unsubscribeSig(env, customer.id);
  const unsubscribeUrl = sig ? `${origin}/api/unsubscribe?c=${customer.id}&s=${sig}` : null;
  let mail = { sent: false, status: "skipped" };
  try {
    const m = draftEmail("saved", { name: p.answers.name, url, unsubscribeUrl });
    mail = await sendEmail(env, { to: email, ...m, template: "saved", portraitId: p.id, unsubscribeUrl, kind: "transactional" });
  } catch (e) { await logError(env, "email", e, { portraitId: p.id }); }

  const res = json({ ok: true, emailed: mail.sent, link: url });
  res.headers.append("set-cookie", editCookie(p.id, token, request));
  return res;
}
