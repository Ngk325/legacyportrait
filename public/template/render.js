/* Legacy Portrait template renderer.
   Input: JSON (window.__PORTRAIT__ if injected by the render script, else ?data=<url>).
   Steps: fill header fields, halftone the photos, flow the body text across three columns
   around the anchored photo, auto-fit the body size, and publish window.__FIT__ for the caller.

   JSON shape:
   {
     "nameplate": "The Family Gazette", "vol": "VOL. I · NO. 1", "tagline": "A Life Remembered", "date": "Sunday, December 25",
     "headline": "A Life Well Built", "subhead": "...", "byline": "By Maria Haddad, granddaughter",
     "photo": { "src": "assets/x.jpg", "focus": [0.5, 0.35] },
     "extraPhotos": [ { "src": "...", "caption": "...", "afterParagraph": 2 } ],
     "body": ["paragraph", ...], "closing": "— 30 —", "footer": "...",
     "options": { "halftone": true, "bodyMinPt": 8.5, "bodyMaxPt": 12 }
   }
*/
(async function () {
  const PX_PER_PT = 96 / 72;
  const $ = (id) => document.getElementById(id);

  async function loadData() {
    if (window.__PORTRAIT__) return window.__PORTRAIT__;
    const q = new URLSearchParams(location.search);
    if (q.get("portrait")) return (await fetch(`/api/portraits/${q.get("portrait")}/render`)).json();
    const url = q.get("data") || "../../data/elias-haddad.json";
    return (await fetch(url)).json();
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("image failed: " + src));
      im.src = src;
    });
  }

  /* Halftone: grayscale, lifted contrast, 45 degree dot screen.
     Canvas is drawn at devicePixelRatio so dots stay sharp in the 300 DPI render. */
  function halftone(img, w, h, focus, opts) {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // cover-crop around the focus point
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const sw = cw / s, sh = ch / s;
    const fx = focus ? focus[0] : 0.5, fy = focus ? focus[1] : 0.4;
    const sx = Math.min(Math.max(img.naturalWidth * fx - sw / 2, 0), img.naturalWidth - sw);
    const sy = Math.min(Math.max(img.naturalHeight * fy - sh / 2, 0), img.naturalHeight - sh);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

    const data = ctx.getImageData(0, 0, cw, ch).data;
    const lum = new Float32Array(cw * ch);
    let lo = 255, hi = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      lum[p] = l; if (l < lo) lo = l; if (l > hi) hi = l;
    }
    // stretch to full range, then lift mid-tones slightly
    const range = Math.max(hi - lo, 1);
    for (let p = 0; p < lum.length; p++) {
      let v = (lum[p] - lo) / range;
      v = Math.pow(v, 0.85);
      lum[p] = Math.min(1, Math.max(0, v));
    }

    if (opts && opts.halftone === false) {
      const out = ctx.createImageData(cw, ch);
      for (let p = 0, i = 0; p < lum.length; p++, i += 4) {
        const g = Math.round(lum[p] * 255);
        out.data[i] = out.data[i + 1] = out.data[i + 2] = g; out.data[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      return canvas;
    }

    const pitch = 3.0 * dpr;                // dot spacing in device px (about 32 lines per inch printed)
    const ang = Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#141414";
    const diag = Math.hypot(cw, ch);
    const n = Math.ceil(diag / pitch);
    for (let gy = -n; gy <= n; gy++) {
      for (let gx = -n; gx <= n; gx++) {
        const ux = gx * pitch, uy = gy * pitch;
        const x = cw / 2 + ux * ca - uy * sa;
        const y = ch / 2 + ux * sa + uy * ca;
        if (x < -pitch || y < -pitch || x > cw + pitch || y > ch + pitch) continue;
        const px = Math.min(cw - 1, Math.max(0, Math.round(x)));
        const py = Math.min(ch - 1, Math.max(0, Math.round(y)));
        // average a small neighbourhood for a stable tone
        let sum = 0, cnt = 0;
        const r = Math.max(1, Math.round(pitch / 2));
        for (let oy = -r; oy <= r; oy += r) for (let ox = -r; ox <= r; ox += r) {
          const qx = Math.min(cw - 1, Math.max(0, px + ox)), qy = Math.min(ch - 1, Math.max(0, py + oy));
          sum += lum[qy * cw + qx]; cnt++;
        }
        const tone = sum / cnt;            // 0 black .. 1 white
        const dark = 1 - tone;
        if (dark < 0.04) continue;
        const rad = Math.sqrt(dark) * pitch * 0.72;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    return canvas;
  }

  const data = await loadData();
  if (window.__PAGE__) {
    document.documentElement.style.setProperty('--page-w', window.__PAGE__.w + 'px');
    document.documentElement.style.setProperty('--page-h', window.__PAGE__.h + 'px');
  }
  const opts = data.options || {};

  // header
  $("nameplate").textContent = data.nameplate || "";
  $("vol").textContent = data.vol || "";
  $("tagline").textContent = data.tagline || "";
  $("date").textContent = data.date || "";
  $("headline").textContent = data.headline || "";
  $("subhead").textContent = data.subhead || "";
  $("byline").textContent = data.byline || "";
  $("footer").textContent = data.footer || "";

  await document.fonts.ready;
  await Promise.all(["400 14px 'Old Standard TT'", "italic 400 14px 'Old Standard TT'", "700 14px 'Old Standard TT'", "900 20px 'Playfair Display'", "700 20px 'UnifrakturCook'"].map((f) => document.fonts.load(f)));

  // headline auto-shrink so a long name never wraps past two lines
  const hl = $("headline");
  let hs = parseFloat(getComputedStyle(hl).fontSize);
  while (hl.scrollHeight > hs * 2.15 && hs > 40) { hs -= 2; hl.style.fontSize = hs + "px"; }

  const body = $("body"), cols = [$("col1"), $("col2"), $("col3")];
  const bodyW = body.clientWidth, bodyH = body.clientHeight;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap")) || 22;
  const colW = (bodyW - 2 * gap) / 3;

  // main photo: column 3 plus half of column 2, down to ~58% of body height
  const photoShare = opts.photoCol2Share ?? 0.4;
  const photoW = colW + gap + colW * photoShare;
  // photo bottom edge lands at about 60% of the page height (opts.photoBottomRatio)
  const pageEl = $("page");
  const bodyTop = body.getBoundingClientRect().top - pageEl.getBoundingClientRect().top;
  const photoH = Math.round(Math.min(bodyH * 0.7, Math.max(240, pageEl.clientHeight * (opts.photoBottomRatio || 0.6) - bodyTop)));
  const mp = $("mainPhoto");
  mp.style.width = photoW + "px"; mp.style.height = photoH + "px";
  if (data.photo && data.photo.src) {
    const img = await loadImage(data.photo.src);
    mp.appendChild(halftone(img, photoW, photoH, data.photo.focus, opts));
  }

  // extra photo canvases (prepared once, cloned per fit pass)
  const extras = [];
  for (const ep of (data.extraPhotos || []).slice(0, 2)) {
    const img = await loadImage(ep.src);
    extras.push({ ep, img });
  }

  function buildExtraNode(item) {
    const fig = document.createElement("figure"); fig.className = "extra";
    const frame = document.createElement("div"); frame.className = "frame";
    const w = colW - 2, h = Math.round(w * 0.72);
    frame.style.height = h + "px";
    frame.appendChild(halftone(item.img, w, h, item.ep.focus, opts));
    fig.appendChild(frame);
    if (item.ep.caption) { const c = document.createElement("figcaption"); c.textContent = item.ep.caption; fig.appendChild(c); }
    return fig;
  }

  // build the flow queue
  function buildQueue() {
    const q = [];
    const paras = data.body || [];
    paras.forEach((t, i) => {
      const text = window.LPHyphenate ? window.LPHyphenate(t.trim()) : t.trim();
      q.push({ type: "p", words: text.split(/\s+/), first: i === 0 });
      extras.forEach((ex) => { if ((ex.ep.afterParagraph ?? 2) === i + 1) q.push({ type: "fig", item: ex }); });
    });
    if (data.closing) q.push({ type: "end", text: data.closing });
    return q;
  }

  const over = (el) => el.scrollHeight > el.clientHeight + 0.5;

  function flow(sizePx) {
    document.documentElement.style.setProperty("--body-size", sizePx + "px");
    cols.forEach((c) => { c.innerHTML = ""; });
    // spacers under the photo
    const sp2 = document.createElement("div"); sp2.className = "spacer right-half";
    sp2.style.width = (colW * photoShare + gap * 0.5) + "px"; sp2.style.height = (photoH + 12) + "px";
    cols[1].appendChild(sp2);
    const sp3 = document.createElement("div"); sp3.className = "spacer";
    sp3.style.height = (photoH + 12) + "px";
    cols[2].appendChild(sp3);

    const queue = buildQueue();
    for (let ci = 0; ci < 3 && queue.length; ci++) {
      const col = cols[ci];
      let carry = false;
      while (queue.length) {
        const it = queue[0];
        if (it.type === "p") {
          const p = document.createElement("p");
          if (it.first) p.className = "first"; else if (carry) p.className = "cont";
          col.appendChild(p);
          const words = it.words;
          p.textContent = words.join(" ");
          if (!over(col)) { queue.shift(); carry = false; continue; }
          // binary search for the largest word count that fits
          let lo = 0, hi = words.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            p.textContent = words.slice(0, mid).join(" ");
            if (over(col)) hi = mid - 1; else lo = mid;
          }
          if (lo < 3 && col.children.length > 1 + (ci > 0 ? 1 : 0)) { /* tiny sliver: push whole paragraph to next column */
            col.removeChild(p); break;
          }
          if (lo === 0) { col.removeChild(p); break; }
          p.textContent = words.slice(0, lo).join(" ");
          it.words = words.slice(lo); it.first = false; carry = true;
          break;                     // column full
        } else if (it.type === "fig") {
          const node = buildExtraNode(it.item);
          col.appendChild(node);
          if (over(col)) { col.removeChild(node); break; }
          queue.shift(); carry = false;
        } else if (it.type === "end") {
          const d = document.createElement("div"); d.className = "end-mark"; d.textContent = it.text;
          col.appendChild(d);
          if (over(col)) { col.removeChild(d); break; }
          queue.shift();
        }
      }
    }
    return queue.length === 0;
  }

  // auto-fit: largest body size that fits all text; report leftover if even the minimum fails
  const maxPx = (opts.bodyMaxPt || 13.5) * PX_PER_PT, minPx = (opts.bodyMinPt || 8.5) * PX_PER_PT;
  let size = maxPx, fitted = false;
  for (; size >= minPx - 0.01; size -= 0.25) {
    if (flow(size)) { fitted = true; break; }
  }
  if (!fitted) { size = minPx; flow(size); }

  // measure how full the last column is (0..1) so the caller can decide to ask for more or less text
  const last = cols[2];
  let usedBottom = 0;
  Array.from(last.children).forEach((c) => { if (!c.classList.contains("spacer")) usedBottom = Math.max(usedBottom, c.offsetTop + c.offsetHeight); });
  const fill = usedBottom / last.clientHeight;

  // preview watermark (unpaid portraits): a separate layer over the finished page, so it never changes the layout
  if (opts.watermark) {
    const t = String(opts.watermark).replace(/[<>&"']/g, "");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='240'><text x='180' y='130' font-family='Georgia, serif' font-size='44' font-weight='700' letter-spacing='8' fill='#141414' fill-opacity='0.16' text-anchor='middle' transform='rotate(-30 180 120)'>${t}</text></svg>`;
    const wm = document.createElement("div");
    wm.className = "watermark";
    wm.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    document.querySelector(".page").appendChild(wm);
  }

  window.__FIT__ = { ok: fitted, bodyPx: size, bodyPt: +(size / PX_PER_PT).toFixed(2), lastColumnFill: +fill.toFixed(2), photoW, photoH };
  document.body.setAttribute("data-ready", "1");
})();
