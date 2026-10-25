import { json, err, getPortrait, logError } from "../../../_lib/util.js";
import { canEdit, LOCKED_MESSAGE } from "../../../_lib/auth.js";
import { BudgetError, providerOrder } from "../../../_lib/ai.js";
import { interviewTurn, nextScripted, applyScripted, FIRST_QUESTION } from "../../../_lib/interview.js";
import { LIMITS } from "../../../../config/ai.js";

const parse = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

// GET  /api/portraits/:id/interview: the saved conversation and the question waiting to be answered.
// POST /api/portraits/:id/interview { message }: answer it ("" = skip). Each answer is saved straight away into the
//      story fields (portraits.answers) and the conversation into portraits.interview, so a customer who leaves can
//      come back (or be reminded by email) and carry on where they stopped.
// The AI editor asks the questions when a provider works; otherwise (or if a call fails) the scripted interview
// asks the story form's questions one by one, so the chat always works.
export async function onRequest({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  const transcript = parse(p.interview);
  const last = transcript[transcript.length - 1];
  const pending = last ? { question: last.next, field: last.nextField ?? null, done: !!last.done } : { question: FIRST_QUESTION, field: "name", done: false };
  const view = (extra = {}) => ({ transcript: transcript.map(({ q, a }) => ({ q, a })), question: pending.question, done: pending.done, available: true, ...extra });

  if (request.method === "GET") return json(view());
  if (request.method !== "POST") return err(405, "Method not allowed.");
  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  if (["paid", "delivered"].includes(p.status)) return err(409, "This portrait has already been ordered.");

  let body = {};
  try { body = await request.json(); } catch {}
  const message = String(body.message || "");
  if (message.length > LIMITS.interviewMessageChars) return err(413, "That's a long answer. Please paste long material (an obituary, letters) in smaller parts, or use \"Review or edit your answers\".");

  // AI turns are capped; after that (or without AI) the scripted questions carry on
  const aiTurns = transcript.filter((t) => t.mode === "ai").length;
  let turn = null;
  if (providerOrder(env).length && aiTurns < LIMITS.interviewTurns && !pending.done) {
    try {
      turn = await interviewTurn(env, { portraitId: p.id, answers: p.answers, transcript, message, question: pending.question });
    } catch (e) {
      if (!(e instanceof BudgetError)) await logError(env, "interview", e, { portraitId: p.id, detail: e.failures || null });
      turn = null; // fall through to the scripted interview
    }
  }
  let skipped = false;
  if (!turn) {
    const s = applyScripted(p.answers, pending.field, message, pending.question);
    skipped = s.skipped;
    const n = nextScripted(s.answers, [...transcript, { field: pending.field, skipped }]);
    turn = { answers: s.answers, changed: s.changed, question: n.question, field: n.field, done: !!n.done, mode: "script" };
  }

  transcript.push({ q: pending.question, a: message.slice(0, LIMITS.interviewMessageChars), field: pending.field, skipped, mode: turn.mode, next: turn.question, nextField: turn.field ?? null, done: !!turn.done, at: new Date().toISOString() });
  // an answer after approval sends the portrait back to draft, like any other edit
  // the AI turn can take seconds; if the portrait was paid meanwhile, its answers are frozen
  const w = await env.DB.prepare("UPDATE portraits SET answers = ?, interview = ?, status = CASE WHEN status = 'approved' THEN 'draft' ELSE status END, approved_at = CASE WHEN status = 'approved' THEN NULL ELSE approved_at END, updated_at = datetime('now') WHERE id = ? AND status NOT IN ('paid', 'delivered')")
    .bind(JSON.stringify(turn.answers), JSON.stringify(transcript.slice(-80)), p.id).run();
  if (w.meta && w.meta.changes === 0) return err(409, "This portrait has already been ordered.");
  return json({ transcript: transcript.map(({ q, a }) => ({ q, a })), question: turn.question, done: !!turn.done, answers: turn.answers, changed: turn.changed, available: true });
}
