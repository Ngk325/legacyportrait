#!/usr/bin/env python3
"""Builds the plain policy pages (public/privacy.html, terms, refunds, shipping, contact) from the text below.
Edit the text here and re-run: python3 scripts/build-pages.py
All legal text is DRAFT until Nick (and ideally a lawyer) approves it; the pages say so."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRAFT = '<p class="draft-flag"><b>Draft.</b> This page is a draft and has not yet been reviewed. It is not final.</p>'

PAGES = {
"privacy": ("Privacy policy", """
<p>This policy explains what we collect when you make a Legacy Portrait with The Legacy Press, why, who helps us process it, and how long we keep it.</p>
<h2>What we collect</h2>
<ul>
<li><b>Your portrait material:</b> the photos you upload and the answers, stories and text you give us about your family member.</li>
<li><b>Order details:</b> your name, email address, shipping address and phone number when you order. Card details go straight to Stripe; we never see or store your card number.</li>
<li><b>Basic technical data:</b> your IP address and browser information, used to keep the site secure (for example, to stop automated abuse).</li>
<li><b>Marketing preferences:</b> only if you tick the box to receive tips and holiday deadlines. You can unsubscribe at any time.</li>
</ul>
<h2>How we use it</h2>
<ul>
<li>To draft, show and print your portrait, and to deliver your order.</li>
<li>To send you emails about your draft and your order.</li>
<li>To send marketing emails, only if you opted in.</li>
</ul>
<p>We do not sell your information.</p>
<h2>Who processes it for us</h2>
<ul>
<li><b>Cloudflare</b>: hosting, storage of photos and drafts, and bot protection.</li>
<li><b>Anthropic</b> (Claude) and <b>Google</b> (Gemini, used as a backup): to draft and check the text from your answers. Your answers are sent to them only for that purpose. [VERIFY before launch: confirm each provider's API data terms, including that the data is not used to train their models, and that the Google key used is a paid, billing-enabled one.]</li>
<li><b>Stripe</b>: payments.</li>
<li><b>Gelato</b>: printing, framing and shipping physical orders.</li>
<li><b>Resend</b>: sending emails.</li>
<li><b>Analytics and advertising</b> (Google Analytics, Meta): only with your consent, when enabled.</li>
</ul>
<h2>How long we keep it</h2>
<ul>
<li>Unpaid drafts and their photos are deleted <b>30 days</b> after they were last changed.</li>
<li>For paid orders we keep your original photos for <b>90 days after delivery</b>, so we can reprint if something goes wrong, then delete them. The finished portrait and order records are kept as long as we need them for our accounts and the law.</li>
<li>You can ask us to delete your data sooner at any time (see Contact). We will confirm when it is done.</li>
</ul>
<h2>Children</h2>
<p>Our service is for adults. We do not knowingly collect information from children under 13.</p>
<h2>Contact</h2>
<p>Questions or deletion requests: see our <a href="/contact">contact page</a>.</p>
"""),
"terms": ("Terms of service", """
<p>These terms apply when you use the Legacy Portrait website or order from The Legacy Press.</p>
<h2>Your content</h2>
<ul>
<li>You confirm that you have the right to use the photos and information you upload, and that sharing them with us does not break anyone else's rights.</li>
<li>You keep the rights to your photos and story. You give us permission to use them only to make, show you, print and deliver your portrait.</li>
<li>We may refuse or remove content that is unlawful, hateful, or that we cannot print responsibly.</li>
</ul>
<h2>How the text is written</h2>
<p>We use AI to help draft the text from the facts you give us, and we check the draft against your answers. You are the author: you read, edit and approve every word, and the portrait carries your byline. Please check names, dates and places carefully before you approve.</p>
<h2>Orders</h2>
<ul>
<li>Prices are in US dollars and include applicable tax. Standard shipping within the USA is free.</li>
<li>Framed and printed portraits are made to order. Once production starts, an order can't be changed or cancelled, except as described in our <a href="/refunds">refund and reprint policy</a>.</li>
<li>We ship physical products only to addresses in the United States.</li>
<li>Delivery dates are estimates. We show order-by dates for holidays in good faith but can't guarantee carrier delivery times.</li>
</ul>
<h2>Our responsibility</h2>
<p>If we make a mistake in printing, or your order arrives damaged, we will reprint it free (see <a href="/refunds">refunds</a>). Errors in text you approved are not our responsibility. To the extent the law allows, our liability for any order is limited to the amount you paid for it.</p>
<h2>Changes and contact</h2>
<p>We may update these terms; the version on this page applies to new orders. Governing law: [state to be confirmed by Nick]. Questions: see our <a href="/contact">contact page</a>.</p>
"""),
"refunds": ("Refunds and reprints", """
<p>You approve the final text before anything is printed, so here is how refunds and reprints work.</p>
<h2>Within 7 days</h2>
<ul>
<li><b>Framed and printed portraits:</b> ask within <b>7 days of delivery</b>.</li>
<li><b>Digital portraits:</b> ask within <b>7 days of purchase</b>.</li>
</ul>
<h2>What we cover</h2>
<ul>
<li><b>Printing defects or damage in shipping:</b> we reprint free. Please send a photo of the problem.</li>
<li><b>Lost parcels:</b> we reprint free once the carrier confirms it is lost.</li>
</ul>
<h2>What we can't cover</h2>
<ul>
<li>Mistakes in text you approved (for example a misspelled name), because you read and approved every word before printing. We are happy to make a corrected copy at cost.</li>
<li>A change of mind once a made-to-order print is in production.</li>
</ul>
<h2>How to ask</h2>
<p>Contact us (see our <a href="/contact">contact page</a>) with your order number and, for damage, a photo. Refunds go back to the card you paid with.</p>
"""),
"shipping": ("Shipping", """
<ul>
<li><b>Where:</b> we ship framed and printed portraits within the United States, including Washington, DC. We don't ship outside the US yet. [APO/FPO addresses: to be confirmed with Gelato.] Digital portraits work anywhere.</li>
<li><b>Cost:</b> standard shipping in the USA is free and included in the price.</li>
<li><b>How long:</b> each portrait is printed and framed to order. Production and shipping usually take about 7 to 11 days, plus a day or two for our quality check. Digital portraits are ready immediately.</li>
<li><b>Holiday dates:</b> we show an order-by date for the next holiday on every page. If that date has passed, you can still order: we'll send a printable gift card to give on the day, and the portrait ships right after.</li>
<li><b>Tracking:</b> we email you a tracking link when your portrait ships.</li>
<li><b>Problems:</b> see <a href="/refunds">refunds and reprints</a>.</li>
</ul>
"""),
"contact": ("Contact", """
<p>We're a small team and we read every message.</p>
<ul>
<li><b>Email:</b> <a data-support-email href="#">our support address is coming soon</a></li>
<li><b>Delete my data:</b> email us from the address you used, with your portrait or order link, and write "Delete my data". We'll confirm when it's done.</li>
</ul>
<p>The Legacy Press<br><span data-business-address>[Business address to be added]</span></p>
"""),
}

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} · Legacy Portrait</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body>
<div id="orderBanner" hidden></div>
<header class="topbar"><a class="brand" href="/" data-brand="product">Legacy Portrait</a></header>
<main class="wrap narrow policy">
<h1>{title}</h1>
{draft}
{body}
</main>
<footer id="siteFooter"></footer>
<script src="/js/page.js" type="module"></script>
</body>
</html>
"""

for slug, (title, body) in PAGES.items():
    draft = DRAFT if slug != "contact" else ""
    (ROOT / "public" / f"{slug}.html").write_text(HEAD.format(title=title, draft=draft, body=body.strip()))
    print("wrote", f"public/{slug}.html")
