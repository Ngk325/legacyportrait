// Team admin: orders queue, review gate, manual Gelato steps, refunds, numbers.
// The ADMIN_TOKEN is kept in sessionStorage (this tab only) and sent as a header, never in a URL.
// Everything shown comes from our API and is set with textContent (customer text is never parsed as HTML).
import { $, $$, money } from "./site.js";

const KEY = "lp_admin_token";
const store = {
  get: () => { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} },
};
let token = store.get();
let view = "paid";
let current = null; // the order detail on screen

const STATUS = { pending: "Not paid", paid: "Needs review", ready: "Ready to print", placed: "Placed with Gelato", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded" };
const statusText = (o) => (o.status === "paid" && !o.physical ? "Paid (digital)" : STATUS[o.status] || o.status);
const when = (s) => (s ? new Date(s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z")).toLocaleString() : "");

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "x-admin-token": token, ...(opts.body ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) } });
  if (res.status === 401) { signOut("That token didn't work."); throw new Error("signed out"); }
  return res;
}
async function apiJson(path, opts) {
  const res = await api(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function flash(text, bad = false) {
  const f = $("#flash");
  f.textContent = text; f.hidden = !text; f.className = "banner" + (bad ? " error" : "");
  if (text) f.scrollIntoView({ block: "nearest" });
}
const li = (text) => { const el = document.createElement("li"); el.textContent = text; return el; };
const fill = (ul, items, empty = "None.") => { ul.replaceChildren(...(items.length ? items.map(li) : [li(empty)])); };

function signOut(msg) {
  token = ""; store.set("");
  show("login");
  flash(msg || "");
}

function show(section) {
  for (const id of ["login", "orders", "detail", "numbers"]) $("#" + id).hidden = id !== section;
  $("#signOut").hidden = section === "login";
  $$("[data-tab]").forEach((b) => { if ((section === "detail" ? "orders" : section) === b.dataset.tab) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
}

async function modeBanner() {
  const c = await apiJson("/api/admin/config");
  const b = $("#modeBanner");
  b.hidden = false;
  b.className = "banner" + (c.liveMode ? " live" : "");
  b.textContent = (c.liveMode ? "LIVE MODE: real cards are charged." : "Test mode: Stripe test keys, no real charges.") + ` Fulfillment: ${c.fulfillmentMode}.`;
}

// ---------- orders queue ----------
async function loadOrders() {
  show("orders");
  $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  const { orders } = await apiJson(`/api/admin/orders?view=${view === "done" ? "done" : "open"}`);
  const list = view === "done" ? orders : orders.filter((o) => o.status === view);
  $("#orderList").replaceChildren(...list.map((o) => {
    const item = document.createElement("li");
    const b = document.createElement("button"); b.type = "button";
    const t = document.createElement("span"); t.textContent = `${o.name || "(no name)"}: ${o.label}`;
    const s = document.createElement("span"); s.className = "st"; s.textContent = statusText(o);
    const sub = document.createElement("span"); sub.className = "sub";
    sub.textContent = [money(o.amount || 0), o.livemode ? "live" : "test", o.gift ? "gift" : "", o.shippingState || "", when(o.createdAt), o.id].filter(Boolean).join(" · ");
    b.append(t, s, sub);
    b.addEventListener("click", () => openOrder(o.id));
    item.appendChild(b);
    return item;
  }));
  $("#empty").hidden = list.length > 0;
}

// ---------- one order ----------
async function openOrder(id) {
  flash("");
  render(await apiJson(`/api/admin/orders/${id}`));
  show("detail");
  window.scrollTo(0, 0);
}

function render(d) {
  current = d;
  const o = d.order, p = d.portrait || {};
  $("#dTitle").textContent = `${p.name || "(no name)"}: ${o.label}`;
  $("#dSub").textContent = [statusText(o), money(o.amount || 0), o.livemode ? "live payment" : "test payment", `ordered ${when(o.createdAt)}`, o.id].join(" · ");

  const warns = [];
  if (p.shortStory) warns.push(`Short story (${p.words} words): check that the page doesn't look empty.`);
  (p.photos || []).forEach((ph, i) => { if (ph.lowRes) warns.push(`Photo ${i + 1} is small for ${o.size} (${ph.width} × ${ph.height} px). The customer was warned; check the print.`); });
  if (o.physical && d.gelato.mode !== "manual" && !d.gelato.productUid) warns.push(`No Gelato productUid for ${d.gelato.sku}: add it to config/gelato-products.js.`);
  $("#dWarn").replaceChildren(...warns.map((w) => { const el = document.createElement("p"); el.className = "warn-line"; el.textContent = w; return el; }));

  $("#dEmail").textContent = o.email || "(no email)";
  const a = o.shippingAddress;
  $("#dShip").hidden = !a;
  if (a) $("#dAddr").textContent = [o.shippingName, a.line1, a.line2, `${a.city || ""}, ${a.state || ""} ${a.postal_code || ""}`, a.country, a.phone ? `Phone ${a.phone}` : ""].filter(Boolean).join("\n");
  $("#dGift").hidden = !o.gift;
  $("#dGift").textContent = o.gift ? `Gift${o.giftMessage ? `: "${o.giftMessage}"` : ""}` : "";

  // review gate (physical only, before printing)
  const reviewable = o.physical && ["paid", "ready"].includes(o.status);
  $("#reviewBox").hidden = !reviewable;
  $("#rvText").checked = !!o.review?.textFits; $("#rvPhoto").checked = !!o.review?.photoOk; $("#rvBlank").checked = !!o.review?.noBlank;
  $("#printImg").hidden = true; $("#fitOut").textContent = o.review?.fit ? `Last check: ${o.review.fit}` : "";

  // print-file downloads (fetched with the header so the token never sits in a link)
  $("#dFiles").replaceChildren(...d.files.map((f) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn small";
    b.textContent = `${f.format.toUpperCase()} ${f.size.replace("x", " × ")}`;
    b.addEventListener("click", () => download(`/api/portraits/${o.portraitId}/print?size=${f.size}&format=${f.format}`, `${o.id}-${f.size}.${f.format}`, b));
    return b;
  }));

  // Gelato
  const printable = o.physical && !["refunded", "delivered"].includes(o.status);
  $("#fulfilBox").hidden = !o.physical;
  $("#gInfo").textContent = `Mode ${d.gelato.mode}. SKU ${d.gelato.sku}. productUid ${d.gelato.productUid || "not set"}. API key ${d.gelato.apiKey ? "set" : "not set"}.` + (o.providerOrderId ? ` Gelato order ${o.providerOrderId}${o.fulfillmentStatus ? ` (${o.fulfillmentStatus})` : ""}.` : "");
  $("#sendRow").hidden = !(d.gelato.mode !== "manual" && o.status === "ready");
  $("#payloadBox").hidden = !o.payload;
  $("#payload").textContent = o.payload ? JSON.stringify(o.payload, null, 2) : "";
  $("#placedForm").hidden = !(printable && ["ready", "placed"].includes(o.status));
  $("#gelatoId").value = o.providerOrderId || "";
  $("#trackForm").hidden = !(printable && ["placed", "shipped"].includes(o.status));
  $("#trCode").value = o.trackingCode || ""; $("#trUrl").value = o.trackingUrl || ""; $("#trCarrier").value = o.carrier || "";

  $("#delivered").hidden = !(o.status === "shipped" || (!o.physical && o.status === "paid"));
  $("#refund").hidden = !["paid", "ready", "placed", "shipped", "delivered"].includes(o.status);
  $("#resend").hidden = !o.email || ["pending", "refunded"].includes(o.status);
  $("#note").value = o.note || "";

  fill($("#dEmails"), d.emails.map((e) => `${when(e.created_at)} · ${e.template} · ${e.status}`));
  fill($("#dErrors"), d.errors.map((e) => `${when(e.created_at)} · ${e.source} · ${e.message}`));
}

async function act(body, button) {
  if (button) button.disabled = true;
  try {
    const d = await apiJson(`/api/admin/orders/${current.order.id}`, { method: "POST", body: JSON.stringify(body) });
    render(d);
    flash(d.message || "Done.");
  } catch (e) {
    if (e.message !== "signed out") flash(e.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function download(path, name, button) {
  const label = button.textContent;
  button.disabled = true; button.textContent = "Rendering…";
  try {
    const res = await api(path);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Download failed (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    if (e.message !== "signed out") flash(e.message, true);
  } finally {
    button.disabled = false; button.textContent = label;
  }
}

async function checkPrint() {
  const o = current.order, btn = $("#checkPrint");
  btn.disabled = true; $("#fitOut").textContent = "Rendering (can take 20 seconds)…";
  try {
    const res = await api(`/api/portraits/${o.portraitId}/print?size=${o.size}&format=png`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Render failed (${res.status})`);
    const fit = res.headers.get("x-fit-ok"), pt = res.headers.get("x-body-pt");
    const img = $("#printImg");
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(await res.blob()); img.hidden = false;
    const text = fit === "true" ? `Text fits${pt ? ` at ${pt} pt` : ""}.` : fit === "false" ? `Text did NOT fit${pt ? ` (${pt} pt)` : ""}.` : "Fit not recorded for this file.";
    $("#fitOut").textContent = text;
    current.lastFit = text;
    if (fit === "true") $("#rvText").checked = true;
  } catch (e) {
    if (e.message !== "signed out") { $("#fitOut").textContent = ""; flash(e.message, true); }
  } finally {
    btn.disabled = false;
  }
}

// ---------- numbers ----------
async function loadNumbers() {
  show("numbers");
  const s = await apiJson(`/api/admin/stats?days=${$("#days").value}`);
  const t = s.totals;
  const kpi = (n, label) => { const d = document.createElement("div"); const b = document.createElement("b"); b.textContent = n; const sp = document.createElement("span"); sp.textContent = label; d.append(b, sp); return d; };
  $("#kpis").replaceChildren(
    kpi(t.starts, "started"), kpi(t.drafts, "got a draft"), kpi(t.approved, "approved text"), kpi(t.emails, "gave an email"),
    kpi(t.checkouts, "chose a format"), kpi(t.purchases, "paid"), kpi(money(t.revenueLiveCents), "revenue (live)"), kpi(money(t.revenueTestCents), "revenue (test)"),
    kpi(t.refunds, "refunded"), kpi("$" + t.aiUsd.toFixed(2), "AI cost"),
    kpi(s.aiPerPortrait?.avg_usd != null ? "$" + Number(s.aiPerPortrait.avg_usd).toFixed(3) : "–", "AI per portrait (avg)"),
  );
  fill($("#ai"), s.aiByPurpose.map((r) => `${r.purpose} · ${r.provider}: ${r.calls} calls (${r.failed} failed), $${Number(r.usd || 0).toFixed(4)}`));
  fill($("#mails"), s.emails.map((r) => `${r.template} · ${r.status}: ${r.n}`));
  fill($("#errs"), s.errors.map((e) => `${when(e.created_at)} · ${e.source} · ${e.message}${e.portrait_id ? ` · ${e.portrait_id}` : ""}`));
}

// ---------- wiring ----------
$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  token = $("#token").value.trim(); store.set(token); $("#token").value = "";
  start();
});
$("#signOut").addEventListener("click", () => signOut("Signed out."));
$$("[data-tab]").forEach((b) => b.addEventListener("click", () => (b.dataset.tab === "numbers" ? loadNumbers() : loadOrders()).catch(err)));
$$("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; loadOrders().catch(err); }));
$("#back").addEventListener("click", () => loadOrders().catch(err));
$("#days").addEventListener("change", () => loadNumbers().catch(err));
$("#csv").addEventListener("click", (e) => download(`/api/admin/stats?days=${$("#days").value}&format=csv`, `legacy-portrait-${$("#days").value}d.csv`, e.currentTarget));
$("#copyAddr").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#dAddr").textContent); flash("Address copied."); } catch { flash("Couldn't copy; select the address and copy it by hand.", true); }
});
$("#checkPrint").addEventListener("click", checkPrint);
$("#saveReview").addEventListener("click", (e) => act({ action: "review", textFits: $("#rvText").checked, photoOk: $("#rvPhoto").checked, noBlank: $("#rvBlank").checked, fit: current.lastFit || "" }, e.currentTarget));
$("#sendGelato").addEventListener("click", (e) => act({ action: "fulfill" }, e.currentTarget));
$("#placedForm").addEventListener("submit", (e) => { e.preventDefault(); act({ action: "placed", providerOrderId: $("#gelatoId").value }, e.submitter); });
$("#trackForm").addEventListener("submit", (e) => { e.preventDefault(); act({ action: "tracking", trackingCode: $("#trCode").value, trackingUrl: $("#trUrl").value, carrier: $("#trCarrier").value }, e.submitter); });
$("#delivered").addEventListener("click", (e) => act({ action: "delivered" }, e.currentTarget));
$("#resend").addEventListener("click", (e) => act({ action: "resend" }, e.currentTarget));
$("#saveNote").addEventListener("click", (e) => act({ action: "note", note: $("#note").value }, e.currentTarget));
$("#refund").addEventListener("click", (e) => {
  const o = current.order;
  if (!confirm(`Refund ${money(o.amount || 0)} to the customer's card and close their downloads? This can't be undone.`)) return;
  act({ action: "refund", confirm: o.id }, e.currentTarget);
});

function err(e) { if (e.message !== "signed out") flash(e.message, true); }

async function start() {
  if (!token) return show("login");
  try {
    await modeBanner();
    await loadOrders();
  } catch (e) { err(e); }
}
start();
