// Security headers for every API response (static files get theirs from public/_headers).
export async function onRequest({ next }) {
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  out.headers.set("x-robots-tag", "noindex");
  if (!out.headers.has("content-security-policy")) out.headers.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  return out;
}
