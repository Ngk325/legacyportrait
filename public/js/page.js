// Plain content pages (landing, policies, contact): banner, footer and config-driven text.
import { $, $$, initSite, money, longDate } from "./site.js";

async function main() {
  const cfg = await initSite();
  // landing page: prices and dates come from the same config the checkout uses
  if ($("[data-price]") || $("[data-orderby]")) {
    const cat = await fetch("/api/products").then((r) => r.json()).catch(() => null);
    if (cat) {
      const price = (key) => {
        const [product, size, extra] = key.split(":");
        const p = cat.products[product];
        if (!p) return "";
        const base = p.physical ? p.prices[size] : p.prices.any;
        return money(base + (extra === "assembled" ? cat.assemblyCents : 0));
      };
      $$("[data-price]").forEach((el) => (el.textContent = price(el.dataset.price)));
      const ob = cat.orderBy;
      $$("[data-orderby]").forEach((el) => {
        el.textContent = ob.physical ? `${longDate(ob.physical.orderBy, { weekday: false })} for ${ob.physical.name}` : "the date shown at checkout";
      });
    }
  }
  $$("[data-business-address]").forEach((el) => { if (cfg.businessAddress) el.textContent = cfg.businessAddress; });
  $$("[data-support-email]").forEach((el) => {
    if (cfg.supportEmail) { el.textContent = cfg.supportEmail; el.href = `mailto:${cfg.supportEmail}`; }
  });
  // example portrait iframes scale to their box
  $$(".pv iframe").forEach((f) => {
    const fit = () => (f.style.transform = `scale(${f.parentElement.clientWidth / 1056})`);
    window.addEventListener("resize", fit); fit();
  });
}
main();
