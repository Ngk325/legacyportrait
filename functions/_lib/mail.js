// Sending email (Resend). Until RESEND_API_KEY and MAIL_FROM are set, nothing is sent: each email is logged in
// email_log as "not-configured" so the team can see what would have gone out.
// Reminder emails also need the business postal address (CAN-SPAM) and an unsubscribe link.

import { BRAND } from "../../config/brand.js";

export const mailConfigured = (env) => !!(env.RESEND_API_KEY && env.MAIL_FROM);

async function log(env, { to, template, portraitId, orderId, providerId, status }) {
  try {
    await env.DB.prepare("INSERT INTO email_log (to_email, template, portrait_id, order_id, provider_id, status) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(to, template, portraitId || null, orderId || null, providerId || null, status).run();
  } catch { /* email_log missing: never break the request */ }
}

// { to, subject, html, text, template, portraitId, orderId, unsubscribeUrl, kind: "transactional" | "reminder" }
// Returns { sent, status }.
export async function sendEmail(env, m) {
  if (m.kind === "reminder" && (!BRAND.businessAddress || !m.unsubscribeUrl)) {
    await log(env, { ...m, status: "blocked-no-address" });
    return { sent: false, status: "blocked-no-address" };
  }
  if (!mailConfigured(env)) {
    await log(env, { ...m, status: "not-configured" });
    return { sent: false, status: "not-configured" };
  }
  const headers = m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  const res = await fetch((env.RESEND_API_BASE || "https://api.resend.com") + "/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(headers ? { headers } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  const status = res.ok ? "sent" : `failed-${res.status}`;
  await log(env, { ...m, providerId: data.id, status });
  return { sent: res.ok, status };
}

// ---------- templates (plain words, one clear call to action, unsubscribe and address on reminders) ----------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function layout({ heading, paras, cta, url, footer }) {
  const html = `<!doctype html><html><body style="margin:0;background:#F4EFE4;font-family:Georgia,serif;color:#1A1A18">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<p style="font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#8A8577;margin:0 0 16px">${esc(BRAND.company)}</p>
<h1 style="font-size:24px;margin:0 0 16px">${esc(heading)}</h1>
${paras.map((p) => `<p style="font-size:17px;line-height:1.5;margin:0 0 14px">${esc(p)}</p>`).join("")}
<p style="margin:22px 0"><a href="${esc(url)}" style="background:#7A1F1F;color:#F4EFE4;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-size:17px">${esc(cta)}</a></p>
<p style="font-size:13px;color:#8A8577;line-height:1.5;margin-top:28px">${footer.map(esc).join("<br>")}</p>
</div></body></html>`;
  const text = [heading, "", ...paras, "", `${cta}: ${url}`, "", ...footer].join("\n");
  return { html, text };
}

// kind: "saved" (right after the email is given), "remind-24h", "remind-72h", "remind-7d", "preview-30m", "preview-24h"
export function draftEmail(kind, { name, line, url, orderBy, unsubscribeUrl }) {
  const who = name || "your family member";
  const first = (name || "").split(/\s+/)[0] || "them";
  const footer = [
    "You're receiving this because you started a portrait and asked us to save it.",
    ...(unsubscribeUrl ? [`Stop these emails: ${unsubscribeUrl}`] : []),
    ...(BRAND.businessAddress ? [`${BRAND.company}, ${BRAND.businessAddress}`] : [BRAND.company]),
  ];
  const T = {
    "saved": { subject: `Your ${who} portrait draft is saved`, heading: "Your draft is saved", paras: [`Here is your private link to the portrait of ${who}. Your photos and answers are kept, so you can pick up where you left off on any device.`, "Please keep this link to yourself: anyone with it can change your draft."], cta: "Finish my portrait" },
    "remind-24h": { subject: `Your ${who} portrait draft is saved`, heading: `You started a portrait of ${first}`, paras: line ? [`Here's the draft, saved. One line from your story stayed with us: "${line}"`] : ["Here's the draft, saved, just as you left it."], cta: "Finish my portrait" },
    "remind-72h": { subject: `A few minutes more and ${first}'s portrait is ready`, heading: "Pick up where you left off", paras: [`Your answers about ${who} are saved.` + (orderBy ? ` To have a framed portrait in time for ${orderBy.name}, order by ${orderBy.date}.` : "")], cta: "Finish my portrait" },
    "remind-7d": { subject: `${first}'s portrait is still waiting for you`, heading: "We kept your draft", paras: ["This is our last note about it. If something got in the way or you'd like help with the questions, just reply to this email."], cta: "Open my draft" },
    "preview-30m": { subject: `Your portrait of ${who} is ready to preview`, heading: "Your portrait is ready", paras: [`You approved the text for ${who}'s portrait. It's waiting for you whenever you're ready to choose a framed print or the digital file.`], cta: "See my portrait" },
    "preview-24h": { subject: `${first}'s front page is ready`, heading: "Still thinking it over?", paras: ["Your portrait is saved." + (orderBy ? ` Order a framed print by ${orderBy.date} for ${orderBy.name}; the digital file is ready instantly.` : " The digital file is ready instantly.")], cta: "See my portrait" },
  }[kind];
  return { subject: T.subject, ...layout({ heading: T.heading, paras: T.paras, cta: T.cta, url, footer }) };
}
