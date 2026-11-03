---
description: Prepare an offer for go-live — verify test evidence, independent terms review, go-live brief, request approval. Goes live only after an explicit yes.
---

For the offer `$ARGUMENTS`:

1. Confirm the Phase 3 gate in `cash/STATE.md` is PASS with test evidence in `cash/payments/test-evidence.md`. If not, stop and say what is missing.
2. Send offer, checkout copy, terms and refund language to `terms-reviewer` (a different agent from the author). Fix every FIX; escalate every ESCALATE.
3. Write `cash/golive/{slug}.md`: what goes live, price, who can buy, terms version, test evidence, review result, rollback plan, first-week monitoring.
4. Open a PR or issue labeled `needs-approval-golive` (and `needs-approval-price` if a price is being published) and stop.
5. Only when the owner replies with an explicit approval naming this offer: create the live-mode objects, read them back, run one real low-value purchase with the owner if they agree, and log it in STATE.md.
