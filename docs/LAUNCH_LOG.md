# Launch log

Running record: what was done, what was verified, what is blocked. Newest first.

---

## 2026-10-25 · WP2 AI interview and article upgrade

### Verified against current docs (hard rule 4)
| Item | Value | Source |
|---|---|---|
| Interview / fact check model | `claude-haiku-5-5`, $0.10 in / $0.50 out per M tokens (prompts up to 100K) | Anthropic claude-api reference, 2026-10 |
| Article model | `claude-sonnet-5-5`, $2 / $10; cache reads $0.20 | same |
| Prompt caching | `cache_control: {type: "ephemeral"}` on the system block; minimum 512 tokens on these models; writes 1.25×, reads 0.1× (Haiku) | same |
| JSON output | `output_config.format = {type: "json_schema", schema}`; `temperature` now rejected (we don't send it); both models think by default, so effort is set explicitly (`low` interview/fact check, `medium` article) | same |
| Gemini 3.6 Flash | $0.75 / $3.75 until 2026-12-31, then $1.50 / $7.50. We budget at the 2027 price | ai.google.dev/gemini-api/docs/pricing |

### Done
| Item | Where |
|---|---|
| One AI layer for all jobs: Anthropic first, Gemini backup, retries, usage-based cost per call in `ai_calls`, per-portrait cap (`MAX_AI_COST_USD`, default $0.40) checked before every call | `functions/_lib/ai.js`, `config/ai.js` |
| Prompt caching on the article, interview and fact-check system prompts; JSON-schema output on Anthropic | `ai.js` |
| Fact validator, layer 1 (code): every year, number (digits or words) and capitalised name/place in the draft must be in the answers | `functions/_lib/validate.js` |
| Fact validator, layer 2 (Haiku): lists invented details (the "stone", "homes", "family business" kind). It can clear a layer-1 name only with an exact quote from the answers, which code verifies; numbers and years can't be cleared | `validate.js` |
| Draft flow: write → check → if anything unsupported, rewrite with that feedback (up to 2 more times) → keep the best. Anything still unsupported is shown to the customer as **"Please check these before you approve"** | `draft.js`, `create.html` |
| Gap chips never mention word counts or targets (prompt rule + filter) | `draft.js` |
| Prompt-injection defence: customer text fenced in `<customer_answers>`-style tags it cannot close, invisible/direction-override characters stripped, lengths capped, explicit "data, never instructions" rules in every prompt | `functions/_lib/prompt.js` |
| No sample draft in live mode: with no provider it fails with the calm retry message and an error log entry | `draft.js`, `draft` endpoint |
| Guided interview: `GET/POST /api/portraits/:id/interview`. Haiku reads the fact card (the story form) and the latest answer, fills fields in the customer's words, asks one question at a time, grief line, max 14 turns, 2,400 characters per answer. Transcript in `portraits.interview` (migration 0003) | `functions/_lib/interview.js` |
| Interview guard: a field the model fills is accepted only if every capitalised word (sentence starts included), year and number in it was already on the card or in what the customer just wrote; otherwise the customer's own words are stored instead | `interview.js` |
| Chat UI on the story step with Send / Skip / I don't know / That's enough; the form below is titled "What we know so far (edit anything)" and updates live. **On by default since Yara approved the design (2026-10-25)**; `INTERVIEW_ENABLED=false` turns it off, and it hides itself when no AI provider is set | `app.js`, `create.html` |
| Pre-existing mobile bug fixed: the live preview was `position: sticky` in the one-column layout and covered the editor while scrolling | `app.css` |
| Fixture: Wanis Ganim facts from Appendix E, with the cut-off age at death and great-grandchildren count deliberately left out | `data/fixtures/wanis-ganim.facts.json` |
| Fake Anthropic server for local tests of these flows | `scripts/mock-ai.mjs` |

### Verified
| Check | Result |
|---|---|
| `npm test` | 26/26 pass (12 new: validator, injection fence, cost math, provider fallback, spend cap, retries, live mode) |
| Validator on the real Oct 25 Gemini draft | 0 false alarms on names/places/numbers (its inventions are the semantic kind, left to layer 2) |
| Validator on invented "1925 … brother Joseph … Boston … two shops … 30 years" | all 5 caught |
| Wanis Ganim: clipping facts pass; "at the age of 95" and "12 great-grandchildren" | pass / both flagged (F-06 gold case) |
| Fallback when Anthropic says "credit balance too low" (the real Oct 25 error) | Gemini answers; both calls logged, the failed one as not ok |
| Local end to end with the fake server: interview 3 turns | fields filled; invented "ran for mayor of Boston" refused and the customer's words kept; grief line shown; 403 without edit cookie; 413 for 2,500 characters |
| Local: draft with an invention → fact check → rewrite | `attempts: 2`, final draft clean; "600-word target" gap removed; 7 `ai_calls` rows with token counts and cost |
| Local: spend cap ($0.39 already spent) | rewrite and interview both refused with 429 and the friendly message; `ai-budget` error logged |
| Chromium 360×760: chat → form fills → draft → "Please check" box | works, no console errors, no horizontal scroll |

### Real runs on the preview (2026-10-25, after the keys were added to Preview)
Test portraits were inserted straight into D1 (tagged `utm.test = wp2-seed-*`) because Preview enforces Turnstile, then driven through the real API with their edit tokens.

| Seed | Result |
|---|---|
| Elias Haddad | 200, Gemini (Anthropic refused: credit too low), fact check by Gemini, **0 unsupported, 1 attempt**. No "stone"/"homes"/"family business" this time; the word-target gap chip is gone. Remaining softness: subheadline "served his community", closing "steadfast devotion… quiet generosity" (characterisation, not facts) |
| Wanis Ganim (gold case) | 200, Gemini, 390 words, **0 unsupported**; uses only clipping facts and leaves out the cut-off age at death and great-grandchildren count |
| thin, italian, nonlatin, emoji, injection, grief | **502: both providers refused.** Anthropic "credit balance is too low"; Gemini **HTTP 429 "You exceeded your current quota, please check your plan and billing details"** (quota exhausted after two drafts: looks like a Gemini key without billing). The customer saw the calm retry message and the team error log has both reasons, as designed |

### Not verified (and why)
0. **Blocked on provider billing (Nick):** the Anthropic key in Preview still has no credit, and the Gemini key hit its quota after two drafts. Until both work, the remaining seeds (thin, rich, non-Latin, emoji, injection, grief), the interview with real models, prompt-cache hits and cost per portrait can't be measured.
1. **Real model behaviour** (interview quality, fact-check recall, injection attempts, cost per portrait, F-04/F-05/F-06 with 8 seed families, F-08 with 50 portraits): the keys are Cloudflare secrets I can't read, Preview has none, and the Anthropic account has no credit. All the AI logic above was tested against the fake server and stubbed `fetch`, not the real models.
2. **Prompt caching savings**: needs real Anthropic calls (`cache_read_input_tokens` > 0 on the second call).
3. ~~Migration 0003 is not applied to the real D1.~~ Applied 2026-10-25 after Nick's go-ahead (`portraits.interview` exists); the live site still creates and reads drafts (201/200).

### Known limits
- The code check can't tell a name at the very start of a sentence from ordinary capitalisation, so it skips those; the AI fact check covers them. The interview guard checks sentence starts too.
- Worst case one draft costs about $0.075 (3 article calls + 3 checks). Five rewrites plus a long interview can reach the $0.40 cap; typical drafts need 1–2 attempts. Raise `MAX_AI_COST_USD` if real data says so.

### Design note for Yara
New on screen: the chat box on step 2 (behind the switch), the "Please check these before you approve" box on step 4 (red left rule, same style as the existing "To make it stronger" box), and the mobile preview no longer floats over the editor.

---

## 2026-10-25 · First real AI draft (production)

Nick set the Pages build command. I retried the `main` build: production (`legacyportrait.pages.dev`) now runs `main` with the secrets, deployment `1f3d2fdf`, build + deploy success.

Real draft for test portrait `ecb3ea18…` (Elias Haddad answers):
- **Anthropic: failed.** `HTTP 400 invalid_request_error: Your credit balance is too low to access the Anthropic API`. The key is accepted; the account needs credit (Plans & Billing in the Anthropic console). The model id `claude-sonnet-5-5` was not rejected, but it is only proven once a call succeeds.
- **Gemini: worked as the silent backup.** `gemini-3.6-flash` model id confirmed. 4 paragraphs, 3 subheadlines, facts_used and gaps filled. ~16 s.
- **Unsupported claims in the Gemini draft**, the reason WP2's fact validator matters: subheadline "a life crafted in cedar and **stone**" (no stone in the answers); "the sturdy **homes** and porches he left behind" (answers: porches, and his own house); Rose "managed the **family business**" (answers: "Rose kept the books"); "Before leaving Lebanon, he had promised" (the timing is inferred). The draft is also short of the 600-word target and says so in a gap chip that mentions "the 600-word target" to the customer. WP2 should reword that.
- **The fallback is invisible to the customer, as designed.** The team needs an alert, though: WP1's error log records it (`draft-fallback`) once 0002 is applied and WP1 is deployed.

---

## 2026-10-25 · WP1 Foundations

### Done
| Item | Where |
|---|---|
| Migration `0002_foundations.sql` (additive): `portraits.edit_token_hash`, `portraits.email`; `orders` status/email/options/shipping/state/gift/livemode/refund columns; tables `stripe_events`, `ai_calls`, `email_log`, `config`, `errors` | `migrations/` |
| Config, the only place for these values: brand names, prices (D2), holiday calendar + `nextOrderBy` / `missedHoliday` (Appendix C, 23:59 New York cut-off) | `config/brand.js`, `config/products.js`, `config/holidays.js` |
| `LIVE_MODE` gate: live only if env `LIVE_MODE=true` **and** admin toggle `live_mode=on`. Flags: `FULFILLMENT_MODE` (manual default), `STRIPE_TAX_ENABLED` (false) | `functions/_lib/flags.js`, `GET/POST /api/admin/config` (team only) |
| Error log: `logError()` writes to `errors`; used by draft (all providers failed, or backup used) and print failures. Customer sees the copy-deck message, not internals | `functions/_lib/util.js` |
| Edit token: create sets an HttpOnly cookie scoped to `/api/portraits/<id>`; PUT, photo upload/delete, draft, approve need it (or the team token). `POST /claim` turns a private-link token into a cookie on another device. Older drafts (no hash) stay open | `functions/_lib/auth.js` |
| Turnstile widget on the photos step (explicit render, single-flight draft creation, token reset after use). Site key served by `/api/config` | `public/js/app.js`, `public/create.html` |
| HEIC converter self-hosted (heic2any 0.0.4, MIT, loaded only when an iPhone photo is added) | `public/vendor/heic2any/` |
| Server checks photo bytes (JPEG/PNG/WebP magic numbers), rejects 0 B and >8 MB with the copy-deck messages | `photos/[n].js` |
| Security headers: CSP (self + Turnstile only), nosniff, Referrer-Policy, Permissions-Policy, `noindex` on create/template/API | `public/_headers`, `functions/api/_middleware.js` |
| Unit tests (`npm test`, Node's built-in runner, no new dependencies): order-by dates incl. DST and cut-off second, prices, edit token, team token, cookie flags, image sniffing | `tests/` |
| README and HANDOFF corrected (branches, brand, Browser Run status, deploy notes) | |

### Verified (local `wrangler pages dev`, migrations 0001+0002 applied locally, Turnstile test keys)
| Check | Result |
|---|---|
| `npm test` | 14/14 pass |
| Create without Turnstile token / with token | 403 / 201 + `Set-Cookie: lp_edit=…; Path=/api/portraits/<id>; HttpOnly; SameSite=Lax` |
| PUT, photo delete, draft, approve **without** the cookie (leaked link) | 403 each, with the "only on the device where it was started" message. GET still works, `canEdit: false` |
| Same **with** the cookie | 200 / 201; approve → `approved` |
| Claim with wrong token / right token on a fresh cookie jar, then PUT | 403 / 200, then 200 |
| Photo: real JPEG / SVG renamed `.jpg` / 0 B / 8.1 MB / 4th slot | 201 / 415 / 400 / 413 / 400 (F-02 server side) |
| `/api/admin/config` without token / with token; toggle on with env `LIVE_MODE` unset | 401 / 200; public `liveMode` stays `false` (both halves required) |
| Headers on `/create.html` and API | CSP, nosniff, referrer policy, `x-robots-tag: noindex` present; `/` is indexable |
| Chromium at 360×760 (mobile): load create page, Turnstile renders and passes, add an **iPhone HEIC** photo | Draft created, photo converted and stored (1000×1250), no horizontal scroll, **no console errors** |
| Template page under the CSP | renders, `fit.ok`, no errors |

**Found by that test:** heic2any is an emscripten asm.js build and needs `eval`; the strict CSP blocked it and HEIC uploads failed. Fixed by allowing `'unsafe-eval'` on `/create` only (our code never evals). A WebAssembly HEIC decoder would let this narrow to `'wasm-unsafe-eval'`; noted for later.

### Applied and re-verified on the deployed preview (after Nick's go-ahead)
`wrangler d1 migrations apply DB --remote`: 0001 ✅ (no-op, now recorded), 0002 ✅. Preview `claude-pensive-planck-es8y45`: create 201 + cookie, PUT with/without cookie 200/403, SVG-as-JPG 415, real photo 201, draft 200, approve 200, `/api/config` ok, CSP and `noindex` on `/create.html`, HEIC script served. The live site (`main`) still creates drafts (201) on the migrated schema.

### Not done / blocked
1. ~~Migration 0002 is not applied to the real D1.~~ Done, see above. I was not allowed to run it from here (production change). It must be applied **before** this code is deployed anywhere, because the preview shares the production database and creating a draft writes `edit_token_hash`. Command: `npx wrangler d1 migrations apply DB --remote` (it will also record 0001, which is `IF NOT EXISTS` and safe). After that, I can deploy the preview and repeat the checks above on it.
2. Turnstile real keys: create a Turnstile widget for the Pages domain (and later the real domain) and set `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET`. Until then the check is off.
3. "Delete my data", retention, Cloudflare Access for `/admin`: later WPs as planned.
4. Live UI check on a real iPhone (Safari) and Android: UAT 1.

### Design note for Yara
The only visible change is the Turnstile box under the rights checkbox on step 1 (shown only while starting a new draft). The brand text in the top bar now comes from config (still "Legacy Portrait").

---

## 2026-10-25 · WP0 (part 2): why Pages builds fail, deployed Browser Run

### Why every Pages build since Phase 3a failed in ~1 s
Read from the build logs with the Cloudflare API token. It is **not** the `[browser]` binding:

```
No build command specified. Skipping build step.
Found Functions directory at /functions. Uploading.
✘ [ERROR] Could not resolve "@cloudflare/puppeteer"   _lib/print.js:3
Failed building Pages Functions.
```

The Pages project has an empty build command, so Pages never runs `npm install`, so `node_modules` is missing when it bundles the Functions. Phase 2 deployed fine only because nothing imported an npm package before `print.js`. Every build since (`phase-3-sell`, `main`, this branch) fails the same way.

**Fix (needs a dashboard change, I was not allowed to make it from here):** Pages project `legacyportrait` → Settings → Build → Build command: `npm ci --omit=dev` (output directory stays `public`). Then retry the latest deployment of this branch.

### Deployed preview (direct upload with wrangler, same code)
- `https://claude-pensive-planck-es8y45.legacyportrait.pages.dev`
- Deployment bindings reported by the API: `BROWSER`, `DB` (legacyportrait), `PHOTOS` (legacyportrait-photos), `nodejs_compat`. **Pages honours `[browser]` from `wrangler.toml`.** No separate render Worker needed.

### Verified on the deployed preview
Test portraits `cdbdce70…` and `6db80d30…` created through the public API (sample draft, approved), then marked `paid` directly in D1 (tagged `utm.test = wp0-browser-run`) because the preview has no `ADMIN_TOKEN`.

| Check | Result |
|---|---|
| `/print` without token, approved but unpaid | 403 |
| 11x14 PDF | 200 in 6.4 s, 1 page, 792×1008 pt, `x-fit-ok: true`, body 12 pt |
| 8x10 / 16x20 PDF | 1 page each, 576×720 / 1152×1440 pt |
| 11x14 / 8x10 / 16x20 PNG | 3300×4200 / 2400×3000 / 4800×6000 px |
| Same request again | from R2 cache in 0.49 s |
| Deployed 11x14 PDF vs `scripts/render.py` with the same render JSON, rasterised at 100 dpi | **0 px differ** (1100×1400) |
| Requests fired back to back | 2nd and 3rd got 502: `Unable to create new browser: code: 429: Rate limit exceeded`; fine after ~20 s |

### Change made because of the 429
`_lib/print.js` now reuses an idle Browser Run session (`puppeteer.sessions` + `connect`), launches with `keep_alive: 60 s` and disconnects instead of closing, and waits 12 s and retries once if launching is rate limited. `x-browser: reused | launched | launched after wait` is on each freshly rendered response. First version still failed one request: a just-released session is not listed as free for a few seconds. Now it polls for a free session (and retries a rate-limited launch) for up to 25 s. **Verified on the deployed preview:** 4 uncached renders back to back (8x10, 11x14, 16x20 PNG + 11x14 PDF) all 200, `launched` then `reused` ×3, 2.5–6.2 s each. The Workers paid plan (higher limits) is still needed before launch.

### Real AI drafts: still not run
- **Preview** environment has **no secrets at all** (no `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `ADMIN_TOKEN`). They are set on **Production** only. A preview draft therefore comes back in sample mode.
- **Production** (`legacyportrait.pages.dev`, still the Oct 20 `phase-2-generate` build) also returned **sample mode** for a test portrait (`ecb3ea18…`, `utm.test = wp0-real-ai`). Most likely the keys were added after that deployment. Pages only applies secrets to new deployments. Possibly the values are placeholders (<20 chars).
- **To unblock (Nick):** either (a) add `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and `ADMIN_TOKEN` to the **Preview** environment and redeploy this branch, or (b) fix the build command and let `main` redeploy Production. To test Gemini on its own, the Anthropic key must be missing for that environment (Gemini is only the backup), so (a) with only the Gemini key first, then both, is the cleanest.

### Test data left behind (production D1/R2)
Portraits `cdbdce7016990761b4f43c7cbe4669c3` and `6db80d30cfef47f650aee3c283ed96c0` (status `paid`, test) and `ecb3ea18d6d104faf26e28bb0832a61e` (draft, test), their photo, and cached print files under `prints/v2/<those ids>/`. Safe to delete; the retention job (WP9) would remove them anyway.

### Risk list changes
- Risk 1 (Browser Run on Pages): **closed**, works.
- New, High: **Pages build command missing**. Every deploy fails until it is set. Production is stuck on the Oct 20 build.
- New, Medium: **Browser Run launch rate limit** on the free plan. Mitigated in code; fully fixed by the paid plan.
- Risk 4 (real-key AI test): still open, now blocked on secrets for the right environment.

---

## 2026-10-25 · WP0 Reality check

### Done
- Read the whole repo (functions, public, migrations, scripts, docs). Ran it locally (`wrangler pages dev`, local D1/R2, local Browser Run).
- Drove the create flow through the API: create → answers → photo upload → draft (sample mode) → approve → print.
- **Fixed a print bug** (`functions/_lib/print.js`): PDFs were rendered at `deviceScaleFactor: 1`, so the halftone photo inside every PDF (the file Gelato prints) was drawn at screen resolution (~96 dpi, visibly coarse/banded). Now uses the full 300 DPI scale for PDF and PNG, the same as `scripts/render.py`.

### Verified (locally, with evidence)
| Check | Result |
|---|---|
| `render.py` reference, 11x14 | 1 page, 792×1008 pt (11×14 in), fit ok, body 12 pt |
| `/print` 8x10 / 11x14 / 16x20 PDF via `@cloudflare/puppeteer` (wrangler local Browser Run) | 200; 1 page each; 576×720 / 792×1008 / 1152×1440 pt; `x-fit-ok: true` |
| `/print` 11x14 PNG | 3300×4200 px (300 DPI) |
| `/print` second request | served from R2 cache in 0.02 s |
| `/print` without token on unpaid portrait | 403 |
| API PDF vs `render.py` PDF, same data, rasterised at 100 dpi | **152 px differ** (was 180,670 before the fix; the difference was the photo) |
| Production D1 `legacyportrait` (via Cloudflare connector) | tables `customers`, `portraits`, `orders` exist. No `d1_migrations` table: 0001 was applied by hand. Safe to re-apply (`IF NOT EXISTS`), but use `wrangler d1 migrations apply DB --remote` from now on |
| R2 bucket `legacyportrait-photos` | exists |

### Not verified (and why)
1. **Browser Run on the deployed Pages project.** No deploy credentials here: wrangler is not logged in and the Cloudflare connector can read D1/R2/Workers but cannot deploy Pages or set secrets. Still unknown: whether Pages honours `[browser]` in `wrangler.toml`. **Needed:** either a `CLOUDFLARE_API_TOKEN` (Pages edit + D1 + R2) added as an environment secret for this session, or Nick deploys the branch preview and opens `/api/portraits/<id>/print?size=11x14&format=pdf&token=<ADMIN_TOKEN>`.
2. **Real Anthropic and Gemini drafts.** No keys in this environment (correctly: they must not be pasted in chat). Only sample mode was exercised. Needs the keys set as Pages secrets on the preview, or as environment secrets for the session.
3. **"Passes the fact validator."** There is no fact validator yet. `validateDraft` only checks JSON shape. A real check (every name, year and place in the draft must appear in the customer's answers) is WP2 work; noted as a WP0 acceptance gap.

### Corrected risk list
| # | Risk | Severity | Note / next step |
|---|---|---|---|
| 1 | Browser Run binding not honoured by Pages | High | Unproven. Fallback: tiny separate render Worker with the `BROWSER` binding, called by the Pages Function. Decide after one preview deploy |
| 2 | Print PDF photo at screen resolution | High | **Fixed in this PR** |
| 3 | No fact validator; AI output only shape-checked | High | WP2 |
| 4 | No real-key AI test yet; model ids `claude-sonnet-5-5` / `gemini-3.6-flash` unconfirmed against live APIs | Medium | WP0 follow-up once keys are set |
| 5 | Draft link is the only access key; no edit token | Medium | WP1 (edit token) |
| 6 | Turnstile widget missing on the page; HEIC library loaded from a CDN | Medium | WP1 (known) |
| 7 | No prompt caching, cost tracking or spend cap in `draft.js` | Medium | WP2 |
| 8 | Docs stale: HANDOFF/README name branches `phase-2-generate`/`phase-3-sell` (merged to `main`), "Kin Gazette" brand (now The Legacy Press), and say Phase 3a is untested | Low | Update in WP1 |
| 9 | Browser Run free tier ~10 min/day | Low | Each print takes 1–3 s of browser time and is cached; switch to Workers paid plan before launch (approved) |

### Notes for whoever runs it locally
- Chromium refuses to start as root (`Running as root without --no-sandbox`). That is a container quirk only; run `wrangler pages dev` as a normal user.
- `pkill -f "wrangler pages dev"` also kills the shell that runs it; kill `workerd` by name instead.
