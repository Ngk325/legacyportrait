// Applying a refund to our records (from the Stripe webhook or the admin Refund button; whichever comes first does the work).
import { sendEmail, refundEmail } from "./mail.js";
import { logError } from "./util.js";

// full: the whole payment was refunded. Emails the customer once, when the order first becomes refunded.
export async function applyRefund(env, order, { full, amountCents, origin }) {
  const was = order.status;
  const stmts = [env.DB.prepare(`UPDATE orders SET status = CASE WHEN ? THEN 'refunded' ELSE status END, refunded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(full ? 1 : 0, order.id)];
  // a full refund also closes the downloads: the portrait goes back to approved (the print files need "paid")
  if (full) stmts.push(env.DB.prepare("UPDATE portraits SET status = 'approved', updated_at = datetime('now') WHERE id = ? AND status IN ('paid', 'delivered')").bind(order.portrait_id));
  await env.DB.batch(stmts);
  if (!full || was === "refunded" || !order.email) return;
  try {
    const p = await env.DB.prepare("SELECT answers FROM portraits WHERE id = ?").bind(order.portrait_id).first();
    const m = refundEmail({ name: JSON.parse(p?.answers || "{}").name, orderId: order.id, amountCents: amountCents ?? order.amount, homeUrl: origin + "/" });
    await sendEmail(env, { to: order.email, ...m, template: "refund", portraitId: order.portrait_id, orderId: order.id, kind: "transactional" });
  } catch (e) { await logError(env, "email", e, { portraitId: order.portrait_id, detail: { order: order.id } }); }
}
