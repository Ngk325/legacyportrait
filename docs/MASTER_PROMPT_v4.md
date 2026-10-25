# MASTER BUILD PROMPT v4: The Legacy Press / Legacy Portrait (launch edition)

*For Claude Code (Opus). Repo: `Ngk325/legacyportrait`. v4, 2026-10-25, written by the Claude project assistant for Nick (N.G. Khamarji, Stratfield Partners) and Yara. Supersedes v3 and `legacy-portrait-build-prompt.md` (which assumed Printful and an older model). **Nick's answers to the v3 questions are locked in Appendix A: treat them as decisions, not suggestions.***

---

## 0. How to use this prompt

Paste this whole file into Claude Code as the first message in the repo root. Put the reference image of the heirloom clipping in `docs/reference/wanis-ganim-clipping.jpg` (Nick will add it). Then say: **"Start with Section 12, Work Package 0, and report back before touching Stripe or Gelato."**

You are the lead engineer AND launch operator. Read `docs/HANDOFF.md`, `README.md`, `wrangler.toml`, `migrations/0001_init.sql`, and every file under `functions/` and `public/` before writing code. Nothing in this prompt overrides the **Hard rules** in Section 2.

Anything marked **[VERIFY]** is a fact I could not confirm from a primary source today. Check it against current official docs (Stripe, Gelato, Anthropic, Cloudflare, Meta) before building on it, and tell Nick and Yara if reality differs.

---

## 1. The business in one page

**Product.** A customer uploads 1–3 old photos of an ancestor and tells us about them. AI writes a dignified, black-and-white, vintage-newspaper-style profile. The customer edits and approves it. We deliver it as a **digital download** or a **framed print** (printed and shipped by Gelato). The customer is the byline author.

**Why it sells.** It is a gift that is emotional, personal and visual. The example portrait IS the ad.

**Buyer.** US adults, ~35–65, buying for a parent or grandparent, or honoring their own family. Secondary: US heritage communities (Lebanese, Italian, German, Irish, Jewish, etc.). **USA only at launch (shipping and marketing).** No international.

**Season.** Today is **Sun 2026-10-25**. Christmas is 61 days away. Framed gifts for Christmas must be ordered by **Thu Dec 10** (Appendix C has the full holiday calendar and the formula). Digital sells until Dec 24 and beyond (Valentine's, Mother's Day, Father's Day, memorials are real off-season demand).

**Team.** Nick = owner/marketing/approvals (working from Lebanon, slow internet, so keep deliverables light). Yara = technical co-builder. Maria and Manuela are **not** involved. Profit split is handled offline: do not build anything for it.

**What exists already** (verified by reading the repo and handoff):

| Area | State |
|---|---|
| Newspaper template (HTML/CSS/JSON, auto-fit, halftone photo, hyphenation) | Built, approved by Yara |
| Create flow (photos → questions → style → AI draft → edit → approve) | Built, tested on deployed test site. Only mocked AI responses tested |
| AI writer | `functions/_lib/draft.js`: Anthropic → Gemini → labelled sample. Never tested with a real key |
| Print files (PDF/PNG 300 DPI via Browser Run) | Written, merged to `phase-1-template`, **never run against a real browser**. Unknown whether `[browser]` binding works on a Pages project |
| D1 schema | `customers`, `portraits`, `orders` |
| Stripe, Gelato API, Resend, emails | **Not started** |
| Landing page | Stub (`public/index.html`) |
| Turnstile widget, privacy/terms, retention job, analytics, cookie banner | **Missing** |
| Admin | **Missing** (only a token-gated print endpoint) |
| Brand/domain | **Decided: The Legacy Press (company/brand) and Legacy Portrait (product).** Domain not bought yet (see Section 4) |

---

## 2. Hard rules (non-negotiable)

1. **Stripe stays in TEST mode and Gelato in DRAFT/manual mode until Nick types an explicit "go live."** Implement a single `LIVE_MODE` gate (env var + admin toggle) that must be flipped by Nick. Nothing charges a real card before that.
2. **Never invent facts in customer stories.** The customer approves every word before payment or printing.
3. **Never commit secrets.** Keys live in Cloudflare Pages secrets and `.dev.vars` only. If you see a key pasted anywhere, stop and tell the user to rotate it.
4. **Verify third-party API details against current docs** before using them. Mark what you verified in `docs/INTEGRATIONS.md`.
5. **Simple beats clever.** Every added service needs a one-line justification. Ask before adding any service not listed here.
6. **Mobile first.** Most traffic will be Instagram/Facebook on phones. Test at 360 px wide.
7. **Design changes need Yara's approval before commit** (existing team rule). Do not alter the newspaper template's look without it.
8. **Read before you commit.** Two past bugs came from committing unread code.
9. Placeholder legal text is **DRAFT, flagged for review by Nick (and a lawyer if possible)**. Never present it as final.
10. Work on a feature branch off `phase-1-template`; open a PR per work package with the QA evidence attached. Nick approves merges.
11. Keep a running `docs/LAUNCH_LOG.md`: what you did, what you verified, what is blocked.

---

## 3. Strategy decisions I am making (override if you disagree)

I am treating this as a launch in ~7 days, not a perfect product. These are the calls I would make as the operator.

**D1. Preview-then-pay.** The customer completes the whole create flow and sees a **watermarked live preview of their finished portrait before they pay**. Payment unlocks the clean file and the print options. This is the single biggest conversion lever: they have already invested effort and seen the product. Do NOT put a paywall before the preview.

**D2. Offer and prices (my decision per Nick; all values live in `config/products.js`, never in logic).**

| Product | Sizes | Price (US$, tax included) | Includes |
|---|---|---|---|
| **Digital portrait** | n/a | **$19** | PDF (print-ready, all 3 sizes) + share image |
| **Print only** (unframed, semi-gloss) | 8×10 / 11×14 / 16×20 | **$39 / $49 / $69** | Digital portrait **bundled free** |
| **Framed, assemble-yourself** (wood, dark wood, black) | 8×10 / 11×14 / 16×20 | **$79 / $109 / $149** | Digital portrait **bundled free** |
| **Framed, assembled, ready to hang** | 8×10 / 11×14 / 16×20 | **+$15** (= $94 / $124 / $164) | Digital portrait bundled free |

- **Bundle rule (Nick, decision 4):** every physical order includes the digital file. There is no separate digital add-on at checkout. The lone **$19 digital** is the entry tier, and the print cards say "Includes the digital file ($19 value)."
- Hero card: **Framed 11×14, assembled, "Most popular"**. The $164 16×20 is the anchor.
- Express shipping (+$5–6 per the Oct 14 call) is hidden until Yara's Gelato test order proves a real speed gain.
- Prices are **tax-inclusive** and Stripe Tax stays **off** (Nick will pay tax himself). Do not add tax lines at checkout. Put "Price includes applicable tax" in the cart footer.
- **Margins (Appendix B)** use the Oct 14 call costs (unframed 11×14 ≈ $12, framed 11×14 ≈ $45) and are **before ad spend**, as Nick confirmed. Replace every cost with Gelato's real quote for the exact product UID before launch.

**D3. Physical shipping honesty.** Show the **"Order by" date** on every product page and in the cart, computed from Appendix C (the next relevant holiday, automatically). After the date passes, physical options switch to **"Gift card now, ships after the holidays"** (see D5). Never promise delivery beyond what Gelato supports.

**D4. Free standard US shipping** baked into the price. **USA only**: the address form accepts US states and DC (APO/FPO only if Gelato supports it; otherwise block). No international shipping in v1. (Digital downloads work anywhere, but we do not market abroad.)

**D5. Gift mode.** A "This is a gift" toggle at checkout that (a) sends the buyer a printable gift card PDF ("A portrait of Grandpa Elias is on its way") with the portrait thumbnail, and (b) lets late buyers (after the order-by date) buy now and have the physical print ship right after, with the printable gift card to hand over on the day. This recovers Dec 11–25 demand. Show the real estimated arrival date; never say "arrives before Christmas" after the order-by date.

**D6. LLM cost design.** See Section 6. Short version: **Claude Haiku 5.5 for the interview**, **Claude Sonnet 5.5 for the final article**, prompt caching, per-portrait spend cap. Expected AI cost per completed portrait: **well under $0.15**, versus $19–119 revenue [VERIFY pricing in Section 6].

**D7. Cut from v1 (decided).** International shipping and marketing, the **Arabic/RTL second-language nameplate (removed entirely; no Noto Naskh Arabic font)**, more than three sizes, multi-language UI, referral program. **Optional AI photo cleanup** stays post-launch unless WP0–WP8 finish early.

**D8. Manual-first fulfillment.** Per the handoff: the first N real orders are placed by hand in the Gelato dashboard from an admin screen; automate through the Gelato API only after test orders succeed. I still want the API code written behind a feature flag and exercised in **draft** mode so the switch is one setting. (See Section 8.)

---

## 4. Brand and identity

**Name (decided by Nick).** **The Legacy Press** is the company/brand; **Legacy Portrait** is the product ("a Legacy Portrait from The Legacy Press"). Kin Gazette is dropped. The customer's own newspaper masthead (for example "The Haddad Family Gazette") is customer-editable and separate from our brand. The code reads `BRAND` from one config file so a rename is a one-file change; never hard-code the name in copy.

**Domain (not bought yet).** Check availability at Cloudflare Registrar in this order and buy the first that is free and short: `thelegacypress.com`, `legacyportrait.com`, `thelegacypress.co`, `legacyportraits.com`, `getlegacyportrait.com`. Also check USPTO for "Legacy Press" and "Legacy Portrait" and the Instagram/Facebook/TikTok/Pinterest handles before paying. **Nick decides which account buys it.** Until bought, run on the `*.pages.dev` URL; DNS, the Resend sending domain, Stripe branding and Pixel domain verification all wait on this, so it is the first launch blocker.

**Voice.** Warm, dignified, plainspoken. Like a trusted local editor. No hype, no exclamation points in product copy, no "AI-powered" selling. The AI is a means, never the headline. Say "we help you write it," not "AI generated it," while being honest if asked (see FAQ).

**Visual identity** (extend the newspaper template, do not fight it):
- Paper: warm off-white `#F4EFE4`; ink: `#1A1A18`; accent (single): deep oxblood `#7A1F1F` for CTAs and the order-by banner; muted rule/gray `#8A8577`.
- Type: masthead UnifrakturCook (already in repo), headlines Playfair Display, body Old Standard TT, UI sans: a neutral system or Inter-class sans for form labels and buttons for legibility.
- Imagery: black-and-white halftone portraits; framed-in-room mockups on warm wood walls; hands holding the print.
- Buttons: solid oxblood with paper-colored text, 48 px min height, 8 px radius. Focus rings visible. WCAG AA contrast.
- Favicon/logo: a simple masthead wordmark. Ask Nick to approve before launch.

**Example portraits (the core ad asset).** Produce 6–8 sample portraits using real-feeling but fictional, clearly **labelled "Example"** families across different cultures and eras (Lebanese emigrant, Italian immigrant, German farmer, Irish nurse, Black Southern preacher/teacher, Jewish tailor, Mexican-American railroad worker, mid-century soldier). Use the existing `data/elias-haddad.json` as the model. Use only public-domain or AI-generated photos with a clear license, and **never present fictional people as real customers**. Mockups: flat, framed-on-wall (use Canva or a mockup tool), and hand-held. Store in `public/examples/`.

---

## 5. Site map and funnel architecture

```
Ad / post / group / email / search
        │
        ▼
 Landing page "/"  ──────────►  Example gallery "/examples"
   (hero, how it works,                │
    examples, pricing,                 │
    order-by banner, FAQ)              │
        │ CTA: "Start your portrait (free preview)"
        ▼
 /create  Step 0 (email capture, optional, consent checkbox)
        │
  1 Photos → 2 Story (guided interview) → 3 Look & length → 4 Draft & edit
        │
        ▼
 Preview page (watermarked)  ──► "Unlock your portrait" 
        │
        ▼
 Choose product (digital / framed sizes / gift mode) (digital bundled with every print)
        │
        ▼
 Stripe Checkout (test mode until go-live) ──► Success page
        │                                          │
        ▼                                          ▼
 Webhook → order row → Resend confirmation   Digital: signed download links
        │                                     Print: admin queue → Gelato
        ▼
 Post-purchase: tracking emails, review ask, share-a-portrait, "make one for another relative" (10% off, 14 days)
```

**Recovery loops (Resend):**
1. *Abandoned draft* (email captured, not paid): +1 h ("Your draft is saved, here is the link"), +24 h (show one line from their own story + preview link), +72 h (soft urgency: order-by date), +7 d (last note, offers help). Stop on purchase or unsubscribe.
2. *Previewed, not paid* (strongest): +30 min, +24 h with the watermarked preview thumbnail inline.
3. *December countdown* to all subscribers: 14, 7, 3 days and "last day" before the order-by date (copy in 10.9).
4. *Post-purchase*: confirmation, "we're printing", "shipped + tracking", delivered + review ask, +30 days "who else deserves a portrait?"

**Every email:** plain-text version, one clear CTA, unsubscribe link, physical business address (CAN-SPAM), sent from a verified subdomain (SPF/DKIM/DMARC set up in Resend). Marketing emails only to those who opted in (separate checkbox, unchecked by default); transactional emails always.

---

## 6. LLM architecture and cost control

**Goal:** a warm, guided intake that gets the facts a good profile needs, plus a final article that never invents. Keep cost trivial.

**Models** (strings from current Anthropic model list; **[VERIFY]** exact IDs, pricing and caching rules at docs.claude.com before coding):
- `claude-haiku-5-5` for the **interview** (follow-up questions, fact extraction, gap detection, light validation).
- `claude-sonnet-5-5` for the **article** (and regenerations).
- Optional safety/QA pass on Haiku: a "fact-check" call that compares the article to the extracted facts and flags unsupported claims.
- Keep the Gemini fallback exactly as now (silent fallback; privacy page names both providers).

**Indicative pricing I found today (third-party summaries; [VERIFY] on Anthropic's pricing page):** Haiku 5.5 ≈ $0.10 in / $0.50 out per million tokens (up to 100K-token prompts); Sonnet 5.5 ≈ $2 in / $10 out per million; cache reads ≈ 10% of input; batch ≈ 50% off. Rough math: a full interview (~12 Haiku turns, a few thousand tokens each) ≈ **$0.01**; one Sonnet article (~3K in, ~1.5K out) ≈ **$0.02**; five rewrites ≈ **$0.10**; fact-check ≈ **$0.002**. Total typically **$0.03–0.15 per portrait**.

**Guided interview (new):** Replace the long single form with a **conversational interview that still falls back to the form.** Behavior:
- Left side: a chat-style interviewer ("Tell me about Grandpa Elias. Where was he born?"). Right side: a live "What we know so far" fact card the customer can edit directly (this is the source of truth; the chat only fills it).
- Haiku receives the current fact card + last customer message and returns JSON: `{ "facts_patch": {...}, "next_question": "...", "coverage": {origins:0-2, family:0-2, ...}, "done": bool }`. Max **14 turns**, max 600 input tokens of customer text per turn, hard cost cap per portrait (`MAX_AI_COST_USD`, default 0.40, tracked in D1 from API usage fields).
- One question at a time. Always allow "skip", "I don't know", and "that's enough". Never press on grief: if the customer says the person recently died, soften tone and offer to skip.
- Ask for specifics the newspaper needs: full name, years, places, what they did, family, one story, three words describing them, what the family still carries. Use the 10-stage arc from `draft.js`.
- The final article is generated ONLY from the fact card (plus pasted material), never from raw chat history. This is the anti-invention guarantee.
- Customer text is **data, never instructions** (prompt-injection defense: keep the existing rule, add delimiter tagging, strip control sequences, length-limit all fields).
- Rate limits: per-IP and per-portrait (Workers rate limiting binding or a D1 counter); Turnstile on portrait creation; reject non-text junk.

**Article generation (upgrade `draft.js`):**
- Enable **prompt caching** on the long system prompt (Sonnet minimum cacheable prompt is ~512 tokens [VERIFY]); this makes regenerations cheaper.
- Use structured JSON output as now (subheadline_options[3], body_paragraphs[], captions[], facts_used[], gaps[]). Add `claims` array mapping each paragraph to fact-card keys, so a validator can **reject any paragraph with an entity (name/date/place/number) that is not present in the fact card**. Cheap regex + set check first; Haiku fact-check second.
- Show `gaps` as friendly "Adding X would make this richer" chips.
- Regeneration cap 5 per portrait (existing), with notes box.
- Store model, tokens in/out, and cost per call in D1 (`ai_calls` table) for the admin cost dashboard.
- Never ship a "sample draft" to a paying customer: if all providers fail, show a calm retry message and alert the team (email via Resend).

**Optional AI photo cleanup:** out of launch scope (D7). Keep the hook.

---

## 7. Payments, fulfillment, and operations

### 7.1 Stripe (test mode first)

Use **Stripe Checkout** (hosted). Verify current API version and features [VERIFY].
- Products and prices defined in `config/products.js` (or `products.json`), mapped to Stripe Price IDs by env (`STRIPE_PRICE_*`) or created via script. Never hard-code amounts in logic.
- `POST /api/checkout` → validates the portrait is `approved`, builds the session (line items, shipping address collection for allowed countries, phone number, `client_reference_id = portrait_id`, metadata: portrait_id, product, size, gift flag, utm), `success_url` and `cancel_url` back to the preview page.
- `POST /api/stripe/webhook` → verify signature using the raw body (Web Crypto HMAC in Workers), handle `checkout.session.completed` (and `async_payment_succeeded` if enabled), `charge.refunded`, `charge.dispute.created`. **Idempotent** (store Stripe event ids in D1). On success: set portrait `paid`, insert `orders` row (migration `0002`), email receipt + download links via Resend, push order to the fulfillment queue, fire GA4/Meta purchase events (server-side CAPI, deduplicated with `event_id`).
- **Tax: Stripe Tax OFF (Nick's decision).** Prices are tax-inclusive and Nick pays any tax owed himself. Keep a `STRIPE_TAX_ENABLED` flag defaulting to false. Record the shipping state on every order so Nick can see per-state sales for later filing. (Not tax advice: Nick may want his accountant to confirm obligations.)
- Promo codes: enable Stripe promotion codes; create `WELCOME10`, `FAMILY10`(repeat buyers), and a team 100% code for test orders.
- Apple Pay / Google Pay: enable (huge for mobile conversion).
- **Refund/reprint policy (Nick):** 7 days from delivery (digital: 7 days from purchase) for a refund or free reprint. Because the customer approves the final text before production, errors in approved text are theirs; print defects and shipping damage are ours and are reprinted free. Implement one-click refund and reprint in admin and state the policy at checkout, in the terms and in the FAQ.

### 7.2 Admin (Cloudflare Access or `ADMIN_TOKEN` fallback)

Routes under `/admin` (`noindex`, protected; prefer **Cloudflare Access** with Nick's and Yara's emails; keep `ADMIN_TOKEN` for local dev):
- **Orders queue:** paid orders, status, product, size, shipping address (copy button), buttons: *Download print file (PDF/PNG)*, *Mark placed in Gelato + paste order id*, *Paste tracking*, *Refund*, *Resend email*.
- **Review step (quality gate):** before the print file is released, show the rendered portrait with the `__FIT__` result (did text fit? body size?), and a checklist (text fits, photo resolution OK, no blank areas). Flag short stories for the "short story layout" variant.
- **Drafts and funnel:** counts by status (draft → previewed → approved → paid), emails captured, AI cost, error log.
- **Config:** order-by dates, `LIVE_MODE` banner status, prices (read-only view of config).

### 7.3 Print files

- Validate with a real Browser Run test **first** (Work Package 0). If the `[browser]` binding does not work on Pages, move rendering to a **small separate Worker** with the binding and call it from the Pages Function (service binding or authenticated fetch). Do not burn time hoping.
- Free Browser Run limit is ~10 min/day; require the **$5/month Workers paid plan before launch** (per the handoff).
- Output: 8×10, 11×14, 16×20 at 300 DPI (3300×4200 for 11×14), cached in private R2, served via **signed, expiring URLs**. Make each file idempotent and checksum-stable, so reprints are identical.
- Low-resolution photo guardrail stays (warn pre-payment; recommend a smaller size; allow the customer to proceed knowingly; admin sees the warning).
- Short-story layout variant (Known gap #3): larger text and bigger photo when word count < ~250.

### 7.4 Gelato (vendor-abstracted)

Build a `FulfillmentProvider` interface with two implementations: `manual` (admin screen) and `gelato` (API). Switch via `FULFILLMENT_MODE=manual|gelato_draft|gelato_live`.

Product matrix to map to Gelato `productUid`s (Nick's decision): sizes **8×10, 11×14, 16×20**; frame colors **wood, dark wood, black**; each **assembled or not assembled**; plus **print-only (no frame)**. That is 3 sizes × (3 colors × 2 assembly + 1 print-only) = 21 SKUs. Keep the mapping as data (`config/gelato-products.js`) with a script that fails loudly on any missing UID.

Verified from Gelato's developer docs today: orders go to `POST https://order.gelatoapis.com/v4/orders` with an `X-API-KEY` header; required fields include `orderType`, `orderReferenceId`, `customerReferenceId`, `currency`, `items[]` (`itemReferenceId`, `productUid`, `files[]` with a URL, `quantity`), `shipmentMethodUid`, `shippingAddress`; accepted files are JPEG/PNG/SVG/PDF; webhooks include `order_status_updated`, `order_item_status_updated` and `order_item_tracking_code_updated`, must be TLS POST endpoints returning 2xx, retried up to 3 times 5 s apart, and **the docs describe no signature scheme**. So:
- Authenticate the webhook with a **long random secret in the URL path** plus an allow-check on `orderReferenceId` matching an existing order; make the handler idempotent.
- **[VERIFY]** the draft order type and quote/shipping-estimate endpoints (the pages I could read mention only `orderType: "order"`). Confirm whether a draft/test mode exists. If not, use `gelato_draft` mode = build the exact payload and store it in D1 for admin review without sending.
- **[VERIFY]** the exact `productUid` for the chosen framed poster (wood colors, **no white**, unassembled), per size, from Gelato's Catalog API/dashboard, and the `shipmentMethodUid` values for standard and express to the US.
- Gelato fetches print files by URL: give it a signed R2 URL valid long enough for production (e.g. 7 days).
- Store `provider_order_id`, `fulfillment_status`, tracking in `orders`; send the tracking email on the tracking webhook.
- **Order-by dates.** Sources conflict: the Oct 14 call said cutoff ~Dec 18–20 with 4–6 day delivery; Gelato's API says 7–11 days. Nick delegated this to me: use the conservative formula **order-by = holiday date − 15 days** (11 days worst-case production and shipping + 2 days for approval/admin review + 2 days carrier buffer). Compute it from the holiday calendar in **Appendix C** (`config/holidays.js`), show the next upcoming date automatically, and loosen it only after Yara's real test order proves faster delivery.
- **International is out of scope.** US addresses only.
- **Test order immediately:** Yara places one real low-cost Gelato order to a team address (before launch) to measure true production + shipping time and print quality, then we update the order-by dates and the unit-economics sheet.

### 7.5 Email (Resend)

Verify the sending domain (SPF/DKIM/DMARC). Templates: order confirmation, download ready, gift card, in production, shipped with tracking, delivered/review ask, refund, abandoned-draft ×4, previewed-not-paid ×2, December countdown ×4, welcome. Use React Email or plain HTML templates in `emails/`, with plain-text fallbacks. Unsubscribe and preferences handled in D1 (`customers.marketing_opt_in`).

### 7.6 Privacy, retention, legal

- Pages: `/privacy`, `/terms`, `/refunds`, `/shipping`, `/contact`. Footer links on every page. **DRAFT text flagged for review.**
- Privacy must name the processors: Cloudflare, Stripe, Anthropic, Google (Gemini fallback), Resend, Gelato, analytics vendors. State that stories and photos are sent to AI providers to write the draft and are **not used to train models** where the provider terms say so [VERIFY each provider's API data terms; for Gemini use only a **billing-enabled** key].
- Retention (earlier plan): unpaid drafts and photos deleted after **30 days**; paid originals kept **90 days** after delivery (customer may request earlier deletion). Implement a daily **scheduled Worker (cron)** that deletes expired rows and R2 objects, and a customer-facing "Delete my data" request path (email form → admin).
- Photo rights checkbox (exists) is logged with a timestamp. Terms: customer warrants rights; we may refuse content; reprint policy for our errors (free reprint) vs customer typos approved by them (not refundable), made-to-order items final once production starts.
- Cookie/consent banner for GA4 and Meta Pixel (opt-in in EU/UK; at minimum a clear notice in the US). Do not fire marketing pixels before consent where required. Server-side CAPI sends hashed data only with consent.
- Children: not targeted; no data from under-13s.
- Memorial use: content for deceased relatives is the main use; keep tone sensitive in copy.

---

## 8. Technical hardening checklist

- Turnstile widget on the first step; send token with `POST /api/portraits` (Known gap #1). Use Cloudflare test keys first.
- Self-host the HEIC converter (Known gap #2); no third-party CDN scripts on the site except analytics (consent-gated).
- Security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`), `noindex` on all draft/admin/preview pages, signed URLs for photos, size/type validation server-side, R2 not public.
- Unguessable portrait ids (exists); add a short-lived **edit token** in a cookie so a leaked link cannot overwrite an approved portrait.
- Observability: structured logs, an `errors` table, and an email alert on webhook failure, AI failure, print failure.
- Migrations: `0002_orders_payments.sql` (orders extension, `stripe_events`, `ai_calls`, `email_log`, `config`), run local then remote.
- Tests: unit tests for pricing, order-by logic, webhook idempotency, fact-validator; integration test script for create→approve→checkout→webhook (Stripe CLI `stripe listen`/`trigger`); Playwright E2E on mobile viewport (fix the workspace-specific path in `scripts/e2e.py`).
- Performance: landing page LCP < 2.5 s on mid-range mobile; lazy-load images; AVIF/WebP examples.
- Accessibility: keyboard navigation, labels, alt text, color contrast AA, `aria-live` for save state (exists).

---

## 9. Marketing and traffic plan (executable)

**9.1 Positioning.** *"A front page for the person who made your family."* Core promise: a keepsake in their own words and photos, finished in minutes, ready to give before the holidays.

**9.2 Offer and urgency.** Real deadlines only: order-by banner counting down to the configured date; gift-card mode after it. Launch promo: `WELCOME10` for email signups (10% off, expires on the order-by date).

**9.3 Paid (Meta), the test plan.**
- Install Meta Pixel + Conversions API first (events: `ViewContent` landing, `Lead` email capture, `InitiateCheckout`, `AddPaymentInfo`, `Purchase` with value). Dedup using `event_id`. Verify Domain, set Aggregated Event Measurement priority [VERIFY Meta's current requirements].
- **Budget (Nick): $15/day total.** The full ready-to-paste build is in **Appendix D (Meta Ads Build Sheet)**. At $15/day, purchase-optimized delivery will starve (fewer than ~3 purchases a week), so optimize for the `Lead` event (email captured at Step 0) and retarget the rest. Claude Code only needs to wire the Pixel/CAPI events the sheet names.
- 3 creatives × 2 headlines. Creative A: video of a portrait appearing from a photo (screen capture + paper texture). Creative B: framed print in a living room + hands. Creative C: before/after "one old photo → a front page." Hooks: "Give Grandma her own front page." / "Their story deserves more than a photo album." / "Made from your photos and your stories."
- Audience: US 35–65, interests broad (genealogy, family history, Ancestry, gift ideas); also run a broad audience and let Meta find buyers. Placements: automatic with Reels/Stories assets 9:16 and feed 4:5.
- **Kill/scale rules:** after $50 per ad set, pause anything with CTR (link) < 0.8% or cost per landing view > $1.50; scale (20% every 2 days) any ad with cost per `InitiateCheckout` under ~$12 and positive ROAS. Break-even CAC: use real profit per order, not the call-note guess (see questions).
- Retargeting from day 4: visitors who started a portrait or viewed the preview (7-day), with a testimonial/example creative + order-by date.

**9.4 Organic.**
- 30-day calendar: 4 Reels/TikToks per week (portrait-being-made time-lapses; "I turned my great-grandfather's photo into a newspaper front page"; before/after; packaging/unboxing once samples arrive), 3 feed posts/week (example portraits with the short story behind them), Stories daily during December with the countdown. Nick's own great-grandfather clipping is the **founder story** asset.
- Post the same assets on Instagram, Facebook, TikTok, Pinterest (Pinterest is strong for gifts and genealogy; pins link to the landing page).
- A single linked Meta account (IG+FB) as in the notes.

**9.5 Genealogy communities.** **US** heritage and genealogy Facebook groups (Lebanese-American, Italian-American, German, Irish, Jewish genealogy, state genealogical societies). Read each group's rules; contribute for several days first; ask admins before linking; offer to make a free example portrait for a member's ancestor as a conversation starter rather than a link-drop. No AU/UK targeting.

**9.6 Search and content (cheap, durable).** Landing page keywords: "newspaper style family tribute", "gift for grandparents personalized", "family history gift", "custom newspaper portrait", "memorial keepsake from old photos". Add 4 short guides (e.g. "How to write a tribute to a grandparent", "Gift ideas for grandparents who have everything", "Questions to ask your grandparents before it's too late") with `Product`/`FAQPage` schema. Use Ahrefs/Semrush (connected in this workspace) for keyword validation after launch, not before.

**9.7 Partnerships and PR.** Local newspaper/lifestyle writers and genealogy bloggers: offer a free portrait for a review. Funeral homes and senior-living activity directors: a one-page "memorial portrait" offer (post-launch).

**9.8 Referral and sharing.** A "Share this preview" link (watermarked) that tags the sharer; after purchase, "Gift a second portrait: 10% off for 14 days." Keep it manual-light for now.

**9.9 Measurement.** One sheet (Google Sheet, Nick's preference) fed by an admin CSV export: daily spend, landing views, starts, previews, checkouts, purchases, revenue, AI cost, Gelato cost, profit, CAC, conversion rate by step. GA4 events mirror the funnel stages. Weekly review (Monday).

**9.10 Targets to sanity-check (not promises).** Call notes aim for ~200 orders/month ($10K revenue). With a 1.5–3% landing→purchase rate that needs roughly 7,000–13,000 qualified visitors a month, which $15/day (~$450/month, maybe 400–900 clicks) cannot buy alone. Report honestly: $15/day is a **test budget** to learn the conversion rate and the best creative. Volume must come from organic, groups, email and gifting shares. Scale paid only when a creative's cost per purchase is under half the profit per order (Appendix B).

---

## 10. UI/UX copy deck ("prompt language")

*Use `{{brand}}` and config values; never hard-code the name, prices or dates. Sentence case. Plain words. No exclamation marks in product copy.*

### 10.1 Landing page (`/`)

- **Announcement bar:** "Order your framed portrait by {{orderByFramed}} for holiday delivery. Digital portraits are ready instantly." (After the date: "Framed portraits ordered now arrive after the holiday. Give a printable gift card today.")
- **Hero H1:** "Their story, on the front page."
- **Sub:** "Turn old family photos and a few memories into a keepsake newspaper portrait. Preview it free, then print and frame it as a gift."
- **Primary CTA:** "Start your portrait" · small line: "Free to preview. No payment until you love it."
- **Secondary CTA:** "See examples"
- **How it works:** 1 "Add photos" ("Upload one to three old photos. Phone shots are fine.") · 2 "Tell us about them" ("Answer a few friendly questions. Skip anything you don't know.") · 3 "Read and approve" ("We draft it. You edit every word.") · 4 "Print or download" ("A framed print at your door, or a digital file today.")
- **Trust strip:** "You approve every word" · "Your photos stay private" · "7-day refund or free reprint" · "Ships free in the USA".
- **Example gallery heading:** "Real stories look like this" → **Use:** "Example portraits" (labelled Example; never imply real customers).
- **Pricing section:** three cards (Digital, Framed 11×14 highlighted "Most popular", Framed 16×20) each with 3 bullets and the CTA "Choose after your preview".
- **Gift section:** "Give it as a gift. We'll send you a printable card to wrap with it."
- **FAQ** (see 10.8). **Footer:** links, business name and address, "Made by {{company}}".

### 10.2 Create flow (step headers, helper text, buttons)

- **Step 0, email (optional):** H1 "Where should we save your draft?" · "We'll email you a private link so you can finish later." · field "Email" · checkbox (unchecked) "Send me tips and holiday deadlines. Unsubscribe anytime." · buttons "Continue" / "Skip for now".
- **Step 1, photos:** H1 "Add one to three photos" · "Old family photos are perfect. The first photo becomes the main picture." · Drop zone "Drop photos here or choose files" · Checkbox "I have the right to use these photos." · Button "Next: tell us about them".
  - Low-res warning: "This photo is small ({{dpi}} dpi at {{size}}). It will still work, but it may look soft in print. A larger file or a smaller print size will look sharper." · Buttons "Use it anyway" / "Choose another".
  - HEIC converting: "Converting your iPhone photo…". Success: "Added". Error: "That file didn't work. Please try a JPG, PNG or iPhone photo under 8 MB."
- **Step 2, interview:** Intro line: "Hi, I'm your {{brand}} editor. I'll ask a few questions about {{name|"them"}}. Answer in your own words, short is fine." · First question: "Who is this portrait about, and what's your relationship to them?" · Follow-up prompts (examples): "Where and when were they born?" · "What brought them to where they settled?" · "What did they do for work, or what did they build?" · "Tell me about their family." · "Is there a story your family always tells about them?" · "If you had to pick three words to describe them, what would they be?" · "What does your family still carry from them: a recipe, a saying, an object?" · Closers: "That's a lovely start. Anything else you'd like us to include?" / "Ready to see the draft?"
  - Buttons: "Skip", "I don't know", "That's enough, write my draft". Fact card title: "What we know so far (edit anything)". Empty state: "As you answer, the facts appear here."
  - Sensitive-moment line (when the customer mentions recent loss): "I'm sorry for your loss. We can keep this short, or skip any question."
- **Step 3, look and length:** H1 "Choose the look and length" · Length: "Brief (about 350 words) · Standard (about 600) · Full (about 850, needs plenty of detail)" · Hint when material is thin: "You've shared a short story, so Brief will read best. You can add more details to unlock a longer piece." · Tone options as in `draft.js` (Classic / Warm / Historic) · Masthead fields with placeholders from the repo · Button "Write my draft".
- **Step 4, draft:** Status while writing: "Writing your portrait… this takes about 20 seconds." · Gaps chips: "Adding {{x}} would make this richer." · Subheadline picker label "Pick a subheadline" · Notes box placeholder "For example: make it shorter, focus more on his work, softer tone" · Regenerate: "Rewrite ({{n}} left)" · Approve block: "This portrait was drafted from your answers and will be printed under your byline, {{byline}}. Please read every word, including names, dates and places." · Checkbox "I have read the whole text and it is correct." · Button "Approve and see my portrait".
- **Preview page:** H1 "Your portrait" · watermark text "PREVIEW" · Buttons "Unlock and choose a format" · "Edit text" · "Share this preview" · Reassurance: "You can still edit after unlocking until you order a print."
- **Autosave state:** "Saved" / "Saving…" / "Couldn't save. Retrying."

### 10.3 Product and checkout page

- H1 "Choose how to keep it" · Cards: "Digital portrait: instant download (PDF + image), print it anywhere" · "Framed print {{size}}: wood frame, ready to hang, ships to your door" · "Every print includes the digital file ($19 value)" · Size helper: "11×14 fits most mantels and shelves. 16×20 makes a statement on a wall."
- Frame color: "Wood · Dark wood · Black". Assembly: "Ready to hang (+$15)" / "Assemble yourself". Print only: "No frame". All include "+ the digital file".
- Shipping line: "Free standard shipping to the US. Arrives by {{estimatedDate}} if you order by {{orderBy}}." Express: "Express (+{{price}}): arrives about {{x}} days sooner."
- Gift toggle: "This is a gift" → "We'll email you a printable gift card." Recipient name (optional), gift message (optional, 200 chars).
- Totals: "Subtotal · Shipping · Tax (calculated at checkout) · Total". Button: "Continue to secure payment". Trust line: "Payments by Stripe. We never see your card."

### 10.4 Success, delivery, and status pages

- Success H1: "Thank you. Your portrait is on its way." Digital: "Download your portrait" buttons "PDF (print-ready)" and "Image (share)". Print: "Your framed print is being prepared. We'll email tracking when it ships." Gift: "Download your gift card" · "Make another portrait (10% off for 14 days)".
- Order status page (by emailed link): states "Received → Reviewed → Printing → Shipped → Delivered" with dates.

### 10.5 Errors and edge cases (always give a next step)

- AI failure: "We couldn't write your draft just now. Your answers are saved. Try again in a minute." Button "Try again".
- Upload too large: "That photo is over 8 MB. Try a smaller version." Network lost: "You're offline. We'll save your work when you reconnect."
- Payment canceled: "No charge was made. Your portrait is saved." Payment failed: "Your card wasn't accepted. Please try another card."
- Order-by passed: "Framed portraits ordered now arrive after {{holiday}}. Choose the printable gift card to give today."
- Expired draft link: "This draft link has expired. Start a new portrait or contact us and we'll help."
- Rate-limited: "That's a lot of rewrites. Please take a moment and try again shortly."

### 10.6 Admin labels (short and literal)

"Orders", "Needs review", "Ready to print", "Placed with Gelato", "Shipped", "Refunded"; buttons "Download print file", "Mark placed", "Paste tracking", "Refund", "Resend email".

### 10.7 Transactional email subjects/preheaders

- Draft saved: "Your {{name}} portrait draft is saved" / "Pick up where you left off."
- Preview ready: "Your portrait of {{name}} is ready to preview"
- Receipt: "Your {{brand}} order {{id}}" / "Download links and what happens next"
- Shipped: "Your framed portrait has shipped" / "Tracking inside"
- Delivered/review: "How did the portrait land?" / "A quick note helps other families."

### 10.8 FAQ (draft answers; Nick approves)

1. **Is this written by AI?** "We use AI to help draft the text from the facts you give us. You read and edit every word before anything is printed, and the portrait carries your byline."
2. **Will it make things up?** "It is instructed to use only what you tell us. Anything missing is left out, and you approve the final text."
3. **What if my photo is old or blurry?** "We warn you before you pay and suggest the best size. Many treasured photos print beautifully in black and white."
4. **How long until I get it?** "Digital is instant. Framed prints take about {{x}} business days to produce and ship; order by {{orderBy}} for holiday delivery."
5. **Can I change it after I approve?** "Yes, until your print is in production."
6. **What if I'm not happy?** "You approve the final text before we print, so we can't refund a typo you approved. If anything arrives damaged or printed wrong, we reprint it free. Request a refund or reprint within 7 days of delivery."
7. **Is my family's information private?** "Your photos and story are used only to make your portrait. See our privacy policy for how long we keep them."
8. **Do you ship outside the US?** "Not yet. We ship framed and printed portraits within the USA. Digital portraits work anywhere."

### 10.9 Email copy skeletons

- **Abandoned +24 h:** "You started a portrait of {{name}}. Here's the draft, saved. One line from your story stayed with us: '{{line}}'. [Finish my portrait]"
- **Countdown:** "7 days left to order a framed portrait for the holidays. Preview is free. [Finish mine]" ; "Last day for holiday delivery. After today, framed prints arrive after the holiday. A digital portrait and printable gift card are ready instantly."

---

## 11. QA and UAT

### 11.1 Test environments and data

Stripe test mode with test cards (4242…, 3DS 4000 0027 6000 3184, decline 4000 0000 0000 0002); Gelato in `manual` or `gelato_draft`; AI with real keys on a staging project and a spend cap; Resend sandbox/test domain; a seeded set of 8 test families (short, medium, long stories; one with non-Latin names; one with emoji; one with an injection attempt like "Ignore previous instructions…").

### 11.2 Test matrix (each ID must pass; log evidence in the PR)

| ID | Area | Test | Pass criteria |
|---|---|---|---|
| F-01 | Create flow | Happy path on iPhone Safari, Android Chrome, desktop | Completes in < 8 min; all steps saved; no console errors |
| F-02 | Photos | JPG, PNG, WebP, HEIC, 8.1 MB, 0 B, 4 photos, corrupted file | Valid accepted; invalid rejected with the specified message; slot limits enforced |
| F-03 | Photos | Low-resolution warning at each size | Correct dpi message; "Use it anyway" works |
| F-04 | Interview | Thin story, rich story, "skip" everything, grief mention | Never invents; tone softens; fact card editable; ≤14 turns |
| F-05 | Interview | Prompt-injection and abuse inputs | Ignored as data; no system prompt leakage; no off-topic output |
| F-06 | Article | 8 seed families | Every entity in output exists in fact card; length within ±10%; no clichés banned list |
| F-07 | Article | Provider fallback (kill Anthropic key; kill both) | Silent fallback; friendly error and alert; no sample text to customers |
| F-08 | Cost | Run 50 portraits | Avg AI cost recorded; no portrait exceeds `MAX_AI_COST_USD` |
| F-09 | Template | Each size × short/long story, long names, RTL/non-Latin text | Text fits (`__FIT__`), no clipping, fonts loaded, 300 DPI dims exact |
| F-10 | Print file | Browser Run output vs `scripts/render.py` reference | Visually matching, 1 page only, deterministic checksum |
| P-01 | Checkout | Success, decline, 3DS, cancel, back button, double click | Correct states; no duplicate orders |
| P-02 | Webhook | Replay same event ×3, out-of-order, bad signature, missing metadata | Idempotent; 400 on bad signature; one order only |
| P-03 | Pricing | Config changes | Price displayed = price charged = receipt |
| P-04 | Tax/shipping | Several US states; any non-US address; PO box | No tax lines (inclusive pricing); non-US blocked with message; state recorded on order |
| P-05 | Refund | Full refund from admin | Order marked refunded; email sent; download links revoked |
| G-01 | Fulfillment | `gelato_draft` payload for each size/frame | Payload validates against Gelato docs; address mapping correct |
| G-02 | Fulfillment | One **real** Gelato test order (team address) | Print quality OK; dates recorded; order-by dates updated |
| G-03 | Webhook | Simulated Gelato tracking event | Tracking saved; email sent; secret path enforced |
| E-01 | Email | All templates in Gmail, Apple Mail, Outlook, dark mode | Renders; links work; unsubscribe works; SPF/DKIM/DMARC pass |
| E-02 | Sequences | Abandoned/previewed flows | Timing right; stop on purchase/unsubscribe |
| S-01 | Security | Access `/admin` unauthenticated; guess ids; fetch other's photos; oversize uploads; XSS in names | All blocked; sanitized output |
| S-02 | Privacy | Retention cron on test data; delete-my-data request | Data and R2 objects removed on schedule |
| A-01 | Analytics | GA4 + Meta events with consent on/off | Events fire only when allowed; purchase deduped (pixel + CAPI) |
| X-01 | Accessibility | Keyboard-only, VoiceOver/TalkBack, 200% zoom | Completable; AA contrast |
| X-02 | Performance | Lighthouse mobile on landing/create | Perf ≥ 85, LCP < 2.5 s |
| L-01 | Legal | Footer links, policy pages, cookie banner | Present on all pages; flagged DRAFT until approved |

### 11.3 UAT scripts (Nick and Yara; plain language)

1. **"Grandma's portrait" (Nick, phone, slow connection):** make a real portrait of a real relative using only your phone. Note every moment you hesitate or feel unsure. Pass: you finish and would give it as a gift.
2. **"Gift buyer" (Yara):** pretend you are buying a framed print for a parent two days before the order-by date; apply a promo code; confirm the bundled digital file is delivered; check the receipt and email.
3. **"Late buyer" (either):** set the clock/config after the order-by date and buy; check the gift-card path and "arrives after the holiday" messaging.
4. **"Mistake" (either):** start, abandon, and return via the email link on another device; edit after approving; request a rewrite five times.
5. **"Break it" (Yara):** upload a massive photo, paste a 10-page obituary, use a name with accents and Arabic script; try the bad cases in F-05.
6. **"Ops day" (both):** run three paid test orders through admin: download print files, place a Gelato draft/manual order, paste tracking, issue a refund. Time each step.
7. **Print sign-off (Nick):** hold the Gelato test print. Is the photo contrast right, the text legible at arm's length, the frame as expected? Written yes/no is the gate for going live with physical products.

### 11.4 Go-live gates (Nick says "go live" only when all are checked)

- [ ] All F, P, G, E, S, A tests pass; no open critical/high bugs
- [ ] Real Gelato test print approved by Nick; order-by dates updated from real timings
- [ ] Stripe account verified, payouts set, statement descriptor correct, live keys loaded as secrets, webhook endpoint registered for live mode and tested
- [ ] Workers paid plan active; Browser Run capacity confirmed; Cloudflare account duplicate cleanup done
- [ ] Privacy, terms, refunds, shipping pages reviewed and approved; cookie banner live
- [ ] Domain bought, DNS on Cloudflare, email sending (SPF/DKIM/DMARC) verified, brand assets approved
- [ ] Anthropic and Gemini (billing-enabled) keys set; spend limits configured at the providers; cost alerts to Nick
- [ ] Meta Pixel + CAPI verified in Events Manager; GA4 purchase test appears
- [ ] 6–8 example portraits, mockups and the first ad creatives approved
- [ ] Rollback plan: `LIVE_MODE` off + banner "We're updating, back shortly"; Stripe checkout disabled by one flag

---

## 12. Work packages (do in this order; stop and report after each)

**WP0. Reality check (day 1).** Clone, run locally, read everything. Deploy the print endpoint as a preview and **prove Browser Run works** (or build the separate render Worker). Run one real Anthropic draft and one Gemini draft with test keys. Produce `docs/LAUNCH_LOG.md` with findings and a corrected risk list. *Acceptance: a real PDF at 11×14 that matches `render.py`; a real AI draft that passes the fact validator.*

**WP1. Foundations (day 1–2).** Migration `0002`, config files (`brand`, `products`, `dates`), `LIVE_MODE`, feature flags, error/log tables, Turnstile widget, self-hosted HEIC, security headers, edit token. *Acceptance: F-02, S-01 partial.*

**WP2. AI interview and article upgrade (day 2–3).** Haiku interviewer with fact card UI (with form fallback), caching, validator, cost tracking, spend caps, injection defenses. *Acceptance: F-04..F-08.*

**WP3. Preview-then-pay and product choice (day 3).** Watermarked preview, product page, order-by logic, gift toggle. *Acceptance: UAT 2–3 partial.*

**WP4. Stripe test mode end to end (day 3–4).** Checkout, webhook, orders, receipts, refunds, promo codes, Apple/Google Pay. *Acceptance: P-01..P-05.*

**WP5. Admin and fulfillment (day 4–5).** Orders queue, review gate, manual flow, `gelato_draft` payloads, webhook receiver. Yara places the real Gelato test order. *Acceptance: G-01..G-03, UAT 6.*

**WP6. Email system (day 4–5, parallel).** Templates, sending domain, sequences. *Acceptance: E-01, E-02.*

**WP7. Landing page, examples, legal pages, FAQ (day 3–5, parallel).** Using the copy deck. *Acceptance: X-01, X-02, L-01.*

**WP8. Analytics and consent (day 5–6).** GA4, Meta Pixel + CAPI, consent banner, funnel events, CSV export for the sheet. *Acceptance: A-01.*

**WP9. Retention, monitoring, polish (day 6).** Cron deletes, alerts, short-story layout variant, README/INTEGRATIONS docs. *Acceptance: S-02.*

**WP10. Pre-launch audit (day 7).** Full regression, UAT scripts, go-live checklist, final report. **Stop and wait for Nick's "go live."**

**Marketing track (Nick, in parallel; Maria and Manuela are not involved).** Days 1–3: create social accounts under one Meta Business; example portraits and mockups; ad creatives; group research. Days 3–7: soft-launch organic posts; email list seeding; Meta account, pixel, campaigns built in draft; a `WELCOME10` plan. Launch day: switch live, publish, start the $15/day test (Appendix D).

**Launch calendar (anchored to Appendix C):** Oct 26–27 WP0–1; Oct 28–30 WP2–4 plus content; Oct 31–Nov 2 WP5–8; Nov 3 audit and sign-off; **Nov 4 soft launch** to friends and family; **Nov 8 public launch + $15/day ads**; **Nov 19 Hanukkah framed order-by**; **Thanksgiving Nov 26, Black Friday Nov 27, Cyber Monday Nov 30 promo window (digital-first: "Give it at the table")**; **Dec 10 Christmas framed order-by**; Dec 11–24 digital and gift-card push; **Dec 23 Orthodox/Armenian Christmas order-by**; then Valentine's, Mother's Day and Father's Day per Appendix C.

---

## 13. Reporting format back to Nick and Yara

After each work package, reply with: (1) what changed, in plain words; (2) what you verified and how; (3) what you could not verify and why; (4) decisions you need from them; (5) next step. Keep it short. Use tables only for test results. Never claim something works without having run it.

---


---

## 14. Still open (small; nothing here blocks WP0–WP4)

1. **Buy the domain** (Nick decides which account) and add it to the Pages project. Blocks email sending, Pixel domain verification and Stripe branding.
2. **Real Gelato costs.** Replace every placeholder cost in Appendix B with Gelato's quote for the exact `productUid` and US shipping method.
3. **Keys as secrets, not chat.** Nick has the Anthropic and Gemini keys; Yara has the Gelato API key. Set them as Cloudflare Pages secrets (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GELATO_API_KEY`) or in `.dev.vars`. **The Gelato key currently sits in the AnythingMCP trial: rotate it after the trial ends.** Claude Code must never print, log or commit a key.
4. **Heirloom clipping.** Nick adds `docs/reference/wanis-ganim-clipping.jpg` and decides whether the clipping image may appear in marketing (see Appendix E on permissions).
5. **Example-portrait photos.** Use public-domain, properly licensed or AI-generated photos only, labelled "Example".
6. **Legal text.** Claude Code drafts the privacy, terms, refund and shipping pages from this prompt; Nick reads them before launch (ideally a lawyer too).

---

## Appendix A. Nick's decisions (2026-10-25), now binding

| # | Question in v3 | Decision |
|---|---|---|
| 1 | Is ~$30 / ~$70 profit before or after ad spend? | **Before** ad spend. Claude sets prices and costs. |
| 2 | Order-by dates | Claude calculates from upcoming holidays (Appendix C). |
| 3 | Brand | **The Legacy Press** (brand) and **Legacy Portrait** (product), as in the project text. Kin Gazette dropped. |
| 4 | Digital price | Agreed; digital is **bundled** with every physical order; digital alone is $19. |
| 5 | Unframed print | **Keep** (print-only tier). |
| 6 | Ads and tax | **$15/day**; Claude builds the Meta ads (Appendix D). **Tax included**, Nick pays it himself; Stripe Tax off. |
| 7 | Workers plan, refunds, domain | Workers paid plan approved. **7-day refund or reprint** because customers approve the final text first. Domain to be bought. |
| 8 | Maria, Manuela, profit split | Not on board. Split handled offline. |
| 9 | Print files and the clipping | Reference image provided (Appendix E). |
| 10 | Keys and Gelato | Nick has Gemini and Anthropic keys. Gelato API and an MCP are available and will be provided. |
| 11 | Products and shipping | Sizes **8×10, 11×14, 16×20**; frames **wood, dark wood, black**; **assembled or not assembled**; or **no frame (print only)**. **USA only.** **Arabic nameplate removed.** |

(For clarity: the "Arabic nameplate" was an idea to add a second masthead line in Arabic script, like the Arabic title at the top right of the heirloom clipping. It is out of scope.)

---

## Appendix B. Pricing and margin model (before ad spend)

**Assumptions (all to be replaced with Gelato's real quote):** unframed 11×14 cost ≈ $12 and framed 11×14 ≈ $45 (Oct 14 call); other sizes scaled by area; assembly ≈ +$6; US shipping estimated at $5 (print), $9–13 (framed) because the call figures may exclude it; Stripe fee 2.9% + $0.30; AI cost $0.10; tax reserve 6% on physical goods (Nick pays it himself).

| Product | Price | Cost + ship (est.) | Stripe | Tax reserve | **Profit** | Margin | Max cost per purchase at 50% of profit |
|---|---|---|---|---|---|---|---|
| Digital | $19 | $0 | $0.85 | $0 | **$18** | 95% | $9 |
| Print 8×10 | $39 | $14 | $1.43 | $2.34 | **$21** | 54% | $11 |
| Print 11×14 | $49 | $17 | $1.72 | $2.94 | **$27** | 56% | $14 |
| Print 16×20 | $69 | $24 | $2.30 | $4.14 | **$38** | 56% | $19 |
| Framed DIY 8×10 | $79 | $43 | $2.59 | $4.74 | **$29** | 36% | $14 |
| Framed DIY 11×14 | $109 | $55 | $3.46 | $6.54 | **$44** | 40% | $22 |
| Framed DIY 16×20 | $149 | $79 | $4.62 | $8.94 | **$56** | 38% | $28 |
| Framed assembled 8×10 | $94 | $49 | $3.03 | $5.64 | **$36** | 39% | $18 |
| **Framed assembled 11×14** | **$124** | $61 | $3.90 | $7.44 | **$52** | 42% | **$26** |
| Framed assembled 16×20 | $164 | $85 | $5.06 | $9.84 | **$64** | 39% | $32 |

Reading it: the hero product earns about $50 per sale before ads, so a blended cost per purchase under ~$25 is healthy and under ~$15 is excellent. Digital's low ceiling ($9) means digital should come mostly from organic and email. A 15–20% mix of the unframed print and digital keeps the average order near $60–70. The admin dashboard must compute **real** profit per order from actual Stripe fees, Gelato invoice costs and AI cost, replacing these estimates after the first orders.

Price tests allowed within ±$10 using config only. Do not discount below the "max cost" threshold on physical products; promos (`WELCOME10` = 10% off, one per customer, expires on the next order-by date) apply to physical products only after Nick reviews the margin table.

---

## Appendix C. Holiday calendar and order-by dates (US shipping)

**Formula:** `order_by = holiday − 15 days` for framed and print-only (11 days worst-case production + shipping from Gelato's API range of 7–11 days, +2 days for the customer-approval/admin-review step, +2 days carrier buffer). The digital portrait and printable gift card are instant, so they are available until the day before. Dates below are computed; **Eid al-Fitr 2027 depends on the moon sighting, so verify it in February**. Replace `−15` with a smaller number only after Yara's real test order.

| Occasion | Date | Framed/print order-by | Digital & gift card until |
|---|---|---|---|
| Thanksgiving | Thu Nov 26, 2026 | Wed Nov 11 (already tight; pitch digital: "Give it at the table") | Wed Nov 25 |
| Hanukkah (first night, eve) | Fri Dec 4, 2026 | **Thu Nov 19** | Thu Dec 3 |
| **Christmas** | Fri Dec 25, 2026 | **Thu Dec 10** | Thu Dec 24 |
| Kwanzaa begins | Sat Dec 26, 2026 | Fri Dec 11 | Fri Dec 25 |
| Orthodox, Armenian and Coptic Christmas | Thu Jan 7, 2027 | **Wed Dec 23** | Wed Jan 6 |
| Valentine's Day | Sun Feb 14, 2027 | Sat Jan 30 | Sat Feb 13 |
| Eid al-Fitr (approx.) | Tue Mar 9, 2027 | Mon Feb 22 | Mon Mar 8 |
| Easter (Western) | Sun Mar 28, 2027 | Sat Mar 13 | Sat Mar 27 |
| Orthodox Easter | Sun May 2, 2027 | Sat Apr 17 | Sat May 1 |
| Mother's Day | Sun May 9, 2027 | **Sat Apr 24** | Sat May 8 |
| Father's Day | Sun Jun 20, 2027 | **Sat Jun 5** | Sat Jun 19 |

Also plan content around Black Friday (Nov 27) and Cyber Monday (Nov 30), and treat Dec 11 onward as "gift card + digital now" for Christmas. Many customers are Lebanese-American and Orthodox or Maronite Christians, so the Jan 7 date and Epiphany (Jan 6) are real gifting windows that competitors ignore.

**Implementation:** `config/holidays.js` holds `{id, name, date, audience, enabled}`. A pure function `nextOrderBy(now, product)` returns the soonest holiday whose order-by is still in the future (with the holiday name); the banner, cart, emails and countdown use it. Unit-test the function with fixed clocks (before/at/after each date, daylight-saving edges, America/New_York cutoff at 23:59 ET).

---

## Appendix D. Meta ads build sheet ($15/day), ready to paste into Ads Manager

**Prerequisites (Nick):** Meta Business portfolio; one Facebook Page + linked Instagram account (professional); ad account with payment method; domain verified (needs the domain); Pixel created and installed (WP8); Conversions API token stored as a secret; landing page live with privacy policy, contact and business info (Meta checks the destination).

**Events (wire in WP8, deduplicated by `event_id`):** `PageView`; `ViewContent` (landing); **`Lead` = StartPortrait** (fires when the portrait is created, before email); `InitiateCheckout`; `Purchase` (value, currency). Email is optional, so do not use email capture as the optimization event.

**Structure**

```
Campaign A "LP | Test | Nov"  (days 1-4) objective: Traffic -> Landing page views, $15/day
   Ad set A1 US 35-65+, broad, Advantage+ placements
      Ads: V1 video "Photo to front page", S1 static "Framed in a room", S2 static "Before / after"
           (each x2 headlines = 6 variants, Meta may rotate)

Campaign B "LP | Convert | Nov-Dec" (day 5+) objective: Sales -> website, optimize for Lead (StartPortrait)
   Ad set B1 Prospecting $10/day: US 35-65+, broad (Advantage+ audience, suggestions: genealogy,
      family history, gift shopping), exclude purchasers
   Ad set B2 Retargeting $5/day: site visitors 14d + Instagram/Facebook engagers 30d, exclude purchasers
      Ads: the 2 best from Campaign A, plus a "countdown" version once an order-by date is within 14 days
```

Be realistic: $15/day buys roughly 15–25 clicks a day, and Meta wants ~50 conversion events a week to leave "learning"; at $10/day to prospecting it will stay in "learning limited". That is fine for a test; judge on cost per Lead and the funnel rates, not on Meta's delivery status. If after day 10 the cost per Lead is above $12, pause paid and put the $15 into the best organic post as a boosted post instead.

**Creative briefs (Nick's team or Claude via Canva)**
- **V1, 20–25 s vertical video (9:16):** old photo on a table → hands add it to a phone screen → newspaper front page builds around it (headline, byline) → printed, framed, hung on a wall. Caption overlay: "Give Grandma her own front page." End card: logo + "Preview free."
- **S1, 4:5 static:** framed 11×14 on a warm wall, soft light, label "Example portrait." Headline overlay none (keep text in the ad copy).
- **S2, 4:5 static:** split image: faded family snapshot on the left, finished newspaper portrait on the right. "One old photo. One front page."
- Safe zones for Reels/Stories: keep faces and text out of the top ~14% and bottom ~35%. Keep file sizes small (Nick's connection is slow).
- Every ad that shows a made-up family is labelled **Example**. If an image is AI-generated, enable Meta's AI disclosure label.

**Copy (primary text, headline, description). Use a real order-by date from `nextOrderBy`.**
1. *Primary:* "A framed front page about the person who made your family. Upload an old photo, answer a few questions, and we help you write their story. You approve every word before it prints." *Headline:* "Give them their own front page" *Description:* "Preview free. Ships free in the USA."
2. *Primary:* "Their story deserves more than a shoebox of photos. Make a newspaper-style portrait of a grandparent in minutes, then print it framed or keep it digital." *Headline:* "A gift they will actually keep" *Description:* "Order by {{orderBy}} for {{holiday}}."
3. *Primary:* "One old photo. One front page. Made from your photos and your family's stories." *Headline:* "Turn a family photo into a front page" *Description:* "From $19 · Framed from $79."
4. (Countdown, from 14 days out) *Primary:* "{{n}} days left to order a framed portrait for {{holiday}}. Start free, decide after you see it." *Headline:* "Order by {{orderBy}}"
- CTA button: **Learn more** (or **Shop now** for retargeting). Destination: `/` with UTM `?utm_source=meta&utm_medium=paid&utm_campaign={campaign}&utm_content={ad_name}`.

**Meta policy guardrails.** Do not imply you know personal attributes ("your late grandfather," "are you grieving?"); address the offer, not the person. No fake testimonials or "as seen on". No before/after claims about people's bodies (not relevant) and no sensational language. Landing page must match the ad promise (price, free preview, order-by). Keep a one-page proof of each claim.

**Naming and tracking.** Campaign `LP|Test|2026-11`; ad set `US|35-65+|Broad`; ad `V1-photo-to-front-page|H1`. Log daily: spend, impressions, link CTR, CPC, landing views, StartPortrait count, InitiateCheckout, purchases, revenue. Use the admin CSV plus Supermetrics or a manual export into the shared Google Sheet.

**Decision rules.**
- Campaign A (days 1–4): after ≥2,000 impressions per ad, pause anything with link CTR < 0.8% or CPC > $1.50. Keep the best two.
- Campaign B: after $30 per ad, pause cost per StartPortrait > $15. Scale only by +$5/day when cost per StartPortrait < $8 **and** previews convert to purchase at ≥ 8%.
- Always compare blended cost per purchase to Appendix B ceilings (hero product: under $26).
- December: shift $5 from prospecting to retargeting from Dec 1, and run only countdown creatives from Dec 3 to Dec 10; after Dec 10 switch to "digital + gift card" creatives.

**Seasonal angle calendar.** Nov 8–19: "A gift for grandparents" and Hanukkah; Nov 20–30: "Give it at the table" and Black Friday (digital-first); Dec 1–10: countdown; Dec 11–24: gift card and digital; Dec 26–Jan 6: Orthodox/Armenian Christmas and "New Year, new tradition"; Jan: Valentine's ("Love story of your grandparents").

**Claude's note on execution.** The ads cannot be created until the Business Manager, ad account, Pixel and the first three creatives exist. Once they do, the whole sheet above can be pasted in or built through an ads connector if Nick connects one.

---

## Appendix E. The heirloom clipping: reference and test fixture

**What it is.** A page from *Profile News, Boston Edition*, March 2015 (page 13): "Wanis Joseph Ganim: Profile of An Immigrant," by Georgette Baghdady, with a portrait photograph. It is the template for the newspaper look and the "gold standard" of the story arc. Nick's heirloom.

**Use 1: seed example portrait and founder story.** Make the first example portrait from this person (it matches the seed in the original build prompt), written fresh from the facts below, not copied. Nick's own relationship to the family can anchor the founder story ("The framed clipping on our wall is why we made this").

**Use 2: gold test case for the fact validator (F-06).** Create `data/fixtures/wanis-ganim.facts.json` from the list below. The generated article must contain only entities (names, dates, places, numbers) that appear in it. Some fields are cut off at the edge of the photo, so mark them `uncertain` and **do not let the writer assert them** (the great-grandchildren count; the exact age at death reads "95").

**Facts visible in the clipping (verify against the original before using publicly):**
- Born January 18, 1879, in the village of Baskinta, Lebanon Mountains. His father died soon after his birth. His mother (illiterate, poor) gave him to the care of his uncle Hannah and the uncle's wife Sadi. Raised in the village of Kabelias at the edge of the Bekaa plateau; adopted into his uncle's family, with brothers and sisters, one a lifelong friend.
- Strong attachment to the Christian Maronite Church and love of Lebanon; lifelong devotion to scholarship and social consciousness.
- Emigrated at 18, in 1897, to the United States. Lived about a year in Brooklyn, New York (factory work and shoe repair), then Bridgeport, Connecticut, where his mother lived with her second husband. Years of walking door to door as an itinerant peddler.
- Met Rose Baghdady in 1914. She was born in Zahleh, emigrated three years earlier via Canada to live with her older brother Najeeb (Wanis's friend); a cousin in Montreal had asked her hand by letter; she refused him on meeting and went to Bridgeport. Wanis first saw her in a grocery store. They married in 1914 and had several children.
- Moved the family to the rural suburbs, settling in Stratford, Connecticut, out of concern about city streets.
- Livelihood: a retail produce business on an open lot; introduced importing Christmas trees from Canada, volume sales of fruit and vegetables for home stocking, and landscaping bushes including the azalea.
- Organized literary and social clubs with fellow Lebanese immigrants; read history, philosophy and literature despite limited formal schooling. Would have chosen law and politics; the three youngest sons all studied law and founded prominent law firms. Youngest daughter Virginia (mother of the article's author).
- Died September 8, 1974, at age 95 (partly cut off in the photo). Left eight children and 31 grandchildren; the great-grandchildren figure is cut off. Left several thousand pages of unpublished manuscript on his philosophical ideals.

**Permissions and caution.** The article text belongs to its author and publisher: do not reproduce its wording or publish the clipping image in ads without permission from Nick's family and, ideally, the author/publication. The facts and the family photograph of Wanis are family history and fine to use with the family's consent. Use the real name only if the family agrees; otherwise change the name and details for the public example, keeping the arc.

**Typography reference.** The clipping uses a bold serif headline and a centered italic-style subhead, a byline with a rule, justified three-column body text with hyphenation, a large halftone photo spanning columns 2–3, and thin rules. The repo template already approximates this. Compare the rendered example to the clipping side by side; Yara approves any visual change.

**Non-Latin names.** The Arabic text at the top of the clipping is a newspaper title, not part of our product. Customers may still type names with accents or Arabic script, so the template must fall back to a system font gracefully (no missing-glyph boxes), but there is no second-language nameplate feature.
