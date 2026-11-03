---
name: otc-checkout-terms
description: Phase 3 of the offer-to-cash system and the hard gate. Use to build the checkout flow, terms, refund and cancellation policy, and to prove a test purchase works end to end before anything goes live.
---

# Phase 3 — Checkout and terms (hard gate)

You are not a lawyer. Draft carefully, cite the rule you checked (always check its **current** text), and route uncertainty to the owner or counsel with `needs-legal-review`.

## Checkout
- One clear page: what you get, price, billing frequency, total, how delivery works, what happens next.
- All costs and renewal terms visible **before** payment. No pre-checked add-ons, no hidden fees.
- Accessible, fast, mobile-first. Confirmation page and receipt tell the buyer exactly what happens next and when.

## Terms (`cash/terms/`)
- Terms of sale, privacy notice, refund policy, cancellation policy and, for subscriptions, clear auto-renewal disclosure with an easy cancel path. Check state and country auto-renewal and consumer-protection rules for each market.
- Service businesses: scope, deliverables, timelines, what is not included.
- Regulated lines (insurance, lending, health, legal, investment): the checkout must not give regulated advice, make unlicensed offers or imply licensure; identify the licensed entity; check the advertising and fee rules before charging for anything tied to a regulated product (for example, fee-based consulting versus commissions).
- Data: collect the minimum; honor deletion and opt-out.

## Test evidence (`cash/payments/test-evidence.md`)
Prove with real test-mode runs, with screenshots or logs: successful purchase; failed card; refund; cancellation; webhook received; receipt email delivered; entitlement or access granted. Add the Playwright or equivalent script to the repo.

## Independent review
`terms-reviewer` (a different agent from the author) returns PASS / FIX / ESCALATE for the offer, terms, refund language and checkout copy. Fix all FIX and resolve all ESCALATE.

## Go-live brief (`cash/golive/{slug}.md`)
What goes live · price · who can buy · terms version · test evidence · review result · rollback plan (how to deactivate in under 5 minutes) · first-week monitoring plan · owner approval line. Open a PR or issue labeled `needs-approval-golive` and stop.

Exit gate: end-to-end test evidence complete, terms reviewed, go-live brief approved by the owner.
