import { json, err, getPortrait, logError } from "../../../_lib/util.js";
import { canEdit, LOCKED_MESSAGE } from "../../../_lib/auth.js";
import { BudgetError, providerOrder } from "../../../_lib/ai.js";
import { interviewTurn, FIRST_QUESTION } from "../../../_lib/interview.js";
import { LIMITS } from "../../../../config/ai.js";

const parse = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

// GET  /api/portraits/:id/interview: the transcript so far and the question to answer now.
// POST /api/portraits/:id/interview { message }: answer the current question ("" = skip). The answers (fact card)
//      are updated and returned, with the next question. The form stays the source of truth and can be edited any time.
export async function onRequest({ env, params, request }) {
  const p = await getPortrait(env, params.id);
  if (!p) return err(404, "We couldn't find that draft.");
  const transcript = parse(p.interview);
  const current = transcript.length ? transcript[transcript.length - 1].next : FIRST_QUESTION;
  const state = (extra = {}) => ({ transcript: transcript.map(({ q, a }) => ({ q, a })), question: current, turnsLeft: Math.max(0, LIMITS.interviewTurns - transcript.length), available: providerOrder(env).length > 0, ...extra });

  if (request.method === "GET") return json(state());
  if (request.method !== "POST") return err(405, "Method not allowed.");
  if (!(await canEdit(env, request, p))) return err(403, LOCKED_MESSAGE);
  if (["paid", "delivered"].includes(p.status)) return err(409, "This portrait has already been ordered.");
  if (!providerOrder(env).length) return err(503, "The chat isn't available right now. Please use the form below; it works just as well.");
  if (transcript.length >= LIMITS.interviewTurns) return json(state({ done: true, question: "Thank you, that's plenty for a lovely portrait. Let's choose the look." }));

  let body = {};
  try { body = await request.json(); } catch {}
  const message = String(body.message || "");
  if (message.length > LIMITS.interviewMessageChars) return err(413, "That's a long answer. Please paste long material (an obituary, letters) into the box under \"Add more detail\" instead.");

  let turn;
  try {
    turn = await interviewTurn(env, { portraitId: p.id, answers: p.answers, transcript, message });
  } catch (e) {
    if (e instanceof BudgetError) return err(429, "That's a lot of questions for one portrait. Please carry on with the form below.");
    await logError(env, "interview", e, { portraitId: p.id, detail: e.failures || null });
    return err(502, "Our editor couldn't reply just now. Your answers are saved. Try again in a minute, or carry on with the form below.");
  }
  transcript.push({ q: current, a: message.slice(0, LIMITS.interviewMessageChars), next: turn.question, at: new Date().toISOString() });
  // an interview answer after approval sends the portrait back to draft, like any other edit
  await env.DB.prepare("UPDATE portraits SET answers = ?, interview = ?, status = CASE WHEN status = 'approved' THEN 'draft' ELSE status END, approved_at = CASE WHEN status = 'approved' THEN NULL ELSE approved_at END, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(turn.answers), JSON.stringify(transcript), p.id).run();
  return json({ ...state(), transcript: transcript.map(({ q, a }) => ({ q, a })), question: turn.question, turnsLeft: Math.max(0, LIMITS.interviewTurns - transcript.length), answers: turn.answers, changed: turn.changed, coverage: turn.coverage, done: turn.done });
}
