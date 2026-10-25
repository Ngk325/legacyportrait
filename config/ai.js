// AI models, prices and limits (master prompt section 6). Values only; logic lives in functions/_lib/ai.js.
// Prices are US$ per million tokens. Checked 2026-10-25:
// - Anthropic: claude-api reference (Haiku 5.5 $0.10/$0.50 for prompts up to 100K tokens; Sonnet 5.5 $2/$10;
//   cache reads 0.1x input on Haiku, $0.20 on Sonnet 5.5; 5-minute cache writes 1.25x input).
// - Gemini 3.6 Flash: ai.google.dev/gemini-api/docs/pricing says $0.75/$3.75 until 2026-12-31, then $1.50/$7.50.
//   We budget with the 2027 price so the spend cap never under-counts.

export const MODELS = {
  interview: { anthropic: "claude-haiku-5-5", gemini: "gemini-3.6-flash" },
  article: { anthropic: "claude-sonnet-5-5", gemini: "gemini-3.6-flash" },
  factcheck: { anthropic: "claude-haiku-5-5", gemini: "gemini-3.6-flash" },
};

// Thinking depth per job (Anthropic output_config.effort). Haiku and Sonnet 5.5 think by default.
export const EFFORT = { interview: "low", article: "medium", factcheck: "low" };

export const PRICES = {
  "claude-haiku-5-5": { in: 0.10, out: 0.50, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { in: 2.00, out: 10.00, cacheRead: 0.20, cacheWrite: 2.50 },
  "gemini-3.6-flash": { in: 1.50, out: 7.50, cacheRead: 1.50, cacheWrite: 1.50 },
};
export const UNKNOWN_MODEL_PRICE = { in: 5.00, out: 25.00, cacheRead: 5.00, cacheWrite: 5.00 }; // over-count rather than under-count

export const LIMITS = {
  maxCostUsdPerPortrait: 0.40,   // MAX_AI_COST_USD env var overrides
  interviewTurns: 14,
  interviewMessageChars: 2400,   // about 600 tokens of customer text per turn
  factcheckRetries: 2,           // extra article attempts when the fact check finds unsupported claims
};

export function costUsd(model, usage = {}) {
  const p = PRICES[model] || UNKNOWN_MODEL_PRICE;
  const m = 1e6;
  return ((usage.in || 0) * p.in + (usage.out || 0) * p.out + (usage.cacheRead || 0) * p.cacheRead + (usage.cacheWrite || 0) * p.cacheWrite) / m;
}
