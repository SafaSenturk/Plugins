// orb3d.js dosyasını üretir: npm i world-atlas@2 topojson-client@3 && node tools/build.js
// Kara maskesi (1°) ve kıyı çizgileri (0,2° nicemleme, fark kodlaması) gömülür.
const topo = require("topojson-client");
const land = require(process.argv[2] || "world-atlas/land-110m.json");
const f = topo.feature(land, land.objects.land);
// rings of all polygons
const rings = [];
for (const g of f.features) {
  const polys = g.geometry.type === "Polygon" ? [g.geometry.coordinates] : g.geometry.coordinates;
  for (const p of polys) for (const r of p) rings.push(r);
}
// point in polygon (even-odd over all rings) for mask
function inside(lon, lat) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
// 1° mask: row = lat from 89.5 down to -89.5, col = lon -179.5..179.5
const W = 360, H = 180, bits = new Uint8Array(W * H / 8);
let n = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (inside(-179.5 + x, 89.5 - y)) { const i = y * W + x; bits[i >> 3] |= 1 << (i & 7); n++; }
}
const mask = Buffer.from(bits).toString("base64");
// coastlines: quantize to 0.2°, delta encode, drop dup points, keep rings >= 3 pts
const Q = 5; // 1/5 degree
const out = [];
let pts = 0;
for (const r of rings) {
  const q = []; let px = null, py = null;
  for (const [lo, la] of r) { const x = Math.round(lo * Q), y = Math.round(la * Q); if (x === px && y === py) continue; q.push(x, y); px = x; py = y; }
  if (q.length < 6) continue;
  pts += q.length / 2;
  // delta
  const d = [q[0], q[1]];
  for (let i = 2; i < q.length; i += 2) d.push(q[i] - q[i - 2], q[i + 1] - q[i - 1]);
  out.push(d.join(","));
}
const coast = out.join(";");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../orb3d.src.js"), "utf8");
if (!src.includes("/*GEO*/null")) throw new Error("GEO yeri bulunamadı");
fs.writeFileSync(path.join(__dirname, "../orb3d.js"), "/* Bu dosya tools/build.js ile orb3d.src.js + Natural Earth 1:110m (kamu malı) verisinden üretilir. */\n" + src.replace("/*GEO*/null", JSON.stringify({ mask, coast })));
console.log("rings", rings.length, "kept", out.length, "pts", pts, "land cells", n, "mask b64", mask.length, "coast chars", coast.length);
