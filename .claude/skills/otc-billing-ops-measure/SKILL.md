---
name: otc-billing-ops-measure
description: Phase 5 of the offer-to-cash system. Use for failed-payment recovery, invoicing and collections, renewals, refunds, and the weekly cash and revenue report.
---

# Phase 5 — Billing operations and measurement

## Keep collected revenue
- **Failed payments:** retry schedule, a friendly reminder sequence (email and WhatsApp where consented), a grace period, then pause access per the terms. Track recovery rate.
- **Invoices:** send on time, with clear terms; follow up at due date, +3, +7 and +14 days with a polite, factual cadence. Escalate to the owner at +14 with the full history. Nothing threatening or misleading.
- **Renewals:** reminder before annual renewals, as the terms and local law require.
- **Refunds and disputes:** respond within a day; apply the written policy; refunds above the owner's limit need approval. Log every dispute with the reason.

## Weekly cash report (`cash/reports/YYYY-MM-DD.md`, also in the Google Sheet)
New paying customers · cash collected · MRR/ARR if recurring · refunds · failed payments and recovery · outstanding invoices and age · gross margin · customer acquisition cost and payback · churn · first-10 progress. Show the math and label each number measured/assumed.

## Decisions
State sample size and confidence. Propose **price changes, discounts and plan changes as approval requests**; never change a live price on your own. End with Stop 3 · Start 3 · Test 1.

## Free actions (log them)
Deactivate a broken payment link, disable a price, fix a failed webhook, correct a typo in a receipt.

## Roll-up
Append one summary row (customers, cash collected, MRR, biggest risk) to the portfolio sheet if configured.

Exit gate: failed-payment recovery, invoicing, renewals and the weekly cash report running.
