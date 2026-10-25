#!/usr/bin/env python3
"""Click through the create flow in a real browser against `wrangler pages dev` (port 8788)."""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8788"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"; OUT.mkdir(exist_ok=True)
PHOTO = str(ROOT / "public/template/assets/placeholder-portrait.jpg")
PHOTO2 = str(OUT / "wanis-crop.jpg") if (OUT / "wanis-crop.jpg").exists() else PHOTO

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1280, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
    pg.goto(f"{BASE}/create.html")

    # 1. try to go on without anything: must be refused
    pg.click("#step-photos [data-next]"); pg.click("#step-story [data-next]"); pg.click("#step-style [data-next]")
    print("blocked without data:", pg.inner_text("#banner").strip())

    pg.goto(f"{BASE}/create.html")
    pg.set_input_files("#file", [PHOTO, PHOTO2])
    pg.wait_for_selector("#photoList li:nth-child(2)")
    print("photos listed:", pg.locator("#photoList li").count(), "| quality:", [t.strip() for t in pg.locator(".quality").all_inner_texts()])
    pg.select_option("#printSize", "16x20"); time.sleep(.3)
    print("16x20 quality:", [t.strip() for t in pg.locator(".quality").all_inner_texts()])
    pg.select_option("#printSize", "11x14")
    pg.check("#rights")
    pg.screenshot(path=str(OUT / "e2e-1-photos.png"))
    pg.click("#step-photos [data-next]")

    s = "#step-story "
    pg.fill(s + "[data-a=name]", "Elias Haddad"); pg.fill(s + "[data-a=relationship]", "granddaughter"); pg.select_option(s + "[data-a=pronoun]", "he")
    pg.fill(s + "[data-a=born]", "in 1904"); pg.fill(s + "[data-a=died]", "in 1981")
    pg.fill(s + "[data-a=origins]", "He arrived with a set of tools wrapped in a wool blanket.")
    pg.fill(s + "[data-a=work]", "He was a carpenter who built half the porches on Maple Street.")
    pg.fill(s + "[data-a=family]", "He married Rose in 1931 and they raised six children.")
    pg.fill(s + "[data-a=story]", "He promised his mother he would write every Sunday and kept that promise for forty years.")
    pg.fill(s + "[data-a=byline]", "Maria Haddad")
    pg.screenshot(path=str(OUT / "e2e-2-story.png"), full_page=True)
    pg.click(s + "[data-next]")
    pg.fill("#step-style [data-f=publication]", "The Haddad Family Gazette")
    pg.click("#step-style [data-next]")
    pg.wait_for_selector("#paras .para", timeout=30000)
    time.sleep(3)  # let the preview render
    print("draft status:", pg.inner_text("#draftStatus").strip()[:120])
    print("paragraphs:", pg.locator("#paras .para").count(), "| gaps:", pg.inner_text("#gaps").replace("\n", " ")[:160])
    pg.screenshot(path=str(OUT / "e2e-3-draft.png"), full_page=True)

    # edit, autosave, preview refresh
    pg.fill("#paras .para:first-child textarea", "Elias Haddad was born in 1904, and this line was edited by the customer.")
    time.sleep(2.5)
    print("saveState:", pg.inner_text("#saveState"))
    # approval needs the checkbox
    print("approve disabled before ticking:", pg.is_disabled("#approve"))
    pg.check("#approveBox"); pg.click("#approve"); pg.wait_for_selector("#approved:not([hidden])")
    print("approved message visible:", pg.is_visible("#approved"))
    # edit after approval must reset approval
    pg.fill("#paras .para:first-child textarea", "Elias Haddad was born in 1904, edited again.")
    print("approval reset after edit:", pg.is_hidden("#approved"), "| approve disabled:", pg.is_disabled("#approve"))
    time.sleep(2)
    # rewrite with notes
    pg.fill("#notes", "make it shorter"); pg.click("#regen"); time.sleep(2)
    print("regen left:", pg.inner_text("#regenLeft"))

    url = pg.url; print("resume url:", url)
    pg2 = b.new_page(viewport={"width": 1280, "height": 1000}); pg2.goto(url); time.sleep(3)
    print("resumed on step:", pg2.evaluate("document.querySelector('section.panel:not([hidden])').dataset.step"), "| paragraphs:", pg2.locator("#paras .para").count(), "| name filled:", pg2.input_value("#step-story [data-a=name]"))
    pg2.screenshot(path=str(OUT / "e2e-4-resumed.png"), full_page=True)

    # mobile layout
    pg3 = b.new_page(viewport={"width": 390, "height": 800}); pg3.goto(url); time.sleep(3)
    ov = pg3.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    print("mobile horizontal overflow px:", ov)
    pg3.screenshot(path=str(OUT / "e2e-5-mobile.png"))
    print("browser errors:", errs or "none")
    b.close()
