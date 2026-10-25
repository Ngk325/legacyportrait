# Legacy Portrait (The Legacy Press)

A web app where a customer uploads 1–3 photos of an ancestor and answers a short questionnaire. An AI drafts a newspaper-style profile; the customer edits and approves it; it is sold as a **digital download** or a **framed print** fulfilled by **Gelato**. Target: the 2026 holiday season.

> Status: working through the launch work packages in [`docs/MASTER_PROMPT_v4.md`](docs/MASTER_PROMPT_v4.md) (WP0 reality check done, WP1 foundations in review). Not yet live to customers. [`docs/LAUNCH_LOG.md`](docs/LAUNCH_LOG.md) is the running record of what was done, verified and blocked.

## What is built

| Phase | What | State |
|---|---|---|
| 1 | Newspaper template: one HTML/CSS layout, JSON-driven, halftone photo, auto-fit text, hyphenation | Done, approved by Yara |
| 2 | Create flow: photos → story questions → style → AI draft → edit → approve | Done; tested with sample draft and mocked AI. No real AI key tested yet |
| 3a | Print files (PDF/PNG) inside the site with Cloudflare Browser Run | Merged to `main`. Proven on a deployed preview (all sizes; 11x14 matches `render.py` pixel for pixel) |
| WP1 | Config (brand, prices, holiday order-by dates), LIVE_MODE gate, edit token, Turnstile widget, self-hosted HEIC, security headers, error log, migration 0002 | In review (PR) |
| WP2+ | AI interview and fact validator, preview-then-pay, Stripe, admin, Gelato, email, landing page | Not started |

## Stack

- **Cloudflare Pages + Pages Functions** (`functions/`) for the site and API
- **D1** (SQLite) for portraits and orders; **R2** for photos and cached print files
- **Browser Run** (headless Chromium via `@cloudflare/puppeteer`) for 300 DPI print files
- **AI**: `functions/_lib/ai.js` calls Anthropic first (Haiku 5.5 for the interview and fact check, Sonnet 5.5 for the article; prompt caching, JSON schema output), Gemini as the silent backup. Every call is costed into `ai_calls`; a per-portrait cap (`MAX_AI_COST_USD`, default $0.40) stops further calls. Models and prices: `config/ai.js`
- **Fact validator** (`functions/_lib/validate.js`): years, numbers and names in a draft must be in the customer's answers (code check), plus an AI fact check for invented details; failing drafts are rewritten up to twice, and anything left is shown to the customer to check before approving. Labelled sample draft only when no key is set, never in live mode
- **Cloudflare Turnstile** on draft creation
- **Planned**: Stripe Checkout (test mode first), Resend email, GA4/Meta Pixel
- **Fulfilment**: Gelato (three framed-poster sizes, see below)

## Layout

```
public/            static site: create.html, js/app.js, css/app.css, template/ (the newspaper layout)
public/template/   index.html + render.js + style.css + fonts + vendor/hyphen.js
functions/api/portraits/        API (see below)
functions/_lib/                 draft.js (AI), render.js (template data), print.js (Browser Run), util.js,
                                auth.js (team token, edit token), flags.js (LIVE_MODE, feature flags)
functions/api/config.js         public config for the pages; functions/api/admin/ team-only routes
config/                         brand.js, products.js (prices), holidays.js (order-by dates). Change values here only
migrations/                     0001 schema; 0002 edit token, orders/payments columns, stripe_events, ai_calls,
                                email_log, config, errors
public/_headers                 security headers (CSP etc.) for static pages
public/vendor/heic2any/         self-hosted iPhone photo converter
tests/                          unit tests: npm test
scripts/render.py               local print-file renderer (Playwright), the reference for print.js
scripts/e2e.py                  browser test of the create flow (has a workspace-specific path; adjust)
data/elias-haddad.json          sample portrait used to test the template
wrangler.toml                   bindings: DB, PHOTOS, BROWSER; model vars
.dev.vars.example               local secrets template (copy to .dev.vars, never commit)
docs/HANDOFF.md                 current state, open items, next steps
```

## API

| Route | Purpose |
|---|---|
| `GET /api/config` | Brand, Turnstile site key, next order-by dates, live/test |
| `POST /api/portraits` | Create a draft (checks Turnstile if `TURNSTILE_SECRET` is set). Returns the unguessable id and sets the edit-token cookie |
| `GET/PUT /api/portraits/:id` | Read / save answers and edited text. Editing after approval resets it to draft |
| `POST /api/portraits/:id/claim` | Trade a private-link token for this device's edit cookie |
| `POST/GET/DELETE /api/portraits/:id/photos/:n` | Upload (JPG/PNG/WebP checked by content, ≤8 MB, HEIC converted in browser), stream, remove. Slots 0–2 |
| `GET/POST /api/portraits/:id/interview` | Guided interview: transcript and current question / answer it (`{message}`, `""` = skip). Updates the story fields (the fact card) |
| `POST /api/portraits/:id/draft` | Generate (or regenerate, max 5) the AI draft, fact-check it and rewrite if needed. Claims still unsupported come back in `generated.unsupported`; provider/model are team-only fields |
| `POST /api/portraits/:id/approve` | Customer confirms they read the text and have rights to the photos |
| `GET /api/portraits/:id/render` | JSON the template draws from (live preview) |
| `GET /api/portraits/:id/print?size=11x14&format=pdf\|png` | Print file. Paid orders or team (`ADMIN_TOKEN`) only. Cached in R2 |
| `POST /api/admin/retention` | Team only. Dry run of the retention rules; `?apply=1` deletes, `&tests=1` also removes portraits tagged as tests. Called daily by `workers/retention-cron` |
| `GET /api/products` | The offer from `config/products.js`, order-by dates and an arrival estimate |
| `GET/POST /api/portraits/:id/order` | The customer's chosen format, saved as one pending order (priced on the server) |
| `GET/POST /api/admin/config` | Team only. Read switches; `{"live_mode":"on"\|"off"}` flips the admin half of the LIVE_MODE gate |

The draft id lets anyone with the link **read** a draft (keep links private; pages send `noindex`). **Changing** it (answers, photos, rewrites, approval) needs the edit token, an HttpOnly cookie set on the device that started the draft. Drafts made before migration 0002 have no token and stay open.

## Print sizes and layout

Three sizes share one 4:5 layout: **8x10, 11x14, 16x20**. The layout is designed at 1056 px wide (11 in) and scaled: `scale = inches × 300 / 1056`, so files are 300 DPI (e.g. 3300×4200 for 11x14). The template exposes `window.__FIT__` (did the text fit, final body size in pt). Body text range is 8.5–12 pt; short stories use the larger sizes.

Low-resolution photos are warned about in the create flow (e.g. "about 115 dpi" on a large print).

## Run locally

```bash
npm install
npm test                                # unit tests (prices, order-by dates, edit token, image sniffing)
cp .dev.vars.example .dev.vars          # keys stay "placeholder" to get a labelled sample draft
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev --port 8788      # http://localhost:8788/create.html
```

Render a print file without the website:

```bash
pip install playwright && python3 scripts/render.py data/elias-haddad.json out/elias 11x14
```

Browser Run cannot run fully offline: `/print` needs the deployed site (or `wrangler dev` with a downloadable Chrome).

## Deploying

The Pages project must have the build command `npm ci --omit=dev` (output directory `public`). Without it Pages never installs `@cloudflare/puppeteer` and every build fails in about a second. Run new migrations on the real database before deploying code that needs them: `npx wrangler d1 migrations apply DB --remote`. Secrets are per environment (Production and Preview are separate) and only apply to deployments made after they were set.

## Configuration

Secrets (Cloudflare → Pages project → Settings → Variables and Secrets; locally `.dev.vars`). **Never paste keys into chat or commit them.**

| Name | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Main AI writer |
| `GEMINI_API_KEY` | Backup writer (use a billing-enabled key for real customers) |
| `ADMIN_TOKEN` | Team access to print files before payment |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Bot check on draft creation (skipped if empty; test keys in `.dev.vars.example`) |
| `LIVE_MODE` | `true` only when Nick says go live. Live also needs the admin toggle. Default: test mode |
| `FULFILLMENT_MODE` | `manual` (default), `gelato_draft`, `gelato_live` |
| `ANTHROPIC_MODEL`, `GEMINI_MODEL` | Plain vars in `wrangler.toml` (`claude-sonnet-5-5`, `gemini-3.6-flash`) |

A key left as `placeholder` counts as "not set". With no keys the app writes a clearly labelled **sample** draft, so the whole flow can be tested for free.

## Fulfilment (Gelato)

Framed poster, not assembled by default, wood colour choice (no white). Costs came from Yara's official EUR price table, not API estimates. Delivery: the API quotes **7–11 days**; the website says 4–6. Gelato support's answer is in the handoff. Planning uses the conservative figure, with an order-by date of **Dec 10–11** until a test order gives real data.

## Rules we keep

- Stripe stays in **test mode** until Nick approves going live.
- No facts are invented by the AI; the customer approves all text. Customer data goes to Anthropic and Google, so the privacy page must name both.
- Design changes are not committed until Yara approves them.
