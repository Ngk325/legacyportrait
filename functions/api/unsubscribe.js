import { unsubscribeSig } from "../_lib/auth.js";

// GET/POST /api/unsubscribe?c=<customer id>&s=<signature>  (link in every reminder; POST is the one-click header)
export async function onRequest({ env, request }) {
  const url = new URL(request.url);
  const c = url.searchParams.get("c") || "", s = url.searchParams.get("s") || "";
  const expected = await unsubscribeSig(env, c);
  const ok = !!expected && /^[a-f0-9]{24}$/.test(c) && s === expected;
  if (ok) await env.DB.prepare("UPDATE customers SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')), marketing_opt_in = 0 WHERE id = ?").bind(c).run();
  if (request.method === "POST") return new Response(null, { status: ok ? 200 : 400 });
  const msg = ok ? "You won't get any more reminder emails from us. Your draft is still saved." : "That unsubscribe link isn't valid. Please reply to one of our emails and we'll take care of it.";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe</title><link rel="stylesheet" href="/css/app.css"></head><body><main class="wrap narrow"><h1>${ok ? "You're unsubscribed" : "Something went wrong"}</h1><p>${msg}</p><p><a href="/">Back to the home page</a></p></main></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "content-security-policy": "default-src 'none'; style-src 'self'; font-src 'self'; frame-ancestors 'none'" } });
}
