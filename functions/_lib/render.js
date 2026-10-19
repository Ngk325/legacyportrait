// Builds the JSON the newspaper template needs from a stored portrait.

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function todayLong() {
  const d = new Date();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function buildRenderData(portrait) {
  const a = portrait.answers || {};
  const e = portrait.edited || {};
  const folio = a.folio || {};
  const byline = a.byline ? `By ${a.byline}${a.relationship ? ", " + a.relationship.replace(/^(my|our)\s+/i, "") : ""}` : "";
  const photos = portrait.photos || [];
  const base = `/api/portraits/${portrait.id}/photos/`;
  const extras = [];
  photos.slice(1, 3).forEach((p, i) => {
    extras.push({ src: base + (i + 1), caption: (e.captions && e.captions[i]) || "", afterParagraph: i === 0 ? 3 : 6, focus: [0.5, 0.4] });
  });
  return {
    nameplate: folio.publication || "The Family Gazette",
    vol: folio.edition || "Vol. I · No. 1",
    tagline: folio.section || "A Life Remembered",
    date: folio.date || todayLong(),
    headline: a.name || "Your Ancestor",
    subhead: e.subheadline || "",
    byline,
    photo: photos[0] ? { src: base + "0", focus: [0.5, 0.4] } : { src: "/public/template/assets/placeholder-portrait.jpg".replace("/public", ""), focus: [0.5, 0.4] },
    extraPhotos: extras,
    body: e.body_paragraphs || [],
    closing: "— 30 —",
    footer: "",
    options: { halftone: true, bodyMinPt: 8.5, bodyMaxPt: 12, photoCol2Share: 0.5, photoBottomRatio: 0.6 },
  };
}
