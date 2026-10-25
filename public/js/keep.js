// Product page: digital, print only or framed; size, frame, assembly; gift. Prices come from /api/products,
// the server re-prices whatever is chosen, and (until WP4) the choice is saved as a pending order.
import { $, $$, initSite, money, longDate } from "./site.js";

const id = new URLSearchParams(location.search).get("id") || "";
const SIZE_LABEL = { "8x10": "8 × 10 in", "11x14": "11 × 14 in", "16x20": "16 × 20 in" };
const SIZE_IN = { "8x10": 8, "11x14": 11, "16x20": 16 };
const DESCRIPTIONS = {
  digital: "Instant download (PDF + image). Print it anywhere.",
  print: "Semi-gloss print, no frame. Ships to your door.",
  framed: "Wood frame, ships to your door.",
};
let catalog, portrait;
const choice = { product: "framed", size: "11x14", color: "wood", assembled: true, gift: false };

function banner(msg) { const b = $("#banner"); b.textContent = msg; b.className = "banner error"; b.hidden = !msg; }

function radio(name, value, checked, label, extra = "") {
  const l = document.createElement("label");
  l.className = "pill";
  l.innerHTML = `<input type="radio" name="${name}" value="${value}"${checked ? " checked" : ""}> <span></span>${extra}`;
  l.querySelector("span").textContent = label;
  return l;
}

function fromPrice(p) {
  if (!p.physical) return p.prices.any;
  return Math.min(...Object.values(p.prices));
}

function renderCards() {
  const box = $("#productCards");
  box.querySelectorAll(".card").forEach((n) => n.remove());
  for (const [key, p] of Object.entries(catalog.products)) {
    const card = document.createElement("label");
    card.className = "card" + (choice.product === key ? " selected" : "");
    const hero = key === catalog.hero.product;
    card.innerHTML = `<input type="radio" name="product" value="${key}"${choice.product === key ? " checked" : ""}>
      <span class="card-title"></span>${hero ? '<span class="tag">Most popular</span>' : ""}
      <span class="card-price"></span><span class="card-desc"></span><span class="card-note"></span>`;
    card.querySelector(".card-title").textContent = p.label;
    card.querySelector(".card-price").textContent = (p.physical ? "from " : "") + money(fromPrice(p));
    card.querySelector(".card-desc").textContent = DESCRIPTIONS[key] || "";
    card.querySelector(".card-note").textContent = p.physical ? `Includes the digital file (${money(catalog.digitalValueCents)} value)` : "";
    box.appendChild(card);
  }
  $$("input[name=product]").forEach((r) => (r.onchange = () => { choice.product = r.value; update(); }));
}

function renderOptions() {
  const sizes = $("#sizes"); sizes.querySelectorAll(".pill").forEach((n) => n.remove());
  const p = catalog.products[choice.product];
  for (const s of catalog.sizes) sizes.appendChild(radio("size", s, choice.size === s, SIZE_LABEL[s], p.physical ? ` <small>${money(p.prices[s])}</small>` : ""));
  $$("input[name=size]").forEach((r) => (r.onchange = () => { choice.size = r.value; update(); }));

  const colors = $("#colors"); colors.querySelectorAll(".pill").forEach((n) => n.remove());
  for (const c of catalog.frameColors) colors.appendChild(radio("color", c.id, choice.color === c.id, c.label));
  $$("input[name=color]").forEach((r) => (r.onchange = () => { choice.color = r.value; update(); }));

  const asm = $("#assembly"); asm.querySelectorAll(".pill").forEach((n) => n.remove());
  asm.appendChild(radio("assembled", "yes", choice.assembled, `Ready to hang (+${money(catalog.assemblyCents)})`));
  asm.appendChild(radio("assembled", "no", !choice.assembled, "Assemble yourself"));
  $$("input[name=assembled]").forEach((r) => (r.onchange = () => { choice.assembled = r.value === "yes"; update(); }));
}

function price() {
  const p = catalog.products[choice.product];
  if (!p.physical) return p.prices.any;
  return p.prices[choice.size] + (p.assembly && choice.assembled ? catalog.assemblyCents : 0);
}

// same rule as the photo step: main photo about 45% of the page width
function photoWarning() {
  const main = (portrait.photos || [])[0];
  if (!main || !catalog.products[choice.product].physical) return "";
  const W = SIZE_IN[choice.size];
  const dpi = Math.floor(Math.min(main.width / (W * 0.45), main.height / (W * 0.5)));
  if (dpi >= 150) return "";
  const smaller = catalog.sizes.filter((s) => SIZE_IN[s] < W).map((s) => SIZE_LABEL[s]);
  return `Your main photo is small for this size (about ${dpi} dpi). It will still work, but it may look soft in print.` + (smaller.length ? ` ${smaller[0]} will look sharper.` : "");
}

function update() {
  const p = catalog.products[choice.product];
  $$(".card").forEach((c) => c.classList.toggle("selected", c.querySelector("input").value === choice.product));
  $("#physicalOpts").hidden = !p.physical;
  $("#frameOpts").hidden = !p.colors;
  renderOptions();
  const warn = photoWarning(); $("#photoWarn").hidden = !warn; $("#photoWarn").textContent = warn; $("#photoWarn").className = "quality q-warn";
  const ob = catalog.orderBy;
  $("#shipLine").textContent = ob.missed
    ? `Free standard shipping to the US. Framed and printed portraits ordered now arrive after ${ob.missed.name}, by about ${longDate(catalog.estimatedArrival, { weekday: false })}.`
    : `Free standard shipping to the US. Ordered today, it arrives by about ${longDate(catalog.estimatedArrival, { weekday: false })}.`;
  $("#total").textContent = money(price());
  $("#giftOpts").hidden = !choice.gift;
}

async function main() {
  await initSite();
  $("#back").href = `/preview?id=${id}`;
  if (!/^[a-f0-9]{32}$/.test(id)) { banner("This link isn't complete. Please open it from your portrait."); return; }
  const [pr, cr, or] = await Promise.all([fetch(`/api/portraits/${id}`), fetch("/api/products"), fetch(`/api/portraits/${id}/order`)]);
  if (!pr.ok) { banner("This draft link has expired. Start a new portrait or contact us and we'll help."); return; }
  portrait = await pr.json(); catalog = await cr.json();
  if (portrait.status !== "approved") { location.replace(`/create?id=${id}#draft`); return; }
  const saved = or.ok ? (await or.json()).order : null;
  if (saved) Object.assign(choice, { product: saved.product, size: saved.size || "11x14", color: saved.color || "wood", assembled: saved.assembled, gift: saved.gift });
  if (saved) { $("#giftRecipient").value = saved.giftRecipient; $("#giftMessage").value = saved.giftMessage; }
  if (new URLSearchParams(location.search).get("canceled")) banner("No charge was made. Your portrait is saved.");
  if (catalog.orderBy.missed) { $("#late").hidden = false; $("#late").textContent = `Framed portraits ordered now arrive after ${catalog.orderBy.missed.name}. Choose the printable gift card to give today.`; }
  $("#gift").checked = choice.gift;
  $("#gift").onchange = (e) => { choice.gift = e.target.checked; update(); };
  renderCards(); update();

  $("#pay").onclick = async () => {
    $("#pay").disabled = true; banner("");
    try {
      const res = await fetch(`/api/portraits/${id}/order`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...choice, giftRecipient: $("#giftRecipient").value, giftMessage: $("#giftMessage").value }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      if (d.checkout && d.checkout.available && d.checkout.url) { location.href = d.checkout.url; return; }
      $("#saved").hidden = false;
      $("#saved").textContent = `Your choice is saved (${money(d.order.amount)}). Secure payment opens very soon; we'll keep your portrait ready.`;
    } catch (e) { banner(e.message); } finally { $("#pay").disabled = false; }
  };
}
main();
