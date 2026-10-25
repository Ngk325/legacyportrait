# Handoff: where the project stands

> **Superseded in parts (2026-10-25, WP1).** Current state lives in `docs/LAUNCH_LOG.md` and the plan in `docs/MASTER_PROMPT_v4.md`. Corrections to this page: `phase-2-generate` and `phase-3-sell` are merged into `main` (work now happens on PR branches off `main`); the brand is **The Legacy Press** with the product **Legacy Portrait** (Kin Gazette dropped); Browser Run print files are **proven** on a deployed preview; Turnstile widget and self-hosted HEIC are done (WP1). The rest below is the original snapshot.

Written 2026-10-25. Audience: Nick, Yara, or anyone (human or AI) picking this up cold.

## People and decisions

- **Yara** builds with Claude; **Nick** owns the GitHub repo (`ngk325/legacyportrait`), the Cloudflare account, the API keys and the heirloom newspaper clipping the template is styled on.
- Printful was dropped. Gelato chosen (Prodigi and Gooten considered).
- The questionnaire exists to gather facts so the AI never invents; it is not a personality quiz.
- Three sizes: 8x10, 11x14, 16x20 (shared 4:5 shape, standard US frame sizes). Framed poster, not assembled by default, wood colours except white.
- Brand/domain proposal (not decided): **Kin Gazette / kingazette.com**, about $10.46/yr at Cloudflare, same renewal. Before buying: check USPTO trademark and the Instagram handle. Nick decides which account buys it.

## Branches

- `phase-2-generate`: Phases 1–2. This is what the Cloudflare test site deploys.
- `phase-3-sell`: adds print files (Phase 3a). **Not merged.** Needs testing first.

## Cloudflare resources (created 2026-10-20)

- D1 database `legacyportrait` (id in `wrangler.toml`), schema applied from `migrations/0001_init.sql`.
- R2 bucket `legacyportrait-photos` (photos and cached print files).
- Pages project connected to the repo; a test site is deployed from `phase-2-generate`.
- Browser Run: free plan allows only ~10 minutes/day; switch to the **$5/month Workers paid plan before launch** (about 10 hours/month).

## What works (tested)

- Template renders a full portrait to 300 DPI PNG/PDF at all three sizes (`scripts/render.py`). 16x20 once produced 2 PDF pages; fixed with `page_ranges="1"`.
- Create flow end to end on the deployed test site: photos, questions, style, draft, edit, approve. Yara confirmed it worked.
- Draft writer: Anthropic → Gemini → sample. Tested only with **mocked** responses, never with a real key.
- Low-resolution photo warning.

## What is written but not proven

- `functions/api/portraits/[id]/print.js` + `_lib/print.js`: Browser Run PDF/PNG. Pages and 403 lock confirmed locally; the actual browser launch could not run in the build workspace (Chrome download blocked). Unknown: whether the `[browser]` binding in `wrangler.toml` is honoured by a **Pages** project. If not, either add the binding in the Pages dashboard, or move rendering into a small separate Worker called by the Pages Function.
- Fonts and photos are loaded same-origin by the headless browser; confirm on the deployed site that fonts load before capture (`body[data-ready='1']` should cover it).

## Known gaps (Phase 2)

1. **Turnstile**: the server checks a token, but the page never sends one. Add the widget (use Cloudflare's test keys first) and send the token with `POST /api/portraits`.
2. **HEIC**: conversion currently loads a library from a CDN. Self-host it so the site has no third-party dependency.
3. **Short stories**: when the customer gives little material the page can look empty. Needs a layout variant (larger text, bigger photo).
4. Privacy and terms pages, auto-delete of old drafts and photos, landing page (`public/index.html` is a stub), GA4/Meta Pixel with cookie banner.

## Phase 3 plan (not started)

1. **Stripe Checkout, test mode.** Products: digital download, and framed print in 3 sizes. On `checkout.session.completed` webhook: set portrait status to `paid`, create an `orders` row, email the customer with Resend.
2. **Manual order screen for the team** (protected by `ADMIN_TOKEN`): list paid orders, download the print file, copy the shipping address, place the Gelato order by hand in the Gelato dashboard, paste back the Gelato order id/tracking. Manual first; automate through the Gelato API only after a few real orders succeed.
3. Real prices and the order-by date as config values, not hard-coded.
4. Update the unit-economics spreadsheet and `legacy-portrait-build-prompt-mvp.md` with the real Gelato costs and three sizes (both still carry placeholders).

## Waiting on Nick

- Gemini key (billing-enabled project, because free-tier keys may let Google use customers' stories) and Anthropic key.
- Confirm the Cloudflare project is connected to the repo with the right permission.
- $5/month Workers plan before launch.
- Domain and brand decision, and which account buys the domain.
- Approval to merge `phase-3-sell` after it is tested.

## Yara's open to-dos

- Cancel the AnythingMCP trial and delete the Gelato API key it holds before the 7-day trial ends (started Oct 15).
- Check kingazette.com availability, USPTO and Instagram.
- Gelato support replied about 7–11 vs 4–6 days; keep using 7–11 and Dec 10–11 until a test order gives real numbers.

## Gotchas learned

- Gelato price tables: compare the exact paper variant (170 vs 200 gsm) and currency (EUR vs USD) before trusting a quote.
- `wrangler pages dev` fails if old `workerd` processes hold port 8788; kill them. Run local migrations first or `POST /api/portraits` returns 500.
- `scripts/e2e.py` has a path that only exists in the original workspace; edit it.
- Code that was committed without being fully read caused two bugs (Turnstile token, HEIC CDN). Read before committing.
- Do not paste API keys in chat; set them in Cloudflare or `.dev.vars`.

## Next step for whoever continues

Deploy `phase-3-sell` as a preview, set `ADMIN_TOKEN`, open `/api/portraits/<id>/print?size=11x14&format=pdf&token=...` for an approved portrait, and check the PDF matches `scripts/render.py` output. Then start Stripe.
