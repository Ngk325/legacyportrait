// Shared bits for every page: site config, the order-by banner, the footer, money and date formatting.
// Pages include <div id="orderBanner"></div> and <footer id="siteFooter"></footer> and call initSite().

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let configPromise = null;
export function getConfig() {
  if (!configPromise) configPromise = fetch("/api/config").then((r) => r.json()).catch(() => ({ brand: {}, orderBy: {} }));
  return configPromise;
}

export const money = (cents) => "$" + (cents / 100).toFixed(cents % 100 ? 2 : 0);

// "2026-11-11" -> "Wednesday, November 11" (a calendar date, so format it in UTC to avoid shifting a day)
export function longDate(ymd, { weekday = true } = {}) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", ...(weekday ? { weekday: "long" } : {}) });
}

export function orderByText(orderBy) {
  if (!orderBy) return "";
  if (orderBy.missed) return `Framed portraits ordered now arrive after ${orderBy.missed.name}. Give a printable gift card today.`;
  if (orderBy.physical) return `Order your framed portrait by ${longDate(orderBy.physical.orderBy)} for ${orderBy.physical.name} delivery. Digital portraits are ready instantly.`;
  return "";
}

function renderBanner(cfg) {
  const el = $("#orderBanner");
  if (!el) return;
  const text = orderByText(cfg.orderBy);
  el.hidden = !text;
  el.className = "order-banner";
  el.textContent = text;
}

function renderFooter(cfg) {
  const el = $("#siteFooter");
  if (!el) return;
  const company = (cfg.brand && cfg.brand.company) || "The Legacy Press";
  el.className = "site-footer";
  el.innerHTML = `<nav aria-label="Policies">
      <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">Refunds and reprints</a><a href="/shipping">Shipping</a><a href="/contact">Contact</a>
    </nav><p></p>`;
  el.querySelector("p").textContent = `Made by ${company}.` + (cfg.businessAddress ? ` ${cfg.businessAddress}` : "");
}

export async function initSite() {
  const cfg = await getConfig();
  renderBanner(cfg);
  renderFooter(cfg);
  $$("[data-brand]").forEach((el) => (el.textContent = cfg.brand?.[el.dataset.brand] || el.textContent));
  return cfg;
}
