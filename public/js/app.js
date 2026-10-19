// Legacy Portrait: create flow (photos, story, style, draft, approve).
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
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
function setSaved(s) { $("#saveState").textContent = s; }

// ---------- draft creation / resume ----------
async function ensureDraft() {
  if (state.id) return state.id;
  const utm = {};
  new URLSearchParams(location.search).forEach((v, k) => { if (k.startsWith("utm_")) utm[k] = v; });
  const { id } = await api("/api/portraits", { method: "POST", body: JSON.stringify({ utm }) });
  state.id = id;
  const u = new URL(location.href); u.searchParams.set("id", id); history.replaceState(null, "", u);
  return id;
}

async function loadDraft(id) {
  const d = await api(`/api/portraits/${id}`);
  state.id = d.id; state.status = d.status;
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
    const mod = await import("https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js").catch(() => null);
    const heic2any = (mod && (mod.default || window.heic2any)) || window.heic2any;
    if (!heic2any) throw new Error("We couldn't read that iPhone photo. Please export it as JPG and try again.");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    blob = Array.isArray(out) ? out[0] : out;
  }
  const bmp = await createImageBitmap(blob).catch(() => null);
  if (!bmp) throw new Error("We couldn't open that image.");
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
    } catch (e) { banner(e.message, "error"); }
  };

  const id = new URLSearchParams(location.search).get("id");
  if (id) { try { await loadDraft(id); fillInputs(); renderPhotos(); setSaved("Saved"); const h = location.hash.slice(1); go(STEPS.some((s) => s[0] === h) ? h : state.edited ? "draft" : "photos"); return; } catch (e) { banner("We couldn't find that draft. You can start a new one below."); } }
  fillInputs(); renderPhotos();
}
async function saveEditedNow() {
  if (!state.edited) return;
  await api(`/api/portraits/${state.id}`, { method: "PUT", body: JSON.stringify({ edited: state.edited }) });
}
init();
