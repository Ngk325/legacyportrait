// Fake Stripe API for local tests (never used in production): answers POST /v1/checkout/sessions and
// keeps the last request so a test can inspect it at GET /_last.
// Run: node scripts/mock-stripe.mjs 8798, then STRIPE_API_BASE=http://127.0.0.1:8798 and STRIPE_SECRET_KEY_TEST=sk_test_... in .dev.vars
import http from "node:http";
let last = null, n = 0;
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/_last") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(last)); }
    if (req.method === "POST" && req.url === "/v1/checkout/sessions") {
      const p = Object.fromEntries(new URLSearchParams(body));
      last = { auth: req.headers.authorization, idempotency: req.headers["idempotency-key"], params: p };
      const id = "cs_test_mock_" + ++n;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id, object: "checkout.session", url: p.success_url.replace("{CHECKOUT_SESSION_ID}", id) }));
    }
    res.writeHead(404, { "content-type": "application/json" }); res.end('{"error":{"message":"not mocked"}}');
  });
}).listen(Number(process.argv[2] || 8798), "127.0.0.1", () => console.log("mock Stripe on", process.argv[2] || 8798));
