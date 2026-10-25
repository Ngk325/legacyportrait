// Customer text is data, never instructions (prompt-injection defence):
// strip invisible control and direction-override characters, cap lengths, and fence it in tags the text cannot close.

// C0/C1 controls except tab and newline, zero-width and bidi override characters
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export const cleanText = (s, max = 8000) => String(s ?? "").replace(INVISIBLE, "").replace(/\r\n?/g, "\n").slice(0, max);

// Deep-clean every string in a JSON-able value.
export function cleanDeep(v, max = 8000) {
  if (typeof v === "string") return cleanText(v, max);
  if (Array.isArray(v)) return v.map((x) => cleanDeep(x, max));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cleanDeep(x, max)]));
  return v;
}

// <tag> ... </tag>, with any attempt inside the text to open or close a tag of that name defused.
export function wrapData(tag, text) {
  const safe = cleanText(text, 60000).replace(new RegExp(`<\\s*/?\\s*${tag}\\b[^>]*>`, "gi"), "[removed tag]");
  return `<${tag}>\n${safe}\n</${tag}>`;
}
