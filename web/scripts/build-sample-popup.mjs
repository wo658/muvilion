// Draws the authored "Seongsu pop-up studio" sample plan (fictional venue) as a PNG.
// Run from web/: node scripts/build-sample-popup.mjs → ../data/samples/popup/seongsu-popup-plan.png
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const PX = 40; // pixels per metre (1:200 at print size is not implied; the scale bar is the reference)
const OX = 150, OY = 210; // plan origin inside the sheet
const W = 32 * PX + OX * 2, H = 22 * PX + OY + 230;
const p = (x, y) => `${OX + x * PX},${OY + y * PX}`;
const X = x => OX + x * PX, Y = y => OY + y * PX;
const INK = "#1f2328", SOFT = "#6b7280", WALL = 10, PART = 5;

// Outer envelope in metres, clockwise: chamfered north-east corner (entrance) and a notch at the south-west.
const outline = [[0, 0], [26, 0], [32, 6], [32, 22], [14, 22], [14, 15], [0, 15]];
const wall = (a, b, width = WALL) => `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="${INK}" stroke-width="${width}" stroke-linecap="square"/>`;
// Exterior walls with door openings left as gaps.
const walls = [
  wall([0, 0], [26, 0]),
  wall([26, 0], [27.6, 1.6]), wall([30.4, 4.4], [32, 6]), // main entrance gap on the chamfer
  wall([32, 6], [32, 22]),
  wall([32, 22], [22.5, 22]), wall([20.5, 22], [14, 22]), // service door
  wall([14, 22], [14, 15]),
  wall([14, 15], [0, 15]),
  wall([0, 15], [0, 0]),
  // WC core (south-west) and storage (south-east) partitions with door gaps.
  wall([0, 10.5], [3.4, 10.5], PART), wall([4.6, 10.5], [5.5, 10.5], PART), wall([5.5, 10.5], [5.5, 15], PART),
  wall([26, 16.5], [26, 22], PART), wall([26, 16.5], [27.2, 16.5], PART), wall([28.4, 16.5], [32, 16.5], PART),
].join("");
const door = (hinge, radius, start, sweep) => {
  const [cx, cy] = [X(hinge[0]), Y(hinge[1])], r = radius * PX;
  const a0 = start * Math.PI / 180, a1 = (start + sweep) * Math.PI / 180;
  return `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 0 ${sweep > 0 ? 1 : 0} ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}" fill="none" stroke="${SOFT}" stroke-width="1.5"/>`;
};
const doors = [door([20.5, 22], 2, 0, -90), door([3.4, 10.5], 1.2, 0, 90), door([27.2, 16.5], 1.2, 0, 90)].join("");
// Storefront glazing: a white break in the wall with the standard double glass line, drawn over the walls.
const glazing = (a, b) => {
  const [x1, y1, x2, y2] = [X(a[0]), Y(a[1]), X(b[0]), Y(b[1])];
  const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len * 3, ny = (x2 - x1) / len * 3;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="${WALL + 2}"/>`
    + [1, -1].map(s => `<line x1="${x1 + nx * s}" y1="${y1 + ny * s}" x2="${x2 + nx * s}" y2="${y2 + ny * s}" stroke="${INK}" stroke-width="1.5"/>`).join("")
    + [[x1, y1], [x2, y2]].map(([x, y]) => `<line x1="${x - nx * 2}" y1="${y - ny * 2}" x2="${x + nx * 2}" y2="${y + ny * 2}" stroke="${INK}" stroke-width="3"/>`).join("");
};
const windows = [[[2, 0], [9, 0]], [[11, 0], [18, 0]], [[20, 0], [25, 0]], [[32, 8], [32, 13]]].map(([a, b]) => glazing(a, b)).join("");
const columns = [[9, 7.5], [17, 7.5], [23, 14]].map(([x, y]) => `<rect x="${X(x) - 12}" y="${Y(y) - 12}" width="24" height="24" fill="${INK}"/>`).join("");
const text = (x, y, value, size = 22, weight = 600, fill = INK, anchor = "middle") => `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
const labels = [
  text(X(11), Y(5), "MAIN HALL"), text(X(11), Y(5) + 24, "CH 4.2 m", 15, 400, SOFT),
  text(X(20), Y(19), "ANNEX"), text(X(20), Y(19) + 24, "CH 3.6 m", 15, 400, SOFT),
  text(X(13.5), Y(0) + 26, "STOREFRONT GLAZING", 12, 600, SOFT), text(X(32) - 14, Y(10.5), "GLAZING", 12, 600, SOFT, "end"),
  text(X(23) + 20, Y(14) + 30, "COLUMN 0.6 m (fixed)", 12, 400, SOFT, "start"),
  text(X(2.75), Y(13), "WC", 18), text(X(29), Y(19.5), "STORAGE", 16), text(X(29), Y(19.5) + 22, "6 x 5.5 m", 14, 400, SOFT),
  text(X(30.2), Y(1.2), "MAIN ENTRANCE", 16, 700, INK, "start") + `<path d="M${X(31.4)},${Y(1.4)} L${X(29.6)},${Y(3.2)}" stroke="${INK}" stroke-width="2.5" marker-end="url(#arrow)"/>`, text(X(21.5), Y(22) + 30, "SERVICE DOOR", 14, 600, SOFT),
].join("");
// Dimension lines with ticks; text sits beside the line, never on wall geometry.
const dim = (a, b, value, offset, vertical = false) => {
  const [x1, y1, x2, y2] = vertical ? [X(a) + offset, Y(b[0]), X(a) + offset, Y(b[1])] : [X(a[0]), Y(b) + offset, X(a[1]), Y(b) + offset];
  const tick = vertical ? (x, y) => `<line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}" stroke="${SOFT}" stroke-width="2"/>` : (x, y) => `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}" stroke="${SOFT}" stroke-width="2"/>`;
  const label = vertical ? `<text x="${x1 + 14}" y="${(y1 + y2) / 2 + 6}" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="${SOFT}">${value}</text>`
    : text((x1 + x2) / 2, y1 - 10, value, 18, 400, SOFT);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SOFT}" stroke-width="1.5"/>${tick(x1, y1)}${tick(x2, y2)}${label}`;
};
const dims = [
  dim([0, 26], 0, "26.0 m", -60),
  dim(32, [6, 22], "16.0 m", 50, true),
  dim([14, 32], 22, "18.0 m", 70),
  dim(0, [0, 15], "15.0 m", -110, true),
].join("");
// 0–10 m scale bar in five 2 m cells.
const barY = Y(22) + 120, barX = X(0);
const scaleBar = Array.from({ length: 5 }, (_, i) => `<rect x="${barX + i * 2 * PX}" y="${barY}" width="${2 * PX}" height="14" fill="${i % 2 ? "#ffffff" : INK}" stroke="${INK}" stroke-width="1.5"/>`).join("")
  + [0, 2, 4, 6, 8, 10].map(m => text(barX + m * PX, barY + 40, `${m}${m === 10 ? " m" : ""}`, 16, 400)).join("")
  + text(barX, barY - 14, "SCALE", 14, 700, SOFT, "start");
// Legend and site notes beside the scale bar, below the annex.
const notesX = X(14), notesY = barY - 14;
const legend = [
  [`<line x1="0" y1="0" x2="40" y2="0" stroke="${INK}" stroke-width="${WALL}"/>`, "Exterior wall"],
  [`<line x1="0" y1="0" x2="40" y2="0" stroke="${INK}" stroke-width="${PART}"/>`, "Partition"],
  [`<line x1="0" y1="-3" x2="40" y2="-3" stroke="${INK}" stroke-width="1.5"/><line x1="0" y1="3" x2="40" y2="3" stroke="${INK}" stroke-width="1.5"/>`, "Glazing"],
  [`<rect x="12" y="-8" width="16" height="16" fill="${INK}"/>`, "Column"],
].map(([mark, label], i) => `<g transform="translate(${notesX + i * 150},${notesY + 26})">${mark}${text(50, 5, label, 14, 400, INK, "start")}</g>`).join("")
  + text(notesX, notesY, "LEGEND", 14, 700, SOFT, "start")
  + text(notesX, notesY + 70, "Floor area approx. 588 m²  ·  Polished concrete floor  ·  Clear ceiling height: Main hall 4.2 m, Annex 3.6 m", 14, 400, SOFT, "start");
const title = text(OX, 52, "Seongsu Pop-up Studio — Ground Floor (fictional demo venue)", 26, 700, INK, "start")
  + text(OX, 82, "Authored sample for muvilion. Not a real building; dimensions are design assumptions.", 16, 400, SOFT, "start")
  + `<g transform="translate(${W - 110},64)"><path d="M0,-30 L12,10 L0,2 L-12,10 Z" fill="${INK}"/>${text(0, 34, "N", 18, 700)}</g>`;
const floor = `<polygon points="${outline.map(([x, y]) => p(x, y)).join(" ")}" fill="#f4f1ea"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${INK}"/></marker></defs><rect width="100%" height="100%" fill="#ffffff"/>${title}${floor}${walls}${windows}${doors}${columns}${labels}${dims}${scaleBar}${legend}</svg>`;
const out = resolve(process.cwd(), "../data/samples/popup");
mkdirSync(out, { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(out, "seongsu-popup-plan.png"));
console.log(`wrote ${resolve(out, "seongsu-popup-plan.png")} (${W}×${H})`);

// Concept reference for the fitting bar: one furniture piece in 3/4 view, plain background, no text, logos, people or product replicas.
// Soft isometric render: gradient faces stand in for lighting from the upper left, a blurred contact shadow grounds it.
const iso = (x, y, z) => [512 + (x - y) * 0.866 * 46, 455 + (x + y) * 0.5 * 46 - z * 46];
const poly = (points, fill, stroke = "#00000014", width = 1) => `<polygon points="${points.map(pt => iso(...pt).join(",")).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const box = (x, y, z, w, d, h, top, left, right) => poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top)
  + poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left)
  + poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right);
const line = (a, b, stroke, width) => { const [x1, y1] = iso(...a), [x2, y2] = iso(...b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`; };
// Try-on frames as outlines on the tray: two rims and a bridge, never a product replica.
const frames = (x, y) => { const [cx, cy] = iso(x, y, 2.19); return `<g fill="none" stroke="#1b1d21" stroke-width="3.2"><ellipse cx="${cx - 11}" cy="${cy}" rx="9" ry="5.5"/><ellipse cx="${cx + 11}" cy="${cy}" rx="9" ry="5.5"/><path d="M${cx - 2},${cy - 1} q2,-3 4,0"/></g><ellipse cx="${cx - 13}" cy="${cy - 1.5}" rx="3" ry="1.4" fill="#ffffff" opacity="0.55"/>`; };
const grain = Array.from({ length: 6 }, (_, i) => line([-3.3, -0.2 + i * 0.17, 2.19], [3.3, -0.2 + i * 0.17, 2.19], "#7a4f2c", 0.8)).join("");
const mirror = x => box(x, -1.15, 2.12, 2.2, 0.08, 1.7, "#1b1d21", "url(#glass)", "#1b1d21")
  + poly([[x + 0.08, -1.07, 2.2], [x + 2.12, -1.07, 2.2], [x + 2.12, -1.07, 3.74], [x + 0.08, -1.07, 3.74]], "none", "#1b1d21", 4)
  + line([x + 0.5, -1.07, 2.5], [x + 1.3, -1.07, 3.5], "#ffffff", 5).replace("/>", ' opacity="0.45"/>')
  + line([x + 0.9, -1.07, 2.45], [x + 1.5, -1.07, 3.2], "#ffffff", 2).replace("/>", ' opacity="0.35"/>');
const stool = x => box(x, 1.75, 0, 0.7, 0.7, 1.0, "#2a2d33", "#22252a", "#30343b")
  + box(x - 0.04, 1.71, 1.0, 0.78, 0.78, 0.16, "url(#cushion)", "#5b4636", "#4b392c");
const concept = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><defs>
<radialGradient id="bg" cx="38%" cy="30%" r="85%"><stop offset="0" stop-color="#f5f0e8"/><stop offset="1" stop-color="#ddd4c6"/></radialGradient>
<linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3eee5"/><stop offset="1" stop-color="#e2d8c8"/></linearGradient>
<linearGradient id="side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9cdb9"/><stop offset="1" stop-color="#c8baa3"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef4f7"/><stop offset="0.55" stop-color="#c3d3dc"/><stop offset="1" stop-color="#a9bcc8"/></linearGradient>
<linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b98457"/><stop offset="1" stop-color="#9a6a42"/></linearGradient>
<linearGradient id="cushion" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6b52"/><stop offset="1" stop-color="#6c5240"/></linearGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
</defs><rect width="100%" height="100%" fill="url(#bg)"/>
<ellipse cx="500" cy="520" rx="330" ry="95" fill="#6b5a45" opacity="0.26" filter="url(#soft)"/>
${poly([[-4.3, -1.5, 0], [4.3, -1.5, 0], [4.3, 2.7, 0], [-4.3, 2.7, 0]], "#6b5a45", "none").replace("/>", ' opacity="0.12"/>')}
${box(-4, -1.2, 0, 8, 2.4, 0.12, "#2a2d33", "#1b1d21", "#24272c")}
${box(-3.95, -1.15, 0.12, 7.9, 2.3, 1.88, "url(#body)", "url(#body)", "url(#side)")}
${[-2, 0, 2].map(x => line([x, 1.15, 0.3], [x, 1.15, 1.9], "#cdbfa9", 1.4)).join("")}
${line([-3.8, 1.42, 0.45], [3.8, 1.42, 0.45], "#b48a4c", 5)}
${box(-4, -1.2, 2, 8, 2.4, 0.12, "#1f2227", "#16181c", "#24272c")}
${[-3.6, -1.2, 1.2].map(mirror).join("")}
${box(-3.4, -0.3, 2.12, 6.8, 1.1, 0.06, "url(#wood)", "#8c5f3b", "#7a5233")}
${grain}
${[-2.6, -1, 0.6, 2.2].map(x => frames(x, 0.25)).join("")}
${[-3, -0.4, 2.2].map(stool).join("")}
</svg>`;
const concepts = resolve(process.cwd(), "../data/samples/concepts");
await sharp(Buffer.from(concept)).webp({ quality: 86 }).toFile(resolve(concepts, "glasses-fitting-bar.webp"));
console.log(`wrote ${resolve(concepts, "glasses-fitting-bar.webp")}`);
