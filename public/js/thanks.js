// After Stripe Checkout: wait for the webhook to mark the order paid, then show the downloads.
import { $, initSite } from "./site.js";

const q = new URLSearchParams(location.search);
const id = q.get("id") || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LABEL = { "8x10": "8 × 10", "11x14": "11 × 14", "16x20": "16 × 20" };

function show(order) {
  $("#wait").hidden = true;
  const dl = $("#downloads"); dl.innerHTML = "";
  for (const size of ["11x14", "8x10", "16x20"]) {
    const a = document.createElement("a"); a.className = "btn" + (size === "11x14" ? " primary" : "");
    a.href = `/api/portraits/${id}/print?size=${size}&format=pdf`; a.textContent = `PDF ${LABEL[size]} (print-ready)`; dl.appendChild(a);
  }
  const img = document.createElement("a"); img.className = "btn"; img.href = `/api/portraits/${id}/print?size=11x14&format=png`; img.textContent = "Image (share)"; dl.appendChild(img);
  $("#digital").hidden = false;
  if (order.product !== "digital") {
    $("#what").textContent = order.product === "framed" ? "framed print" : "print";
    $("#physical").hidden = false;
  }
  $("#gift").hidden = !order.gift;
}

async function main() {
  await initSite();
  if (!/^[a-f0-9]{32}$/.test(id)) { $("#wait").textContent = "This link isn't complete."; return; }
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`/api/portraits/${id}/order`).then((x) => x.json()).catch(() => ({}));
    if (r.placed && r.placed.status === "paid") return show(r.placed);
    if (r.placed && r.placed.status === "refunded") { $("#wait").textContent = "This order was refunded."; return; }
    await sleep(i < 5 ? 1500 : 3000);
  }
  $("#wait").textContent = "Your payment is still being confirmed. We'll email you as soon as it's done; you can also refresh this page in a minute.";
}
main();
