import { test } from "node:test";
import assert from "node:assert/strict";
import { dueStep } from "../functions/_lib/followups.js";
import { nextScripted, applyScripted, SCRIPT, DONE_QUESTION } from "../functions/_lib/interview.js";
import { draftEmail } from "../functions/_lib/mail.js";

const H = 3600e3, T0 = Date.parse("2026-10-25T12:00:00Z"), at = "2026-10-25 12:00:00";

test("draft reminders go out in order after 24 h, 72 h and 7 days of inactivity", () => {
  assert.equal(dueStep("draft", at, new Set(), T0 + 23 * H), null);
  assert.equal(dueStep("draft", at, new Set(), T0 + 25 * H).key, "remind-24h");
  assert.equal(dueStep("draft", at, new Set(["remind-24h"]), T0 + 30 * H), null, "72 h one waits");
  assert.equal(dueStep("draft", at, new Set(["remind-24h"]), T0 + 73 * H).key, "remind-72h");
  assert.equal(dueStep("draft", at, new Set(), T0 + 200 * H).key, "remind-24h", "never skips ahead");
  assert.equal(dueStep("draft", at, new Set(["remind-24h", "remind-72h", "remind-7d"]), T0 + 999 * H), null);
});

test("approved-not-paid reminders after 30 minutes and 24 hours; nothing for paid", () => {
  assert.equal(dueStep("approved", at, new Set(), T0 + 0.6 * H).key, "preview-30m");
  assert.equal(dueStep("approved", at, new Set(["preview-30m"]), T0 + 25 * H).key, "preview-24h");
  assert.equal(dueStep("paid", at, new Set(), T0 + 99 * H), null);
});

test("scripted interview asks every form question, saves answers, re-asks only required skips", () => {
  let a = {}; const t = [];
  const asked = [];
  for (let i = 0; i < SCRIPT.length + 2; i++) {
    const n = nextScripted(a, t);
    asked.push(n.field);
    if (n.done) break;
    const say = n.field === "byline" && !t.some((x) => x.field === "byline") ? "" : n.field === "story" ? "I don't know" : n.field === "pronoun" ? "she" : `answer for ${n.field}`;
    const r = applyScripted(a, n.field, say, n.question);
    a = r.answers; t.push({ field: n.field, skipped: r.skipped });
  }
  assert.deepEqual(asked.slice(0, SCRIPT.length), SCRIPT.map((s) => s.field), "all questions in order");
  assert.equal(asked[SCRIPT.length], "byline", "skipped required field asked again");
  assert.equal(a.story, undefined, "'I don't know' stores nothing");
  assert.equal(a.pronoun, "she");
  assert.equal(a.detail.character, "answer for character");
  assert.equal(nextScripted(a, t).question.startsWith("Last one") || nextScripted(a, t).done, true);
});

test("answers to an unknown question are kept in the pasted material, never lost", () => {
  const r = applyScripted({ paste: "Old note." }, null, "He loved the sea.", "What did he love?");
  assert.equal(r.answers.paste, "Old note.\n\nWhat did he love?\nHe loved the sea.");
});

test("questions use the name and pronoun given so far", () => {
  const n = nextScripted({ name: "Rose Haddad", relationship: "son", pronoun: "she" }, []);
  assert.equal(n.question, "When and where was Rose born? A year and a town is plenty.");
  assert.equal(nextScripted({ name: "A", relationship: "b", pronoun: "he", born: "x" }, []).question, "When and where did A pass away? You can skip this if he is still living or you'd rather not say.");
});

test("reminder emails have a link, plain text and the unsubscribe line", () => {
  const e = draftEmail("remind-72h", { name: "Elias Haddad", url: "https://x/c", orderBy: { name: "Christmas", date: "December 10" }, unsubscribeUrl: "https://x/u" });
  assert.match(e.text, /order by December 10/); assert.match(e.text, /https:\/\/x\/c/); assert.match(e.text, /Stop these emails: https:\/\/x\/u/);
  assert.match(e.html, /href="https:\/\/x\/c"/);
  assert.doesNotMatch(draftEmail("saved", { name: "<script>", url: "u" }).html, /<script>/, "names are escaped");
});
