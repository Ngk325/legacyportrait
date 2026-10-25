#!/usr/bin/env python3
"""Render a portrait JSON through the HTML template to a 300 DPI PNG and a print PDF.

Usage: python3 scripts/render.py data/elias-haddad.json out/elias-haddad [WxH inches, default 11x14]
Output: <out>.png (300 DPI, e.g. 3300x4200 for 11x14), <out>.pdf (exact size), <out>.fit.json (auto-fit report)
Sizes in the 4:5 family (8x10, 11x14, 16x20) share one layout; the page is scaled uniformly.
"""
import json
import sys
import threading
import functools
import http.server
import socketserver
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CSS_PX_PER_IN = 96
DPI = 300
DESIGN_W = 1056   # the layout is always designed at 11 in wide (1056 px); other sizes scale uniformly


def serve(root: Path):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    data_path = Path(sys.argv[1])
    out_base = Path(sys.argv[2])
    size = sys.argv[3] if len(sys.argv) > 3 else "11x14"
    PAGE_W_IN, PAGE_H_IN = (float(x) for x in size.lower().split("x"))
    design_h = round(DESIGN_W * PAGE_H_IN / PAGE_W_IN)
    scale = PAGE_W_IN * DPI / DESIGN_W
    out_base.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(data_path.read_text())

    httpd = serve(ROOT)
    port = httpd.server_address[1]
    url = f"http://127.0.0.1:{port}/public/template/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"]) \
            if Path("/opt/pw-browsers/chromium").exists() else p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": DESIGN_W, "height": design_h},
            device_scale_factor=scale,
        )
        page = ctx.new_page()
        page.add_init_script(f"window.__PORTRAIT__ = {json.dumps(data)}; window.__PAGE__ = {{w: {DESIGN_W}, h: {design_h}}};")
        page.on("console", lambda m: print("[browser]", m.text))
        page.on("pageerror", lambda e: print("[pageerror]", e))
        page.goto(url)
        page.wait_for_selector("body[data-ready='1']", timeout=120000)
        fit = page.evaluate("window.__FIT__")
        page.screenshot(path=f"{out_base}.png", clip={"x": 0, "y": 0, "width": DESIGN_W, "height": design_h})
        page.pdf(path=f"{out_base}.pdf", width=f"{PAGE_W_IN}in", height=f"{PAGE_H_IN}in", scale=PAGE_W_IN * CSS_PX_PER_IN / DESIGN_W, page_ranges="1", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        browser.close()
    Path(f"{out_base}.fit.json").write_text(json.dumps(fit, indent=2))
    print("fit:", fit)
    httpd.shutdown()


if __name__ == "__main__":
    main()
