# cash/VENTURE.md
<!-- UNSET = needs the owner. "proposed:" = Claude's estimate with reasoning. Source for every value: config/products.js, config/holidays.js, docs/LAUNCH_LOG.md (2026-10-25) unless marked. -->

## Identity
venture_name:                 Legacy Portrait (brand: The Legacy Press)
what_is_sold:                 product (a newspaper-style profile of an ancestor, from the customer's photos and answers; digital file or framed print)
delivery_model:               customer finishes the draft online and approves it. Digital file is immediate. Print is fulfilled by Gelato; fulfillment is manual until Gelato product IDs are set (owner-confirmed in LAUNCH_LOG)
markets:                      US launch. Marketing reach into genealogy groups in Australia and the UK is planned, but shipping and tax for those markets are not set up: UNSET
regulated: no
licensed_entities_and_numbers: n/a
legal_entity_and_bank_country:   UNSET (Stripe account is "Stratfield Partners", per LAUNCH_LOG; confirm this is the intended seller of record)

## Offer
entry_offer:                  Digital portrait, $19
core_offer:                   Framed print, 11x14, ready to hang: $124 ($109 + $15 assembly). This is the configured "most popular" option
expansion_offers:             Print only $39 / $49 / $69; framed $79 / $109 / $149 for 8x10 / 11x14 / 16x20; assembly +$15; wood, dark wood, black frames. Every physical product includes the digital file
pricing_model:                flat, one-time. Prices are tax-included (config/products.js)
price_floor:                  UNSET
price_target:                 UNSET
guarantee:                    UNSET. Refund policy page is marked Draft and needs legal review
founding_cohort_cap_and_end_date: n/a
order_by_dates_physical:      Thanksgiving Nov 11 · Hanukkah Nov 19 · Christmas Dec 10 · Kwanzaa Dec 11 · Orthodox Christmas Dec 23 (holiday minus 15 days; digital runs to the day before)

## Economics
direct_delivery_cost_per_customer:   UNSET. Gelato per-SKU costs are not in the repo; the HANDOFF notes the unit-economics sheet still carries placeholders
payment_fee_assumption:       proposed: Stripe standard card rate; confirm on the Stripe account
fixed_monthly_cost:           $5 Workers paid plan (Browser Run print files) once enabled; AI cost capped at $0.40 per portrait by MAX_AI_COST_USD (config/ai.js)
break_even_customers:         UNSET until delivery cost is known
refund_allowance:             UNSET
refund_approval_limit:        UNSET

## Systems
payment_provider:             Stripe. Live webhook endpoint exists; STRIPE_SECRET_KEY_LIVE is NOT set in Production, so checkout cannot take a real order yet
payment_methods_by_market:    cards (US)
invoicing_tool:               n/a
receipts_and_email_tool:      Resend, not configured (needs RESEND_API_KEY, MAIL_FROM and a sending domain)
webhook_destination:          https://legacyportrait.pages.dev/api/stripe/webhook
tax_handling:                 Prices are tax-included. STRIPE_TAX_ENABLED is false. Owner to confirm with accountant: UNSET
google_sheet_report:          UNSET. /api/admin/stats?format=csv exports per-day funnel and revenue
portfolio_sheet:              UNSET

## Boundaries
off_limits:                   no discounts, coupons or guarantees without the owner's explicit yes. Never use real customers' names or stories in marketing without permission
approver:                     Nick (owner). Technical partner: Yara
