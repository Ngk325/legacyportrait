#!/usr/bin/env python3
"""Render a portrait JSON through the HTML template to a 300 DPI PNG and a print PDF.

Usage: python3 scripts/render.py data/elias-haddad.json out/elias-haddad
Output: <out>.png (3300x4200 for 11x14), <out>.pdf (11x14 in), <out>.fit.json (auto-fit report)
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
PAGE_W_IN, PAGE_H_IN = 11, 14
CSS_PX_PER_IN = 96
DPI = 300


def serve(root: Path):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    data_path = Path(sys.argv[1])
    out_base = Path(sys.argv[2])
    out_base.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(data_path.read_text())

    httpd = serve(ROOT)
    port = httpd.server_address[1]
    url = f"http://127.0.0.1:{port}/template/index.html"

    scale = DPI / CSS_PX_PER_IN
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"]) \
            if Path("/opt/pw-browsers/chromium").exists() else p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": PAGE_W_IN * CSS_PX_PER_IN, "height": PAGE_H_IN * CSS_PX_PER_IN},
            device_scale_factor=scale,
        )
        page = ctx.new_page()
        page.add_init_script(f"window.__PORTRAIT__ = {json.dumps(data)};")
        page.on("console", lambda m: print("[browser]", m.text))
        page.on("pageerror", lambda e: print("[pageerror]", e))
        page.goto(url)
        page.wait_for_selector("body[data-ready='1']", timeout=120000)
        fit = page.evaluate("window.__FIT__")
        page.screenshot(path=f"{out_base}.png", clip={"x": 0, "y": 0, "width": PAGE_W_IN * CSS_PX_PER_IN, "height": PAGE_H_IN * CSS_PX_PER_IN})
        page.pdf(path=f"{out_base}.pdf", width=f"{PAGE_W_IN}in", height=f"{PAGE_H_IN}in", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        browser.close()
    Path(f"{out_base}.fit.json").write_text(json.dumps(fit, indent=2))
    print("fit:", fit)
    httpd.shutdown()


if __name__ == "__main__":
    main()
