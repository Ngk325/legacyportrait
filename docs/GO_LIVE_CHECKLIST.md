# Go-live checklist

Written 2026-11-03 from `docs/LAUNCH_LOG.md` (last entry 2026-10-25) and `config/holidays.js`. The site is deployed to production with `LIVE_MODE` on, but it cannot take a real order until the items under "Blocks every sale" are done. Items marked (check) were true on Oct 25; confirm them before relying on them.

## Deadlines

Framed and print-only orders close 15 days before the holiday. Digital orders close the day before.

| Holiday | Date | Physical order-by |
|---|---|---|
| Thanksgiving | Nov 26 | Nov 11 |
| Hanukkah | Dec 4 | Nov 19 |
| Christmas | Dec 25 | Dec 10 |
| Kwanzaa | Dec 26 | Dec 11 |
| Orthodox Christmas | Jan 7 | Dec 23 |

## Blocks every sale (owner)

1. [ ] Test keys first: `STRIPE_SECRET_KEY_TEST` and `STRIPE_WEBHOOK_SECRET_TEST` in Preview, then the test purchase (item 10). Then `STRIPE_SECRET_KEY_LIVE` in Production: a restricted key with Checkout Sessions write and Refunds write. Stripe's API cannot issue keys, so these are pastes.
2. [ ] AI works: add credit to the Anthropic key, or enable billing on the Gemini project. (check)
3. [ ] Turnstile keys (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`) copied from Preview into Production. (check)

## Blocks real customers (owner)

4. [ ] Business postal address and support email in `config/brand.js`.
5. [ ] Sending domain, `RESEND_API_KEY`, `MAIL_FROM`. No receipts or reminders go out without them.
6. [ ] Legal review of the pages still marked Draft: terms, refunds, privacy, shipping.
7. [ ] Gelato product IDs for the 21 SKUs and `GELATO_API_KEY`. Run `npm run check:gelato`. Until then fulfillment is manual.
8. [ ] Workers paid plan ($5/month) so Browser Run can render print files all month.
9. [ ] Deploy the reminders and retention Worker: `cd workers/retention-cron && npx wrangler deploy && npx wrangler secret put ADMIN_TOKEN`.

## Before announcing anywhere

10. [ ] One real test-mode purchase end to end (checkout, receipt, refund) with evidence saved in `cash/payments/test-evidence/`.
11. [ ] One real portrait made with a real AI key, on a phone, from upload to approval.
12. [ ] Order-by dates on the site match this table.

## Already done (from the launch log)

- Migrations 0004 and 0005 applied to the production database.
- Live Stripe webhook created; signing secret stored as `STRIPE_WEBHOOK_SECRET_LIVE`.
- Webhook ignores other Stratfield products' events.
- `ADMIN_TOKEN`, `LINK_SECRET`, `GELATO_WEBHOOK_SECRET`, `LIVE_MODE`, `SITE_URL` set in Production.

## Rule for this repo

Nothing is charged, emailed to a customer, or published without the owner's explicit yes. Kit rules are in `CLAUDE.md`; status lives in `cash/STATE.md` and `social/STATE.md`.
