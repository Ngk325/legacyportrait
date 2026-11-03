# STATE.md
_Last updated: 2026-11-03 by Claude. Facts come from docs/LAUNCH_LOG.md (last entry Oct 25). Re-verify anything marked (check) before acting._

## Phase
Current phase: 0 · Phase 3 gate (test-mode end to end + terms review): NOT PASSED
Site is deployed to production but cannot take a real order yet.

## Revenue snapshot
Paying customers: 0 · Cash collected (last 7d): $0 · MRR: n/a · First-10 progress: 0/10

## Live right now
| Offer | Price | Status | Link ID | Last 7d orders |
|---|---|---|---|---|
| Digital portrait | $19 | deployed, checkout blocked (no live Stripe secret key) | n/a (Checkout Sessions built by the app) | 0 |
| Framed print 11x14 assembled | $124 | deployed, checkout blocked; fulfillment manual | n/a | 0 |

## Done since last update
- Kits installed on a branch. cash/VENTURE.md filled from the repo.
- docs/GO_LIVE_CHECKLIST.md written with the physical order-by dates.

## Waiting on owner (ranked)
1. [ ] Test first, then live. (a) Add `STRIPE_SECRET_KEY_TEST` and `STRIPE_WEBHOOK_SECRET_TEST` to Preview so the test-mode purchase can run. (b) Only after it passes and you approve the go-live brief, paste `STRIPE_SECRET_KEY_LIVE` (restricted key: Checkout Sessions write and Refunds write) into Production. Without (b) no real sale is possible.
2. [ ] Add credit to the Anthropic key or enable billing on the Gemini project. Drafts fail on the live site until one works. (check)
3. [ ] Copy the Turnstile keys from Preview into Production. Bot protection is off and AI spend is exposed. (check)
4. [ ] Business postal address and support email in config/brand.js, a sending domain, Resend key and MAIL_FROM. No emails go out otherwise.
5. [ ] Legal review of the pages still marked Draft (terms, refunds, privacy, shipping).
6. [ ] Gelato product IDs and API key (fulfillment stays manual until set), and the $5 Workers plan for print files.
7. [ ] Deploy the hourly reminders and retention Worker (`workers/retention-cron`), or add Workers Scripts: Edit to the token.

## Next 3 actions
1. Run an end-to-end test-mode purchase on Preview once item 1(a) is done, and capture evidence in cash/payments/test-evidence.
2. Have the terms-reviewer agent review the refund and shipping copy (independent of whoever wrote it).
3. Build the first-10 plan: family and friends who will pay for a real portrait, tracked in cash/first-10.csv.

## Free-tier actions taken (deactivations, test-mode builds, fixes)
- 2026-11-03 — installed kit files on branch kits/install-otc-soc — no payment objects touched

## Open risks
- Holiday window: the Thanksgiving physical cutoff is Nov 11. Christmas is Dec 10. Each day of delay shrinks the physical market.
- AI drafts have never been tested with a real key at scale, and the fact validator depends on it.
- The Stripe account is shared with other Stratfield products. The webhook already ignores other products' events; keep it that way.

## Open questions
- Who is the seller of record on receipts (Stratfield Partners LLC or The Legacy Press)? — default: Stratfield Partners LLC — ask owner
- Is the US the only launch market for shipping? — default: yes — ask owner
