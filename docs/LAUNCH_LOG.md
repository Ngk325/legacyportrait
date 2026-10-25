# Launch log

Running record: what was done, what was verified, what is blocked. Newest first.

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
