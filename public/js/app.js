// Legacy Portrait: create flow (photos, story, style, draft, approve).
import { getConfig, initSite } from "./site.js";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const STEPS = [["photos", "1 Photos"], ["story", "2 Story"], ["style", "3 Style"], ["draft", "4 Draft"]];
const SIZES_IN = { "8x10": 8, "11x14": 11, "16x20": 16 };       // print width in inches
const MAX_SIDE = 3000;                                          // resize long side to this (enough for 300 DPI at 16x20 slots)

const state = { id: null, answers: { detail: {}, folio: {}, length: "standard", tone: "classic", firstPerson: true, printSize: "11x14" }, photos: [], edited: null, generated: null, step: "photos", status: "draft", regenLeft: 5, supportedLength: "standard" };

// ---------- helpers ----------
function banner(msg, kind = "info") { const b = $("#banner"); if (!msg) { b.hidden = true; return; } b.textContent = msg; b.className = "banner" + (kind === "error" ? " error" : ""); b.hidden = false; }
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...(opts.body && !(opts.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
  return data;
}
// ---------- site config (brand, Turnstile) ----------
let config = { brand: {}, turnstileSiteKey: "" };
async function loadConfig() {
  try { config = await getConfig(); initSite(); } catch { /* defaults: no Turnstile, static brand text */ }
  config.brand = config.brand || {};
  if (config.brand.product) { $(".topbar .brand").textContent = config.brand.product; document.title = `Create a portrait · ${config.brand.product}`; }
}

// Cloudflare Turnstile guards draft creation. Tokens are single use, so each new draft waits for a fresh one.
let tsWidget = null, tsToken = null;
const tsWaiters = [];
function loadScript(src) {
  return new Promise((resolve, reject) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("load failed: " + src)); document.head.appendChild(s); });
}
async function startTurnstile() {
  if (!config.turnstileSiteKey || tsWidget !== null) return;
  try { await loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"); } catch { return; }
  $("#turnstile").hidden = false;
  tsWidget = window.turnstile.render("#turnstile", {
    sitekey: config.turnstileSiteKey, size: "flexible",
    callback: (t) => { const w = tsWaiters.shift(); if (w) w(t); else tsToken = t; },
    "expired-callback": () => { tsToken = null; window.turnstile.reset(tsWidget); },
    "error-callback": () => { banner("We couldn't confirm you're a person. Please reload the page and try again.", "error"); },
  });
}
function turnstileToken() {
  if (!config.turnstileSiteKey) return Promise.resolve("");
  if (tsToken) { const t = tsToken; tsToken = null; return Promise.resolve(t); }
  setSaved("Waiting for the check below…");
  return new Promise((resolve) => tsWaiters.push(resolve));
}

const debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(t); return d; };
function setSaved(s) { $("#saveState").textContent = s; }

// ---------- draft creation / resume ----------
let creating = null; // one create request at a time (a photo drop and typing can both trigger it)
function ensureDraft() {
  if (state.id) return Promise.resolve(state.id);
  if (!creating) creating = createDraft().finally(() => { creating = null; });
  return creating;
}
async function createDraft() {
  const utm = {};
  new URLSearchParams(location.search).forEach((v, k) => { if (k.startsWith("utm_")) utm[k] = v; });
  const turnstile = await turnstileToken();
  if (tsWidget !== null) window.turnstile.reset(tsWidget); // tokens are single use: start the next one now, in case this request fails
  const { id } = await api("/api/portraits", { method: "POST", body: JSON.stringify({ utm, turnstile }) });
  $("#turnstile").hidden = true;
  state.id = id;
  const u = new URL(location.href); u.searchParams.set("id", id); history.replaceState(null, "", u);
  return id;
}

async function loadDraft(id) {
  const d = await api(`/api/portraits/${id}`);
  state.id = d.id; state.status = d.status; state.canEdit = d.canEdit !== false; state.hasEmail = !!d.hasEmail;
  state.answers = { detail: {}, folio: {}, length: "standard", tone: "classic", firstPerson: true, printSize: "11x14", ...d.answers };
  state.answers.detail = d.answers.detail || {}; state.answers.folio = d.answers.folio || {};
  state.photos = d.photos; state.edited = d.edited; state.generated = d.generated; state.regenLeft = d.regenLeft; state.supportedLength = d.supportedLength;
}

// ---------- autosave ----------
const saveAnswers = debounce(async () => {
  if (!state.id) return;
  try { setSaved("Saving…"); await api(`/api/portraits/${state.id}`, { method: "PUT", body: JSON.stringify({ answers: state.answers }) }); setSaved("Saved"); } catch (e) { setSaved("Not saved"); banner(e.message, "error"); }
}, 700);
// Save right now (used before writing a draft so a fast click never races the debounced autosave).
async function saveAnswersNow() {
  saveAnswers.cancel(); // a pending autosave firing later could overwrite answers the interview just filled in
  await ensureDraft();
  await api(`/api/portraits/${state.id}`, { method: "PUT", body: JSON.stringify({ answers: state.answers }) });
}
const saveEdited = debounce(async () => {
  if (!state.id || !state.edited) return;
  try { setSaved("Saving…"); await api(`/api/portraits/${state.id}`, { method: "PUT", body: JSON.stringify({ edited: state.edited }) }); setSaved("Saved"); refreshPreview(); } catch (e) { setSaved("Not saved"); banner(e.message, "error"); }
}, 900);

async function onAnswerChange() { await ensureDraft(); saveAnswers(); updateLengthHint(); }

// ---------- steps ----------
function renderSteps() {
  const nav = $("#steps"); nav.innerHTML = "";
  for (const [key, label] of STEPS) {
    const b = document.createElement("button"); b.textContent = label; b.type = "button";
    if (key === state.step) b.setAttribute("aria-current", "step");
    b.onclick = () => go(key);
    nav.appendChild(b);
  }
}
function go(step) {
  if (step === "draft" && !validateStory()) return;
  state.step = step;
  $$("section.panel").forEach((s) => (s.hidden = s.dataset.step !== step));
  renderSteps(); banner(""); window.scrollTo({ top: 0 });
  if (step === "draft") enterDraft();
  if (step === "story") startChat();
  const u = new URL(location.href); u.hash = step; history.replaceState(null, "", u);
}
function validateStory() {
  const a = state.answers, missing = [];
  if (!a.name) missing.push("their name"); if (!a.relationship) missing.push("your relationship to them"); if (!a.byline) missing.push("the byline name");
  if (missing.length) { state.step = "story"; $$("section.panel").forEach((s) => (s.hidden = s.dataset.step !== "story")); renderSteps(); banner("Please add " + missing.join(", ") + " first.", "error"); return false; }
  if (!state.photos.length) { go("photos"); banner("Please add at least one photo first.", "error"); return false; }
  if (!a.rights) { go("photos"); banner("Please confirm you have the right to use these photos.", "error"); return false; }
  return true;
}

// ---------- photos ----------
function slotInches(index, sizeKey) {
  const W = SIZES_IN[sizeKey] || 11;
  // main photo ~45% of page width and ~49% of height; extra photos ~28% x 20%
  return index === 0 ? { w: W * 0.45, h: W * 0.5 } : { w: W * 0.28, h: W * 0.2 };
}
function quality(photo, index) {
  const s = slotInches(index, state.answers.printSize);
  const dpi = Math.floor(Math.min(photo.width / s.w, photo.height / s.h));
  if (dpi >= 200) return { cls: "q-good", text: `Sharp at this size (about ${dpi} dpi).` };
  if (dpi >= 120) return { cls: "q-warn", text: `May look a little soft at this size (about ${dpi} dpi). A smaller print will look better.` };
  return { cls: "q-bad", text: `Too small for this print size (about ${dpi} dpi). Try a smaller print, or the digital portrait, or a larger scan.` };
}
function renderPhotos() {
  const ul = $("#photoList"); ul.innerHTML = "";
  state.photos.forEach((p, i) => {
    const li = document.createElement("li");
    const img = document.createElement("img"); img.alt = ""; img.src = `/api/portraits/${state.id}/photos/${i}?v=${p.v || 0}`;
    const meta = document.createElement("div"); meta.className = "meta";
    const b = document.createElement("b"); b.textContent = i === 0 ? "Main photo" : `Photo ${i + 1}`;
    const n = document.createElement("span"); n.textContent = `${p.width} × ${p.height} px`; n.className = "muted";
    const q = quality(p, i); const qd = document.createElement("div"); qd.className = "quality " + q.cls; qd.textContent = q.text;
    meta.append(b, n, qd);
    const rm = document.createElement("button"); rm.className = "btn small"; rm.textContent = "Remove"; rm.type = "button"; rm.onclick = () => removePhoto(i);
    li.append(img, meta, rm); ul.appendChild(li);
  });
  $("#drop").hidden = state.photos.length >= 3;
}

async function toJpegBlob(file) {
  let blob = file;
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    setSaved("Converting your iPhone photo…");
    if (!window.heic2any) await loadScript("/vendor/heic2any/heic2any.min.js").catch(() => null); // self-hosted, loaded only when needed
    const heic2any = window.heic2any;
    if (!heic2any) throw new Error("We couldn't read that iPhone photo. Please export it as JPG and try again.");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    blob = Array.isArray(out) ? out[0] : out;
  }
  const bmp = await createImageBitmap(blob).catch(() => null);
  if (!bmp) throw new Error("That file didn't work. Please try a JPG, PNG or iPhone photo under 8 MB.");
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
  const out = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
  // report the ORIGINAL pixel size for the quality check (resizing only ever shrinks very large files)
  return { blob: out, width: bmp.width, height: bmp.height, sentW: w, sentH: h };
}

async function addFiles(files) {
  const list = Array.from(files).slice(0, 3 - state.photos.length);
  if (!list.length) return;
  try {
    await ensureDraft(); banner("");
    for (const f of list) {
      setSaved("Uploading…");
      const r = await toJpegBlob(f);
      const fd = new FormData(); fd.append("file", r.blob, "photo.jpg"); fd.append("width", r.width); fd.append("height", r.height); fd.append("name", f.name);
      const idx = state.photos.length;
      await api(`/api/portraits/${state.id}/photos/${idx}`, { method: "POST", body: fd });
      state.photos.push({ name: f.name, width: r.width, height: r.height, v: Date.now() });
      renderPhotos();
    }
    setSaved("Saved");
  } catch (e) { setSaved(""); banner(e.message, "error"); }
}
async function removePhoto(i) {
  try { await api(`/api/portraits/${state.id}/photos/${i}`, { method: "DELETE" }); state.photos.splice(i, 1); state.photos.forEach((p) => (p.v = Date.now())); renderPhotos(); } catch (e) { banner(e.message, "error"); }
}

// ---------- story bindings ----------
function bindInputs() {
  $$("[data-a]").forEach((el) => {
    const k = el.dataset.a;
    const read = () => (el.type === "checkbox" ? el.checked : el.type === "radio" ? (el.checked ? el.value : undefined) : el.value);
    el.addEventListener("input", () => { const v = read(); if (v !== undefined) state.answers[k] = v; onAnswerChange(); });
    el.addEventListener("change", () => { const v = read(); if (v !== undefined) state.answers[k] = v; onAnswerChange(); });
  });
  $$("[data-d]").forEach((el) => el.addEventListener("input", () => { state.answers.detail[el.dataset.d] = el.value; onAnswerChange(); }));
  $$("[data-f]").forEach((el) => el.addEventListener("input", () => { state.answers.folio[el.dataset.f] = el.value; onAnswerChange(); }));
  $("#rights").addEventListener("change", (e) => { state.answers.rights = e.target.checked; onAnswerChange(); });
  $("#printSize").addEventListener("change", (e) => { state.answers.printSize = e.target.value; renderPhotos(); onAnswerChange(); });
}
function fillInputs() {
  $$("[data-a]").forEach((el) => {
    const v = state.answers[el.dataset.a];
    if (el.type === "checkbox") el.checked = v !== false && v !== undefined ? !!v : el.dataset.a === "firstPerson";
    else if (el.type === "radio") el.checked = el.value === v;
    else if (v !== undefined) el.value = v;
  });
  $$("[data-d]").forEach((el) => (el.value = state.answers.detail[el.dataset.d] || ""));
  $$("[data-f]").forEach((el) => (el.value = state.answers.folio[el.dataset.f] || ""));
  $("#rights").checked = !!state.answers.rights;
  $("#printSize").value = state.answers.printSize || "11x14";
  if ($$("details.more textarea").some((t) => t.value)) $("details.more").open = true;
  updateLengthHint();
}
function updateLengthHint() {
  const chosen = state.answers.length || "standard";
  const words = ["origins", "work", "family", "story", "born", "died"].reduce((n, k) => n + (String(state.answers[k] || "").trim().split(/\s+/).filter(Boolean).length), 0)
    + Object.values(state.answers.detail || {}).reduce((n, v) => n + String(v || "").trim().split(/\s+/).filter(Boolean).length, 0);
  const supported = words < 60 ? "brief" : words < 160 ? "standard" : "full";
  const order = ["brief", "standard", "full"];
  $("#lengthHint").textContent = order.indexOf(chosen) > order.indexOf(supported)
    ? `So far your answers support a ${supported[0].toUpperCase() + supported.slice(1)} portrait. A longer one would need padding, so we'd write it shorter. Add more detail to grow it.` : "";
}

// ---------- draft ----------
const pvFrame = $("#pvFrame");
function fitPreview() { const w = $("#pv").clientWidth; pvFrame.style.transform = `scale(${w / 1056})`; }
const refreshPreview = () => { if (!state.id) return; pvFrame.src = `/template/index.html?portrait=${state.id}&t=${Date.now()}`; fitPreview(); };
window.addEventListener("resize", fitPreview);

async function enterDraft() {
  $("#bylineName").textContent = state.answers.byline || "";
  $("#approved").hidden = state.status !== "approved";
  $("#toPreview").href = `/preview?id=${state.id}`;
  if (state.edited) { renderEditor(); refreshPreview(); return; }
  await writeDraft("");
}
async function writeDraft(notes) {
  const status = $("#draftStatus"); status.textContent = "Writing your draft…"; $("#regen").disabled = true;
  try {
    await saveAnswersNow();
    const r = await api(`/api/portraits/${state.id}/draft`, { method: "POST", body: JSON.stringify({ notes }) });
    state.edited = r.edited; state.generated = r.generated; state.regenLeft = r.regenLeft; state.supportedLength = r.supportedLength; state.status = "draft";
    $("#notes").value = "";
    renderEditor(); refreshPreview();
  } catch (e) { status.textContent = ""; banner(e.message, "error"); } finally { $("#regen").disabled = false; }
}
function renderEditor() {
  const g = state.generated || {}, e = state.edited || { subheadline: "", body_paragraphs: [], captions: [] };
  const st = $("#draftStatus"); st.innerHTML = "";
  if (g.mode === "sample") { const s = document.createElement("span"); s.className = "sample"; s.textContent = "Sample draft"; st.append(s, document.createTextNode("No AI writer is connected yet, so this draft just rearranges your own words. Once it's connected, it will be written properly.")); }
  else st.textContent = "Here is your draft. Everything below can be edited.";

  // claims the fact check could not find in the customer's answers: ask them to look before approving
  const checks = $("#checks"), un = g.unsupported || [];
  checks.hidden = !un.length;
  if (un.length) {
    checks.innerHTML = "<b>Please check these before you approve</b><p class=\"muted\">We couldn't find them in your answers. Edit or remove them if they aren't right.</p>";
    const ul = document.createElement("ul");
    un.forEach((u) => { const li = document.createElement("li"); const q = document.createElement("q"); q.textContent = u.text; li.append(q, document.createTextNode(" " + (u.reason || ""))); ul.appendChild(li); });
    checks.appendChild(ul);
  }

  const gaps = $("#gaps"); gaps.hidden = !(g.gaps && g.gaps.length);
  if (!gaps.hidden) { gaps.innerHTML = "<b>To make it stronger</b>"; const ul = document.createElement("ul"); g.gaps.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); gaps.appendChild(ul); }

  const subs = $("#subOptions"); subs.innerHTML = "";
  (g.subheadline_options || []).forEach((t) => {
    const l = document.createElement("label"); const r = document.createElement("input"); r.type = "radio"; r.name = "sub"; r.checked = t === e.subheadline;
    r.onchange = () => { e.subheadline = t; $("#subInput").value = t; touched(); };
    const sp = document.createElement("span"); sp.textContent = t; l.append(r, sp); subs.appendChild(l);
  });
  const si = $("#subInput"); si.value = e.subheadline; si.oninput = () => { e.subheadline = si.value; $$("input[name=sub]").forEach((r) => (r.checked = false)); touched(); };

  const box = $("#paras"); box.innerHTML = "";
  e.body_paragraphs.forEach((p, i) => {
    const row = document.createElement("div"); row.className = "para";
    const ta = document.createElement("textarea"); ta.value = p; ta.setAttribute("aria-label", `Paragraph ${i + 1}`);
    ta.oninput = () => { e.body_paragraphs[i] = ta.value; touched(); };
    const rm = document.createElement("button"); rm.className = "btn small"; rm.type = "button"; rm.textContent = "Remove";
    rm.onclick = () => { e.body_paragraphs.splice(i, 1); renderEditor(); touched(); };
    row.append(ta, rm); box.appendChild(row);
  });
  $("#addPara").onclick = () => { e.body_paragraphs.push(""); renderEditor(); };

  const extra = Math.max(0, state.photos.length - 1);
  $("#captionsBox").hidden = extra === 0; const cb = $("#captions"); cb.innerHTML = "";
  for (let i = 0; i < extra; i++) {
    const inp = document.createElement("input"); inp.maxLength = 160; inp.placeholder = `Caption for photo ${i + 2} (optional)`; inp.value = (e.captions || [])[i] || "";
    inp.oninput = () => { e.captions = e.captions || []; e.captions[i] = inp.value; touched(); }; cb.appendChild(inp);
  }
  $("#regenLeft").textContent = `${state.regenLeft} rewrite${state.regenLeft === 1 ? "" : "s"} left`;
  $("#regen").disabled = state.regenLeft <= 0;
  $("#approve").disabled = !$("#approveBox").checked;
}
function touched() {
  if (state.status === "approved") { state.status = "draft"; $("#approved").hidden = true; }
  $("#approveBox").checked = false; $("#approve").disabled = true;
  saveEdited();
}

// ---------- guided interview (chat that fills the story form) ----------
const FIRST_QUESTION = "Who is this portrait about, and what's your relationship to them?";
const chat = { on: false, loaded: false, busy: false, question: FIRST_QUESTION };
function chatBubble(text, cls) { const li = document.createElement("li"); li.className = cls; li.textContent = text; $("#chatLog").appendChild(li); li.scrollIntoView({ block: "nearest" }); return li; }
function renderChat(transcript, question) {
  $("#chatLog").innerHTML = "";
  for (const t of transcript) { chatBubble(t.q, "q"); chatBubble(t.a || "(skipped)", "a"); }
  chat.question = question; if (question) chatBubble(question, "q");
}
async function startChat() {
  if (!chat.on || chat.loaded) return;
  chat.loaded = true;
  $("#chat").hidden = false;
  setFormOpen(false);
  const name = (state.answers.name || "").split(/\s+/)[0];
  $("#chatIntro").textContent = `Hi, I'm your ${config.brand.company || "family newspaper"} editor. I'll ask a few questions about ${name || "them"}. Answer in your own words, short is fine.`;
  renderFacts();
  if (!state.id) { renderChat([], FIRST_QUESTION); return; }
  try {
    const r = await api(`/api/portraits/${state.id}/interview`);
    renderChat(r.transcript, r.question); // picks up exactly where the customer stopped
    maybeOfferSave(r.transcript.length);
    if (r.done) $("#chatEnough").classList.add("primary");
  } catch (e) {
    // don't guess the question: the server answers against the saved conversation, so a wrong one would misfile the answer
    renderChat([], "");
    $$(".chat-actions button").forEach((b) => (b.disabled = true));
    banner("We couldn't load your conversation. Please reload the page; everything you've told us is saved.", "error");
  }
}
// After a couple of answers, offer to email a private link so the customer can finish later (once).
function maybeOfferSave(answered) {
  if (state.hasEmail || chat.saveDismissed || answered < 2) return;
  $("#saveBox").hidden = false;
}
// The form is the same data as the chat; in chat mode it stays folded away behind "Review or edit your answers".
function setFormOpen(open) {
  $("#storyForm").hidden = !open;
  $("#toggleForm").setAttribute("aria-expanded", String(open));
  $("#toggleForm").textContent = open ? "Hide the answer form" : "Review or edit your answers";
}
const FACT_LABELS = [["name", "Name"], ["relationship", "You are their"], ["born", "Born"], ["died", "Died"], ["origins", "Origins"], ["work", "Work"], ["family", "Family"], ["story", "A family story"], ["character", "In three words"], ["legacy", "What the family carries"], ["byline", "Byline"]];
function renderFacts() {
  const dl = $("#factList"); dl.innerHTML = "";
  for (const [k, label] of FACT_LABELS) {
    const v = String((k === "character" || k === "legacy" ? (state.answers.detail || {})[k] : state.answers[k]) || "").trim();
    if (!v) continue;
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = v.length > 160 ? v.slice(0, 157) + "…" : v;
    dl.append(dt, dd);
  }
  $("#cardEmpty").hidden = dl.children.length > 0;
}
async function sendChat(message) {
  if (chat.busy) return;
  chat.busy = true;
  const box = $("#chatInput"); const buttons = $$(".chat-actions button");
  buttons.forEach((b) => (b.disabled = true));
  if (message) chatBubble(message, "a"); else chatBubble("(skipped)", "a");
  const typing = chatBubble("…", "q typing");
  try {
    await saveAnswersNow(); // so edits typed into the form are part of the fact card the editor sees
    const r = await api(`/api/portraits/${state.id}/interview`, { method: "POST", body: JSON.stringify({ message }) });
    typing.remove(); box.value = "";
    const keep = { printSize: state.answers.printSize };
    state.answers = { detail: {}, folio: {}, ...r.answers, ...keep };
    state.answers.detail = r.answers.detail || {}; state.answers.folio = r.answers.folio || {};
    fillInputs(); renderFacts(); setSaved("Saved");
    for (const k of r.changed || []) {
      const el = $(`[data-a="${k}"]`) || $(`[data-d="${k}"]`);
      if (!el) continue;
      if (el.closest("details")) el.closest("details").open = true;
      el.classList.add("filled"); setTimeout(() => el.classList.remove("filled"), 2500);
    }
    chat.question = r.question; chatBubble(r.question, "q");
    maybeOfferSave(r.transcript.length);
    if (r.done) $("#chatEnough").classList.add("primary");
    if (state.answers.name) $("#chatIntro").textContent = $("#chatIntro").textContent.replace(/about them\./, `about ${state.answers.name.split(/\s+/)[0]}.`);
  } catch (e) {
    typing.remove(); banner(e.message, "error");
  } finally {
    chat.busy = false; buttons.forEach((b) => (b.disabled = false)); box.focus();
  }
}
function bindChat() {
  // ensureDraft can fail (network, Turnstile): show why instead of failing silently
  const ready = async () => { try { await ensureDraft(); return true; } catch (e) { banner(e.message, "error"); return false; } };
  $("#chatSend").onclick = async () => { const m = $("#chatInput").value.trim(); if (!m) return; if (await ready()) sendChat(m); };
  $("#chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatSend").click(); } });
  $("#chatSkip").onclick = async () => { if (await ready()) sendChat(""); };
  $("#chatIdk").onclick = async () => { if (await ready()) sendChat("I don't know."); };
  $("#chatEnough").onclick = () => {
    const need = [["name", "their full name"], ["relationship", "your relationship to them"], ["byline", "how your name should appear in the byline"]].filter(([k]) => !String(state.answers[k] || "").trim()).map(([, t]) => t);
    if (need.length) { chatBubble(`Before I can write it, I still need ${need.join(", ")}.`, "q"); $("#chatInput").focus(); return; }
    go("style");
  };
  $("#toggleForm").onclick = () => setFormOpen($("#storyForm").hidden);
  $("#saveLater").onclick = () => { $("#saveBox").hidden = true; chat.saveDismissed = true; };
  $("#saveBox").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#saveBox button[type=submit]"); btn.disabled = true;
    try {
      const r = await api(`/api/portraits/${state.id}/email`, { method: "POST", body: JSON.stringify({ email: $("#saveEmail").value, marketing: $("#saveMarketing").checked }) });
      state.hasEmail = true; $("#saveBox").hidden = true;
      const done = $("#saveDone"); done.hidden = false;
      if (r.emailed) done.textContent = `Saved. We've emailed your private link to ${$("#saveEmail").value}.`;
      else { done.textContent = "Saved. Keep this private link to finish on any device: "; const a = document.createElement("a"); a.href = r.link; a.textContent = "your draft"; done.appendChild(a); }
    } catch (err) { banner(err.message, "error"); } finally { btn.disabled = false; }
  };
  $$("#storyForm [data-a], #storyForm [data-d]").forEach((el) => el.addEventListener("input", renderFacts));
}

// ---------- init ----------
async function init() {
  bindInputs(); renderSteps();
  $("#drop").addEventListener("click", () => $("#file").click());
  $("#drop").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#file").click(); } });
  $("#file").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  ["dragenter", "dragover"].forEach((t) => $("#drop").addEventListener(t, (e) => { e.preventDefault(); $("#drop").classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => $("#drop").addEventListener(t, (e) => { e.preventDefault(); $("#drop").classList.remove("over"); }));
  $("#drop").addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  $$("[data-next]").forEach((b) => (b.onclick = () => { const i = STEPS.findIndex((s) => s[0] === state.step); go(STEPS[Math.min(i + 1, STEPS.length - 1)][0]); }));
  $$("[data-prev]").forEach((b) => (b.onclick = () => { const i = STEPS.findIndex((s) => s[0] === state.step); go(STEPS[Math.max(i - 1, 0)][0]); }));

  $("#regen").onclick = () => writeDraft($("#notes").value.trim());
  $("#approveBox").onchange = (e) => ($("#approve").disabled = !e.target.checked);
  $("#approve").onclick = async () => {
    try {
      await saveEditedNow();
      await api(`/api/portraits/${state.id}/approve`, { method: "POST", body: JSON.stringify({ confirm: true }) });
      state.status = "approved"; $("#approved").hidden = false; banner("");
      $("#toPreview").href = `/preview?id=${state.id}`;
      location.href = `/preview?id=${state.id}`; // the watermarked portrait and the way to unlock it
    } catch (e) { banner(e.message, "error"); }
  };

  await loadConfig();
  const qs = new URLSearchParams(location.search);
  const id = qs.get("id");
  if (id && qs.get("t")) {
    // private link from another device: trade the token for this device's edit cookie, then drop it from the address bar
    try { await api(`/api/portraits/${id}/claim`, { method: "POST", body: JSON.stringify({ token: qs.get("t") }) }); } catch (e) { banner(e.message, "error"); }
    const u = new URL(location.href); u.searchParams.delete("t"); history.replaceState(null, "", u);
  }
  chat.on = !!config.interview || qs.get("interview") === "1";
  if (chat.on) bindChat();
  if (!id) startTurnstile();
  if (id) { try { await loadDraft(id); fillInputs(); renderPhotos(); setSaved("Saved"); if (!state.canEdit) banner("This draft can only be changed on the device where it was started. You can read it here."); const h = location.hash.slice(1); go(STEPS.some((s) => s[0] === h) ? h : state.edited ? "draft" : "photos"); return; } catch (e) { banner("We couldn't find that draft. You can start a new one below."); } }
  fillInputs(); renderPhotos();
}
async function saveEditedNow() {
  if (!state.edited) return;
  await api(`/api/portraits/${state.id}`, { method: "PUT", body: JSON.stringify({ edited: state.edited }) });
}
init();
