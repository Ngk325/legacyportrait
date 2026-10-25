// Stripe over plain fetch (no SDK in the Worker): form-encoded API calls and webhook signature checks.
// Test and live keys are separate secrets; which one is used follows the LIVE_MODE gate (hard rule 1).
// Verified against docs.stripe.com on 2026-10-25 (see docs/INTEGRATIONS.md).

import { isLiveMode } from "./flags.js";

export async function stripeKeys(env) {
  const live = await isLiveMode(env);
  const secret = live ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST;
  // a key of the wrong kind is treated as "not configured" so test mode can never charge a real card
  const ok = !!secret && (live ? /^sk_live_/.test(secret) : /^sk_test_/.test(secret));
  return { live, secret: ok ? secret : null };
}

// { a: { b: [1, 2] } } -> "a[b][0]=1&a[b][1]=2"
export function formEncode(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") parts.push(formEncode(v, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

export async function stripeRequest(env, secret, method, path, params = null, { idempotencyKey } = {}) {
  // STRIPE_API_BASE is only for local tests against a fake server
  const res = await fetch((env.STRIPE_API_BASE || "https://api.stripe.com") + path, {
    method,
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: params ? formEncode(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`Stripe ${res.status}: ${data?.error?.message || "request failed"}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

// Stripe-Signature: t=<unix seconds>,v1=<hex>[,v1=...][,v0=...]. Only v1 counts (docs: ignore other schemes).
// Returns true if any v1 signature matches any of the secrets and the timestamp is within tolerance.
export async function verifyStripeSignature(rawBody, header, secrets, { toleranceSec = 300, now = Date.now() } = {}) {
  if (!header) return false;
  let t = null;
  const sigs = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") sigs.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  for (const secret of secrets.filter(Boolean)) {
    const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
    if (sigs.some((s) => safeEqual(s, expected))) return true;
  }
  return false;
}
