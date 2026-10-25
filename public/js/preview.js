// Preview page: the approved portrait, watermarked, with the way forward (unlock, edit, share).
import { $, initSite } from "./site.js";

const id = new URLSearchParams(location.search).get("id") || "";
function banner(msg) { const b = $("#banner"); b.textContent = msg; b.className = "banner error"; b.hidden = !msg; }

async function main() {
  await initSite();
  if (!/^[a-f0-9]{32}$/.test(id)) { banner("This preview link isn't complete. Please open it from your draft."); return; }
  const r = await fetch(`/api/portraits/${id}`);
  if (!r.ok) { banner("This draft link has expired. Start a new portrait or contact us and we'll help."); return; }
  const p = await r.json();
  $("#editText").href = `/create?id=${id}#draft`;
  $("#unlock").href = `/keep?id=${id}`;
  if (p.status !== "approved" && p.status !== "paid" && p.status !== "delivered") {
    // not approved (or edited since): send them back to read and approve the text first
    $("#unlock").href = `/create?id=${id}#draft`;
    $("#unlock").textContent = "Read and approve your text";
  }
  const frame = $("#pvFrame");
  frame.src = `/template/index.html?portrait=${id}`;
  const fit = () => { frame.style.transform = `scale(${$("#pv").clientWidth / 1056})`; };
  window.addEventListener("resize", fit); fit();

  $("#share").onclick = async () => {
    const url = `${location.origin}/preview?id=${id}`;
    const title = `A portrait of ${p.answers.name || "our family"}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); $("#share").textContent = "Link copied"; }
    } catch { /* closed the share sheet */ }
  };
}
main();
