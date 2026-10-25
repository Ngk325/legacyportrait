// Fake Anthropic Messages API for local tests of the AI flows (never used in production).
// Run: node scripts/mock-ai.mjs 8799, then set ANTHROPIC_API_BASE=http://127.0.0.1:8799 and a dummy ANTHROPIC_API_KEY in .dev.vars.
// Behaviour: the first article per process invents "stone" (so the fact check and rewrite can be tested);
// the fact check flags "stone"; the interview echoes the customer's answer into a field.
import http from "node:http";

let articles = 0;
const reply = (res, obj, usage = { input_tokens: 900, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", stop_reason: "end_turn", usage, content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(obj) }] }));
};

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const b = JSON.parse(body || "{}");
    const system = (b.system && b.system[0] && b.system[0].text) || "";
    const user = b.messages[0].content;
    if (system.includes("fact checker")) {
      const flagged = user.includes("stone") ? [{ text: "cedar and stone", reason: "No stone is mentioned in the answers." }] : [];
      return reply(res, { unsupported: flagged, cleared: [] });
    }
    if (system.includes("interviewing a customer")) {
      const said = (user.match(/<customer_answer>\n([\s\S]*?)\n<\/customer_answer>/) || [])[1] || "";
      const patch = Object.fromEntries("name relationship pronoun born died origins work family story byline childhood roots early love service character dreams legacy".split(" ").map((k) => [k, ""]));
      if (/grandfather/i.test(said)) { patch.relationship = "granddaughter"; patch.name = "Elias Haddad"; patch.pronoun = "he"; }
      else if (/born/i.test(said)) patch.born = said;
      else if (said && !/skipped|don't know/i.test(said)) patch.work = said + " He also ran for mayor of Boston."; // an invention the server must refuse
      const sad = /passed away last|died last/i.test(said);
      return reply(res, { facts_patch: patch, next_question: (sad ? "I'm sorry for your loss. We can keep this short, or skip any question. " : "") + "Where and when was he born?", next_field: "born", coverage: { origins: 1, family: 0, work: 0, story: 0, character: 0, legacy: 0 }, done: false }, { input_tokens: 1200, output_tokens: 150, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 });
    }
    articles++;
    const stone = articles === 1 || process.env.MOCK_STUBBORN === "1"; // stubborn: never drops the invention
    return reply(res, {
      subheadline_options: [stone ? "A life crafted in cedar and stone" : "A carpenter's life on Maple Street", "From Zahleh to Stratford", "Forty years of Sunday letters"],
      body_paragraphs: ["Elias Haddad was born in 1904 in Zahleh, Lebanon.", "He built porches on Maple Street in Stratford."],
      captions: [], facts_used: ["born 1904"], gaps: ["Adding his children's names would help.", "The piece is shorter than the 600-word target."],
    }, { input_tokens: 3000, output_tokens: 1500, cache_read_input_tokens: 0, cache_creation_input_tokens: 1100 });
  });
}).listen(Number(process.argv[2] || 8799), "127.0.0.1", () => console.log("mock AI on", process.argv[2] || 8799));
