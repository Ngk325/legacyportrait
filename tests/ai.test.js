import { test } from "node:test";
import assert from "node:assert/strict";
import { runJson, BudgetError } from "../functions/_lib/ai.js";
import { generateDraft } from "../functions/_lib/draft.js";

// A tiny stand-in for D1 that records ai_calls inserts and answers the spend query.
function fakeDb(spent = 0) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind: (...args) => ({
          run: async () => { if (sql.startsWith("INSERT INTO ai_calls")) calls.push(args); },
          first: async () => ({ total: spent + calls.reduce((a, c) => a + c[7], 0) }),
        }),
      };
    },
  };
}
const KEYS = { ANTHROPIC_API_KEY: "sk-ant-test-key-long-enough-123", GEMINI_API_KEY: "gemini-test-key-long-enough-123" };
const ok = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

test("Anthropic out of credit (HTTP 400) falls back to Gemini, and both calls are logged", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("anthropic")) return new Response('{"error":{"message":"Your credit balance is too low"}}', { status: 400 });
    return ok({ candidates: [{ content: { parts: [{ text: '{"x":1}' }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100 } });
  });
  const DB = fakeDb();
  const r = await runJson({ ...KEYS, DB }, { job: "article", portraitId: "p1", system: "s", user: "u" });
  assert.equal(r.provider, "gemini");
  assert.deepEqual(r.data, { x: 1 });
  assert.equal(r.fallbackFrom[0].provider, "anthropic");
  assert.match(r.fallbackFrom[0].reason, /credit balance/);
  assert.equal(DB.calls.length, 2);
  assert.equal(DB.calls[0][8], 0, "failed Anthropic call logged as not ok");
  assert.equal(DB.calls[1][5], 300, "Gemini thinking tokens count as output");
});

test("both providers failing throws with the reasons for the team log", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("nope", { status: 401 }));
  await assert.rejects(runJson({ ...KEYS, DB: fakeDb() }, { job: "article", system: "s", user: "u" }), (e) => e.failures.length === 2);
});

test("spend cap stops calls before they are made", async (t) => {
  const f = t.mock.method(globalThis, "fetch", async () => ok({}));
  await assert.rejects(runJson({ ...KEYS, DB: fakeDb(0.5) }, { job: "interview", portraitId: "p1", system: "s", user: "u" }), BudgetError);
  assert.equal(f.mock.callCount(), 0);
});

test("unusable answers are retried, then the next provider is tried", async (t) => {
  let n = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    n++;
    if (String(url).includes("anthropic")) return ok({ stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "text", text: "not json" }] });
    return ok({ candidates: [{ content: { parts: [{ text: '{"x":2}' }] } }], usageMetadata: {} });
  });
  const r = await runJson({ ...KEYS, DB: fakeDb() }, { job: "factcheck", system: "s", user: "u" });
  assert.equal(r.provider, "gemini");
  assert.equal(n, 4, "3 Anthropic tries, then Gemini");
});

test("live mode never falls back to the sample draft", async () => {
  await assert.rejects(generateDraft({ DB: fakeDb() }, { name: "Elias" }, { allowSample: false }), /No AI provider/);
  const sample = await generateDraft({ DB: fakeDb() }, { name: "Elias Haddad", born: "1904" }, { allowSample: true });
  assert.equal(sample.mode, "sample");
});
