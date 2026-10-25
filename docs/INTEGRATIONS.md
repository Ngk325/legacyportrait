# Integrations: what was checked against official docs

Hard rule 4: verify third-party API details before relying on them. ✅ = checked against the provider's current docs (date), 🧪 = also exercised for real, ⏳ = written but not yet exercised against the real service.

## Cloudflare
| Item | Status | Notes |
|---|---|---|
| Pages honours `[browser]`, D1 and R2 bindings from `wrangler.toml` | ✅🧪 2026-10-25 | Deployment API shows `BROWSER`, `DB`, `PHOTOS`; print files render on the deployed preview |
| Pages build needs a build command to install npm deps | 🧪 2026-10-25 | Build command `npm ci --omit=dev` |
| Browser Run launch rate limit (free plan) | 🧪 2026-10-25 | Bursts got 429; `print.js` reuses sessions. Workers paid plan before launch |
| Turnstile siteverify | 🧪 2026-10-25 | Test keys locally; real keys on Preview (widget renders; a scripted browser gets no token, as expected) |
| Secrets apply only to deployments made after they are set; Production and Preview are separate | 🧪 2026-10-25 | |

## Anthropic (Claude API)
| Item | Status | Notes |
|---|---|---|
| Models `claude-haiku-5-5`, `claude-sonnet-5-5`; prices; caching rules; `output_config.format` JSON schema; no `temperature` | ✅ 2026-10-25 | claude-api reference; see `config/ai.js` |
| Real calls | ⏳ | Every call so far: HTTP 400 "credit balance is too low" |

## Google Gemini
| Item | Status | Notes |
|---|---|---|
| `gemini-3.6-flash` generateContent, `x-goog-api-key`, JSON mode, usage metadata | 🧪 2026-10-25 | Two real drafts on the preview |
| Price $0.75/$3.75 per M tokens to 2026-12-31, then $1.50/$7.50 | ✅ 2026-10-25 | ai.google.dev/gemini-api/docs/pricing; budgeted at the 2027 price |
| Quota | 🧪 | HTTP 429 "exceeded your current quota" after two drafts: the key's project needs billing |

## Stripe
| Item | Status | Notes |
|---|---|---|
| Checkout Session: `mode=payment`, inline `price_data`, `shipping_address_collection[allowed_countries]=US`, `phone_number_collection`, `allow_promotion_codes`, `client_reference_id`, `metadata`, `success_url` with `{CHECKOUT_SESSION_ID}` | ✅ 2026-10-25 | docs.stripe.com (Checkout, API reference). Exercised against a local fake server only ⏳ |
| Webhook signatures: `Stripe-Signature: t=…,v1=…`, HMAC-SHA256 of `t.rawBody` with the endpoint secret, ignore non-v1 schemes, constant-time compare, tolerance | ✅ 2026-10-25 | docs.stripe.com/webhooks "Verify manually"; unit-tested |
| Duplicate deliveries: record event ids | ✅ 2026-10-25 | `stripe_events` table |
| Shipping details location on the session | ⚠️ | Newer API versions use `collected_information.shipping_details`, older ones `shipping_details`; the code reads both. Confirm on the first real test-mode payment |
| Apple Pay / Google Pay | ⏳ | Enabled in the Stripe dashboard (payment methods); Checkout shows them automatically on supported devices |
| Real test-mode payment | ⏳ | Needs `STRIPE_SECRET_KEY_TEST` and `STRIPE_WEBHOOK_SECRET_TEST` |

## Resend (email)
| Item | Status | Notes |
|---|---|---|
| `POST https://api.resend.com/emails` with `Authorization: Bearer`, JSON `from`, `to[]`, `subject`, `html`, `text`, `headers` | ⏳ VERIFY | Written from Resend's documented API shape; tested only against the local fake server. Verify on the first real send (and set up SPF/DKIM/DMARC on the sending domain) |
| `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers | ⏳ | One-click POST handled at `/api/unsubscribe` |

## Gelato
Gelato's docs (dashboard.gelato.com/docs) refuse automated reading (HTTP 403), so these were checked through search results and secondary sources on 2026-10-25. Every row stays ⏳ until the first real call.
| Item | Status | Notes |
|---|---|---|
| `POST https://order.gelatoapis.com/v4/orders`, `X-API-KEY` header | ✅ (search) 2026-10-25 | Matches the master prompt |
| `orderType`: `order` (default) or `draft`; a draft can be PATCHed to `order` and is not produced until then | ✅ (search) 2026-10-25 | Answers the master prompt's [VERIFY]: a draft mode exists. `gelato_draft` sends drafts (only if `GELATO_API_KEY` is set) |
| Body: `orderReferenceId`, `customerReferenceId`, `currency`, `items[{itemReferenceId, productUid, files[{type:"default", url}], quantity}]`, `shipmentMethodUid`, `shippingAddress{firstName, lastName, addressLine1, addressLine2, city, postCode, state, country, email, phone}` | ⏳ VERIFY | Field names from a third-party integration guide plus the master prompt; lengths capped (name 25, line 35, city 30, post code 15) as that guide states. Confirm against the real docs / first draft order |
| Webhooks `order_status_updated` (`fulfillmentStatus`), `order_item_tracking_code_updated` (`trackingCode`, `trackingUrl`, `shipmentMethodName`); no signature scheme | ⏳ VERIFY | Field names assumed; handler ignores unknown orders and logs them. Check the first real event in the `errors`/`gelato_events` tables |
| Product UIDs (21 SKUs) and the US `shipmentMethodUid` | ❌ missing | `npm run check:gelato` lists them; Yara/Nick to supply from the Gelato catalog |
| Files fetched by URL: JPEG/PNG/SVG/PDF | ✅ master prompt | We send the 300 DPI PDF via a signed link valid 7 days |

## Meta, GA4
Not integrated yet (WP8).
