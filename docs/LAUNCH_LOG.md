# Launch log

Running record: what was done, what was verified, what is blocked. Newest first.

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
Test portrait `cdbdce70…` created through the public API (sample draft, approved), then marked `paid` directly in D1 (tagged `utm.test = wp0-browser-run`) because the preview has no `ADMIN_TOKEN`.

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
`_lib/print.js` now reuses an idle Browser Run session (`puppeteer.sessions` + `connect`), launches with `keep_alive: 60 s` and disconnects instead of closing, and waits 12 s and retries once if launching is rate limited. `x-browser: reused | launched | launched after wait` is on each freshly rendered response. **Only partly proven:** the first burst after the change still hit one 429 (it worked on a retry), and the run that would show whether reuse happens was cut off. Check the `x-browser` header on the next burst. The real cure is the Workers paid plan (higher launch limits), already approved.

### Real AI drafts: still not run
- **Preview** environment has **no secrets at all** (no `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `ADMIN_TOKEN`). They are set on **Production** only. A preview draft therefore comes back in sample mode.
- **Production** (`legacyportrait.pages.dev`, still the Oct 20 `phase-2-generate` build) also returned **sample mode** for a test portrait (`ecb3ea18…`, `utm.test = wp0-real-ai`). Most likely the keys were added after that deployment. Pages only applies secrets to new deployments. Possibly the values are placeholders (<20 chars).
- **To unblock (Nick):** either (a) add `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and `ADMIN_TOKEN` to the **Preview** environment and redeploy this branch, or (b) fix the build command and let `main` redeploy Production. To test Gemini on its own, the Anthropic key must be missing for that environment (Gemini is only the backup), so (a) with only the Gemini key first, then both, is the cleanest.

### Test data left behind (production D1/R2)
Portraits `cdbdce7016990761b4f43c7cbe4669c3` (status `paid`, test) and `ecb3ea18d6d104faf26e28bb0832a61e` (draft, test), their photo, and cached print files under `prints/v2/cdbdce70…/`. Safe to delete; the retention job (WP9) would remove them anyway.

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
