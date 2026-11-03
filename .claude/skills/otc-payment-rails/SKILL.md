---
name: otc-payment-rails
description: Phase 2 of the offer-to-cash system. Use to set up products, prices, payment links, invoicing, subscriptions and webhooks in test mode, and to check payment-method, tax and currency support for each market.
---

# Phase 2 — Payment rails

## Choose the rail per market
Verify the **current** supported countries, currencies and payment methods before promising anything.
- **US customers:** Stripe (payment links, Checkout, invoices, subscriptions) is the default. Consider ACH for larger tickets to lower fees.
- **Lebanon/Levant:** card acceptance by local entities and buyers is often limited. Check Stripe's current supported-country list and the owner's legal entity location, and identify alternatives (bank transfer, local money-transfer or wallet services, USD invoices, WhatsApp-assisted payment links). Document what was verified and what remains uncertain; get local advice for banking and currency rules.
- **Manual first:** for the first customers, a hand-made invoice or payment link is fine. Don't build automation before the first sale.

## Build in test mode
- Authenticate with the Stripe connector. Create products and prices **in test mode only**, with descriptive names and metadata (`venture`, `offer`, `tier`).
- Payment links or Checkout sessions for the entry and core offers; invoices for custom deals.
- Subscriptions: billing interval, trial rules, proration, cancellation behavior.
- Webhooks for paid, failed, refunded and canceled events (Supabase edge functions or Zapier for glue). Log events to a table or Google Sheet.
- Receipts and confirmation emails (Resend or Bird) with delivery details and support contact.

## Tax, currency and records
- Check sales-tax or VAT obligations for each market and product type. Flag, don't guess: route to the owner's accountant with `needs-legal-review`.
- Record the product, price ID and link in `cash/payments/spec.md` so STATE.md can track what exists.
- Never store card data. Never put secret keys in git.

Exit gate: all objects exist in test mode and are read back; market support, tax questions and fallback rails documented.
