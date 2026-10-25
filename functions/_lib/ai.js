// One way to call the AI providers for every job (interview, article, fact check):
// Anthropic first, Gemini as the silent backup, every call costed and logged in ai_calls,
// and a per-portrait spend cap checked before each call.

import { MODELS, EFFORT, LIMITS, costUsd } from "../../config/ai.js";

const isRealKey = (k) => {
  k = String(k || "");
  return k.length > 20 && !/^placeholder/i.test(k) && !/^sk-ant-(xxx|placeholder)/i.test(k);
};
export const hasAnthropicKey = (env) => isRealKey(env.ANTHROPIC_API_KEY);
export const hasGeminiKey = (env) => isRealKey(env.GEMINI_API_KEY);
export const hasRealKey = (env) => hasAnthropicKey(env) || hasGeminiKey(env); // "is any AI writer connected?"

export function providerOrder(env) {
  const list = [];
  if (hasAnthropicKey(env)) list.push("anthropic");
  if (hasGeminiKey(env)) list.push("gemini");
  return list;
}

export class ProviderError extends Error {
  constructor(message, { retry = false } = {}) { super(message); this.retry = retry; }
}
export class BudgetError extends Error {}

// Model for a job; the article model can be overridden by the ANTHROPIC_MODEL / GEMINI_MODEL vars.
function modelFor(env, job, provider) {
  if (job === "article" && provider === "anthropic" && env.ANTHROPIC_MODEL) return env.ANTHROPIC_MODEL;
  if (job === "article" && provider === "gemini" && env.GEMINI_MODEL) return env.GEMINI_MODEL;
  return MODELS[job][provider];
}

async function callAnthropic(env, job, { system, user, schema, maxTokens }) {
  const model = modelFor(env, job, "anthropic");
  const body = {
    model,
    max_tokens: maxTokens,
    // the long, fixed system prompt is cached: rewrites and interview turns re-read it at a tenth of the price
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: EFFORT[job] || "medium", ...(schema ? { format: { type: "json_schema", schema } } : {}) },
  };
  // ANTHROPIC_API_BASE is only for local tests against a fake server (scripts/mock-ai.mjs)
  const res = await fetch((env.ANTHROPIC_API_BASE || "https://api.anthropic.com") + "/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new ProviderError("Anthropic key rejected");
    if (res.status === 404) throw new ProviderError(`Anthropic model "${model}" not found`);
    throw new ProviderError(`Anthropic HTTP ${res.status} ${text.slice(0, 160)}`, { retry: res.status >= 500 || res.status === 429 || res.status === 529 });
  }
  const data = await res.json();
  const u = data.usage || {};
  const usage = { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 };
  if (data.stop_reason === "refusal") throw Object.assign(new ProviderError("Anthropic declined the request"), { usage, model });
  if (data.stop_reason === "max_tokens") throw Object.assign(new ProviderError("Anthropic reply was cut off", { retry: true }), { usage, model });
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, model, usage };
}

async function callGemini(env, job, { system, user, maxTokens }) {
  const model = modelFor(env, job, "gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const headers = { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY };
  const full = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: maxTokens } };
  // plain version used if the model rejects the JSON-mode or system-instruction fields
  const plain = { contents: [{ role: "user", parts: [{ text: system + "\n\n" + user }] }], generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens } };
  let res = await fetch(url, { method: "POST", headers, body: JSON.stringify(full) });
  if (res.status === 400) res = await fetch(url, { method: "POST", headers, body: JSON.stringify(plain) });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new ProviderError("Gemini key rejected");
    if (res.status === 404) throw new ProviderError(`Gemini model "${model}" not found`);
    throw new ProviderError(`Gemini HTTP ${res.status} ${text.slice(0, 160)}`, { retry: res.status >= 500 || res.status === 429 });
  }
  const data = await res.json();
  const m = data.usageMetadata || {};
  const cached = m.cachedContentTokenCount || 0;
  // thinking tokens are billed as output
  const usage = { in: Math.max(0, (m.promptTokenCount || 0) - cached), out: (m.candidatesTokenCount || 0) + (m.thoughtsTokenCount || 0), cacheRead: cached, cacheWrite: 0 };
  const cand = (data.candidates || [])[0];
  const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("");
  if (!text) throw Object.assign(new ProviderError("Gemini returned no text" + (data.promptFeedback && data.promptFeedback.blockReason ? " (" + data.promptFeedback.blockReason + ")" : ""), { retry: true }), { usage, model });
  return { text, model, usage };
}

const CALLERS = { anthropic: callAnthropic, gemini: callGemini };

export async function recordCall(env, { portraitId, purpose, provider, model, usage, ok, error }) {
  const u = usage || {};
  try {
    await env.DB.prepare("INSERT INTO ai_calls (portrait_id, purpose, provider, model, tokens_in, tokens_out, tokens_cached, cost_usd, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(portraitId || null, purpose, provider, model || null, u.in || 0, u.out || 0, (u.cacheRead || 0) + (u.cacheWrite || 0), costUsd(model, u), ok ? 1 : 0, error ? String(error).slice(0, 300) : null).run();
  } catch { /* ai_calls table missing: never break a draft over bookkeeping */ }
}

export async function spentUsd(env, portraitId) {
  try {
    const row = await env.DB.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_calls WHERE portrait_id = ?").bind(portraitId).first();
    return Number(row?.total || 0);
  } catch { return 0; }
}

export function budgetUsd(env) {
  const v = Number(env.MAX_AI_COST_USD);
  return Number.isFinite(v) && v > 0 ? v : LIMITS.maxCostUsdPerPortrait;
}

// nextCallUsd: the worst case for the call about to be made, so a portrait just under the cap can't overshoot it
export async function assertBudget(env, portraitId, nextCallUsd = 0) {
  if (!portraitId) return;
  if ((await spentUsd(env, portraitId)) + nextCallUsd > budgetUsd(env)) throw new BudgetError("AI spend cap reached for this portrait");
}

// Upper bound for one call: input estimated generously from its length (about 3 characters per token), full output allowance.
export const worstCaseUsd = (model, chars, maxTokens) => costUsd(model, { in: Math.ceil(chars / 3), out: maxTokens });

export function extractJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON in response");
  return JSON.parse(t.slice(start, end + 1));
}

// Ask for a JSON object, trying each provider (up to 3 tries each, retrying server errors and unusable answers).
// check(parsed) returns a list of problems; an empty list accepts the answer.
// Returns { data, provider, model, fallbackFrom }. Throws BudgetError, or Error with .failures when nothing worked.
export async function runJson(env, { job, portraitId, system, user, schema = null, maxTokens = 4096, check = () => [] }) {
  const failures = [];
  for (const provider of providerOrder(env)) {
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const content = attempt === 0 ? user : user + `\n\nYour previous reply was invalid (${lastError}). Reply with only the JSON object described.`;
      await assertBudget(env, portraitId, worstCaseUsd(modelFor(env, job, provider), system.length + content.length, maxTokens));
      let out;
      try {
        out = await CALLERS[provider](env, job, { system, user: content, schema, maxTokens });
      } catch (e) {
        lastError = e.message;
        await recordCall(env, { portraitId, purpose: job, provider, model: e.model || modelFor(env, job, provider), usage: e.usage, ok: false, error: e.message });
        if (e instanceof ProviderError && e.retry) continue;
        break; // key problems, wrong model name, refusals, network errors: try the next provider
      }
      let parsed, problems;
      try {
        parsed = extractJson(out.text);
        problems = check(parsed);
      } catch (e) {
        problems = [e.message];
      }
      await recordCall(env, { portraitId, purpose: job, provider, model: out.model, usage: out.usage, ok: !problems.length, error: problems.length ? problems.join(", ") : null });
      if (!problems.length) return { data: parsed, provider, model: out.model, fallbackFrom: failures };
      lastError = "missing or invalid: " + problems.join(", ");
    }
    failures.push({ provider, reason: String(lastError || "no usable answer").slice(0, 200) });
  }
  const e = new Error("No AI provider produced a usable answer.");
  e.failures = failures;
  throw e;
}
