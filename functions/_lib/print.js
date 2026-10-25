// Makes the print-ready PNG / PDF of a portrait with Cloudflare Browser Run (headless Chromium).
// One layout designed at 11 in wide (1056 px); other sizes scale uniformly (same 4:5 shape).
import puppeteer from "@cloudflare/puppeteer";

export const SIZES = { "8x10": [8, 10], "11x14": [11, 14], "16x20": [16, 20] };
const DESIGN_W = 1056, DPI = 300, CSS_PX_PER_IN = 96;

export async function renderPrint(env, origin, data, size, format) {
  const dims = SIZES[size];
  if (!dims) throw new Error("Unknown size");
  const [wIn, hIn] = dims;
  const designH = Math.round((DESIGN_W * hIn) / wIn);
  const scale = (wIn * DPI) / DESIGN_W;

  const { browser, how } = await getBrowser(env);
  let page;
  try {
    page = await browser.newPage();
    // Full 300 DPI scale for PDFs too: the halftone canvas is drawn at devicePixelRatio (same as scripts/render.py).
    await page.setViewport({ width: DESIGN_W, height: designH, deviceScaleFactor: scale });
    await page.evaluateOnNewDocument((d, w, h) => { window.__PORTRAIT__ = d; window.__PAGE__ = { w, h }; }, data, DESIGN_W, designH);
    await page.goto(new URL("/template/index.html", origin).toString(), { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("body[data-ready='1']", { timeout: 90000 });
    const fit = await page.evaluate(() => window.__FIT__);
    if (format === "png") {
      const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: DESIGN_W, height: designH } });
      return { body: buf, type: "image/png", fit, how };
    }
    const buf = await page.pdf({
      width: `${wIn}in`, height: `${hIn}in`,
      scale: (wIn * CSS_PX_PER_IN) / DESIGN_W,
      pageRanges: "1", printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return { body: buf, type: "application/pdf", fit, how };
  } finally {
    // leave the browser running (keep_alive) so the next print reuses it instead of launching a new one
    if (page) await page.close().catch(() => {});
    await browser.disconnect().catch(() => {});
  }
}

// Browser Run limits how often new browsers can be launched (a burst of 3 sizes got "429 Rate limit exceeded"
// on the deployed preview). So: reuse an idle session if there is one, else launch one that stays alive for
// a minute. A session that was just released is not listed as free for a few seconds, and a launch may be
// rate limited, so keep trying both for up to ~25 s before giving up.
const KEEP_ALIVE_MS = 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getBrowser(env) {
  const deadline = Date.now() + 25000;
  let lastError;
  for (let round = 0; ; round++) {
    let sessions = [];
    try { sessions = await puppeteer.sessions(env.BROWSER); } catch { /* listing failed; still try to launch */ }
    for (const s of sessions.filter((x) => !x.connectionId)) {
      try { return { browser: await puppeteer.connect(env.BROWSER, s.sessionId), how: "reused" }; } catch { /* taken or gone */ }
    }
    // a busy session will be free in a moment: wait for it rather than spend a launch
    if (!sessions.length || round > 0) {
      try {
        return { browser: await puppeteer.launch(env.BROWSER, { keep_alive: KEEP_ALIVE_MS }), how: round ? "launched after wait" : "launched" };
      } catch (e) {
        if (!/429|rate limit/i.test(String(e.message || e))) throw e;
        lastError = e;
      }
    }
    if (Date.now() > deadline) throw lastError || new Error("No browser available");
    await sleep(2000);
  }
}
