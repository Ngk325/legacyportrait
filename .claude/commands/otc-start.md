---
description: First run of the offer-to-cash system on this repo — intake, unit economics, first-dollar path, readiness score, 14-day plan.
---

Run the first-run sequence:

1. Load `otc-intake`. Read the repo (and `marketing/` or `sales/` VENTURE files if present) and write `cash/VENTURE.md` and `cash/STATE.md` from `cash/templates/`.
2. Model unit economics in a Google Sheet and name the fastest realistic path to a first dollar.
3. Score monetization readiness (0–10) and name the three biggest blockers.
4. Check connectors (Stripe, Resend/Bird, Google Drive/Sheets, Supabase, Zapier). List gaps and workarounds.
5. Ask at most 5 questions, each with your default. Open them as GitHub issues.
6. Propose a 14-day plan with the three highest-leverage actions. Start Phase 1 now with `pricing-analyst`; don't wait for answers.
7. Open a PR `otc/p0-intake` and end with the five-line session close from CLAUDE.md.

Extra context from the owner (may be empty): $ARGUMENTS
