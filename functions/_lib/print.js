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

  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: DESIGN_W, height: designH, deviceScaleFactor: format === "png" ? scale : 1 });
    await page.evaluateOnNewDocument((d, w, h) => { window.__PORTRAIT__ = d; window.__PAGE__ = { w, h }; }, data, DESIGN_W, designH);
    await page.goto(new URL("/template/index.html", origin).toString(), { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("body[data-ready='1']", { timeout: 90000 });
    const fit = await page.evaluate(() => window.__FIT__);
    if (format === "png") {
      const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: DESIGN_W, height: designH } });
      return { body: buf, type: "image/png", fit };
    }
    const buf = await page.pdf({
      width: `${wIn}in`, height: `${hIn}in`,
      scale: (wIn * CSS_PX_PER_IN) / DESIGN_W,
      pageRanges: "1", printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return { body: buf, type: "application/pdf", fit };
  } finally {
    await browser.close();
  }
}
