/* Bu dosya tools/build.js ile orb3d.src.js + Natural Earth 1:110m (kamu malı) verisinden üretilir. */
/* =====================================================================
 * Orb3D — tuvalde (canvas 2D) elle çizilen hareketli 3B tel kafes nesneler
 * ve gerçek kıtalarıyla bir dünya küresi. Bağımlılık yok, WebGL gerekmez.
 * Safa Şentürk portföyündeki giriş küresinden (#orb) genelleştirildi.
 *
 *   // 1) Herhangi bir şekil
 *   const orb = Orb3D.create(canvas, {
 *     shapes: [Orb3D.shapes.sphere(), Orb3D.shapes.ring({ radius: 1.34, tilt: [1.05, 0.35], color: "accent" })]
 *   });
 *
 *   // 2) Dünya
 *   const world = Orb3D.globe(canvas, {
 *     markers: [{ lat: 41.0, lon: 28.97, label: "İstanbul" }],
 *     arcs: [{ from: [41.0, 28.97], to: [52.52, 13.40] }]
 *   });
 *
 * Seçenekler (ikisinde de):
 *   colors: { line: "#ebe6da", accent: "#c98a4b", land: …, label: … }
 *   size: 0.32          tuvalin kısa kenarına göre yarıçap
 *   perspective: 3.4    küçüldükçe perspektif güçlenir
 *   tilt: 0.38          başlangıç eğimi (radyan)
 *   autoRotate: 0.12    saniyede radyan; 0 = durur
 *   follow: true        fareyi hafifçe takip eder (portföydeki gibi)
 *   drag: true          sürükleyerek çevrilir, bırakınca süzülür
 *   scroll: element     o bölüm kaydırıldıkça döner, büyür, solar (0..1)
 *   scrollEffect: { spin: 2.6, tilt: 0.9, scale: 0.35, fade: 0.85 }
 *   pauseOffscreen: true  ekranda değilken ve sekme gizliyken durur
 *   reducedMotion: "respect" | "ignore"
 *
 * Şekil biçimi (kendi şekliniz için):
 *   { lines: [[x,y,z, x,y,z, …], …], points: [x,y,z, …],
 *     color: "line" | "accent" | "#hex", alpha: 1, width: 1, dot: 1.4,
 *     occlude: false,  // küre arkasında kalan kısmı gizle (dünya için true)
 *     spin: { axis: "y", speed: 0.2 } }   // kendi ekseninde ayrıca döner
 * Koordinatlar birim küreye göredir (yarıçap 1).
 * ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- renk ---------- */
  function rgb(c) {
    if (Array.isArray(c)) return c;
    c = String(c || "").trim();
    let m = c.match(/^#([0-9a-f]{3})$/i);
    if (m) return m[1].split("").map(h => parseInt(h + h, 16));
    m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = c.match(/(\d+)\D+(\d+)\D+(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [235, 230, 218];
  }
  const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";

  /* ---------- geometri ---------- */
  function latLon(lat, lon, r) {
    r = r || 1;
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    // x sağ, y yukarı, z ekrandan içeri; lon 0 kameraya bakar
    return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), -r * Math.cos(la) * Math.cos(lo)];
  }
  function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
  function circle(seg, f) { const out = []; for (let i = 0; i <= seg; i++) { const p = f((i / seg) * Math.PI * 2); out.push(p[0], p[1], p[2]); } return out; }
  function transform(list, f) { return list.map(l => { const o = []; for (let i = 0; i < l.length; i += 3) { const p = f([l[i], l[i + 1], l[i + 2]]); o.push(p[0], p[1], p[2]); } return o; }); }
  function tiltAll(lines, t) { return t ? transform(lines, p => rotZ(rotX(p, t[0] || 0), t[1] || 0)) : lines; }

  const shapes = {
    // portföydeki küre: enlem ve boylam halkaları
    sphere(o) {
      o = o || {};
      const r = o.radius || 1, seg = o.segments || 96, lats = o.lat == null ? 7 : o.lat, lons = o.lon == null ? 6 : o.lon, lines = [];
      for (let k = 1; k <= lats; k++) {
        const la = -Math.PI / 2 + (k / (lats + 1)) * Math.PI;
        lines.push(circle(seg, a => [Math.cos(a) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(a) * Math.cos(la) * r]));
      }
      for (let m = 0; m < lons; m++) {
        const ay = (m / lons) * Math.PI;
        lines.push(circle(seg, a => rotY([Math.cos(a) * r, Math.sin(a) * r, 0], ay)));
      }
      return Object.assign({ lines: tiltAll(lines, o.tilt) }, o);
    },
    // yörünge halkası; tilt: [x, z] radyan
    ring(o) {
      o = o || {};
      const r = o.radius || 1.34;
      return Object.assign({ lines: tiltAll([circle(o.segments || 120, a => [Math.cos(a) * r, 0, Math.sin(a) * r])], o.tilt || [0, 0]) }, o);
    },
    torus(o) {
      o = o || {};
      const R = o.radius || 0.8, r = o.tube || 0.3, a = o.rings || 18, b = o.sides || 10, lines = [];
      for (let i = 0; i < a; i++) {
        const u = (i / a) * Math.PI * 2;
        lines.push(circle(48, v => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]));
      }
      for (let j = 0; j < b; j++) {
        const v = (j / b) * Math.PI * 2;
        lines.push(circle(96, u => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]));
      }
      return Object.assign({ lines: tiltAll(lines, o.tilt) }, o);
    },
    // köşe ve kenar listesinden çokyüzlü
    poly(verts, edges, o) {
      o = o || {};
      const s = o.radius || 1;
      return Object.assign({ lines: tiltAll(edges.map(e => [].concat(verts[e[0]].map(v => v * s), verts[e[1]].map(v => v * s))), o.tilt) }, o);
    },
    cube(o) {
      const v = [], e = [];
      for (let i = 0; i < 8; i++) v.push([i & 1 ? 0.62 : -0.62, i & 2 ? 0.62 : -0.62, i & 4 ? 0.62 : -0.62]);
      for (let i = 0; i < 8; i++) for (let b = 1; b < 8; b <<= 1) if (!(i & b)) e.push([i, i | b]);
      return shapes.poly(v, e, o);
    },
    octahedron(o) {
      const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], e = [];
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (Math.floor(i / 2) !== Math.floor(j / 2)) e.push([i, j]);
      return shapes.poly(v, e, o);
    },
    icosahedron(o) {
      const t = (1 + Math.sqrt(5)) / 2, n = Math.sqrt(1 + t * t);
      const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => p.map(x => x / n));
      const e = [];
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
        const d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]);
        if (d < 1.1) e.push([i, j]);
      }
      return shapes.poly(v, e, o);
    },
    // DNA/yay gibi sarmal
    spiral(o) {
      o = o || {};
      const turns = o.turns || 4, r = o.radius || 0.7, h = o.height || 1.8, out = [];
      for (let i = 0; i <= 400; i++) { const t = i / 400, a = t * turns * Math.PI * 2; out.push(Math.cos(a) * r, (t - 0.5) * h, Math.sin(a) * r); }
      return Object.assign({ lines: tiltAll([out], o.tilt) }, o);
    },
    // arkada yıldız tozu (sabit tohum: her açılışta aynı)
    stars(o) {
      o = o || {};
      let s = o.seed || 7;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const pts = [];
      for (let i = 0; i < (o.count || 160); i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = (o.inner || 1.6) + rnd() * ((o.outer || 2.6) - (o.inner || 1.6));
        pts.push(Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r, Math.sqrt(1 - u * u) * Math.sin(a) * r);
      }
      return Object.assign({ points: pts, dot: 1.1, alpha: 0.6 }, o);
    },
    // enlem/boylam çizgileri (derece aralıklarıyla)
    graticule(o) {
      o = o || {};
      const step = o.step || 30, lines = [];
      for (let la = -90 + step; la < 90; la += step) { const l = []; for (let lo = -180; lo <= 180; lo += 3) l.push.apply(l, latLon(la, lo)); lines.push(l); }
      for (let lo = -180; lo < 180; lo += step) { const l = []; for (let la = -90; la <= 90; la += 3) l.push.apply(l, latLon(la, lo)); lines.push(l); }
      return Object.assign({ lines: lines, occlude: true, alpha: 0.25 }, o);
    },
    // [[lat, lon], …] çizgileri küre üstüne
    geoLines(rings, o) {
      return Object.assign({ lines: rings.map(r => { const l = []; r.forEach(p => l.push.apply(l, latLon(p[0], p[1], (o && o.lift) || 1))); return l; }), occlude: true }, o || {});
    }
  };

  /* ---------- dünya verisi (Natural Earth 1:110m, kamu malı) ---------- */
  const GEO = {"mask":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADg/wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA/v8/AOD//z8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+///D/////5//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAH/j/+//////8PAAAAgB0AAHgAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAOD//wP8//////8BAACAfx4AAAAAAAAAAP4AAAAAAAAAAAAAAAAAAAAAAAA4+I73//n///////8AAAAAfwAAAAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAOAQACDwP4D///////8BAAAAPAQAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAADzAgPP5H8D//////38AAAAAAAAAAAAA4AEAAAD+DwAAAAAAAAAAAAAAAAAAAIC/g7PfBwAA/v////8AAAAAAAAAAADgBwAAwP//PwAA4B8AAAAAAAAAAAAAAAAMAAD8AgAA+P////8AAAAAAAAAAABwAAAA/P//AwAAAAAAAAAAAAAAAAAAAP8Ahvc5OwAA8P///38AAAAAAAAAAAAcAADg////34cHAAcAAAAAAAAAAAAAgN9/xzf8RwAA4P///z8AAAAAAAAAAAAPAB7g//////8fgB8AAAAAAT4AAAAAAO//B3f8/wsA4P///z8AAAAAAAAAAAAPAG////////8f2f8HAAAAAAD4HwAAAAD8H/D4/38A4P///xMAAAAAAPAHAAAAgN//////////////DwAAAAD+///h/4//H+/Bg/8BwP7//w8AAAAAwP8fAAAAj9///////////////88//h8AAAAAAAD8+Dsw+AH//wAAAP//////DwAA/P8cgEEAAAAAAAAAAAAAAAAA8P8AAAAAAAAAAAAQeAbwPwAA+P//////AwAA4AwAAGAAAAAAAAAAAAAAAAAAIH4DAAAAAAAAAAAA/gPAfwAA/v//////AQBg4AAAABAAAAAAAAAAAAAAAAAAAQ8AAAAAAAAAAACg/wPnfwDw/x/A////AByADwAAAAAAAAAAAAAAAAAAAAAAQID4///////////Pw/0DAP8HAMAfAACA//F//v////////////////////8/AAP4///////////BBPAHAP4HAAAAAADg//z///////////////////////9/AID///////////8AQ8ABAPwBAAAAAAD8P/7///////////////////////9fAMD//////////z8AwA8AAPgBAAAAAAD+H/7/////////////////////Of8BAID///z//////z8AwD8AAMABAAAAAAD+P/z///////////////////9/wH8AAAD8MwD//////x8AwH8MAAAAAAAAAAD+P2D///////////////////95cAAAAACAAwD8/////38AwP8eAAAAAAAAgAGcH/D//////////////////wEAOAAAAADADgDA/////38AgP8/AAAAAAAAwANAH/T//////////////////wAAfgAAAAAwAAAA//////8PgP8/AAAAAAAAwAFwD/7/////////////////PwAAfwAAAAAGAAAA//////8/wP//AAAAAAAAwAOwA/7/////////////////DwCAPwAAAIAAAAAA/v//////8///BwAAAAAAOAcgcP//////////////////HwAAHwAAAAAAAACA+P//////4///DwAAAAAAOA74/////////////////////wUADwAAAAAAAAAA8P//////4///DwAAAAAAGD///////////////////////wUAAwAAAAAAAAAA8P//////7///FwAAAAAAAB///////////////////////wUAAgAAAAAAAAAA0P//////////CAAAAAAAgOH//////////////////////w0AAAAAAAAAAAAAYP////////8xLAAAAAAAAPz//////////////////////wwAAAAAAAAAAAAAAP7//////38HfgAAAAAAgP///////////////////////wQAAAAAAAAAAAAAAP3///////8HUAAAAAAAAP7/////////////////////fwQAAAAAAAAAAAAAAP////////+XAAAAAAAAAPz///93/D/+////////////PwwAAAAAAAAAAAAAAP////////9/AAAAAAAAAPj//f9j/g/+////////////HwAAAAAAAAAAAAAAAP////////8MAAAAAAAAAPj/+P8B/Mf/////////////DwQAAAAAAAAAAAAAAP///////z8AAAAAAAAAcPzH8/8A8I//////////////Bx4AAAAAAAAAAAAAAP///////x8AAAAAAAAA+H+Aw/8AwA/+//////////9/AA8AAAAAAAAAAAAAAP///////x8AAAAAAAAA+D8Aj//w4R/8//////////8/AAAAAAAAAAAAAAAAAP///////wMAAAAAAAAA+B8wuE/+/z/+/////////98fAAMAAAAAAAAAAAAAAP///////wMAAAAAAAAA+A8wEMf//x/+/////////0cOAAMAAAAAAAAAAAAAAP7//////wEAAAAAAAAA+A8AAI7//x/8/////////wMOAAEAAAAAAAAAAAAAAP7//////wAAAAAAAAAA+AcABob//z/8/////////zccwAEAAAAAAAAAAAAAAPz//////wAAAAAAAAAAQOB/AAQ2/////////////x8c8AEAAAAAAAAAAAAAAPj//////wAAAAAAAAAAQPx/AAAA/////////////w8Y/gEAAAAAAAAAAAAAAPD/////fwAAAAAAAAAA4P8/AAAA/////////////w+EGwAAAAAAAAAAAAAAAMD/////HwAAAAAAAAAA8P9/AACA/////////////x/AAwAAAAAAAAAAAAAAAID/////DwAAAAAAAAAA+P//BwaA/////////////x/AAAAAAAAAAAAAAAAAAID9////BwAAAAAAAAAA/P//D3+E/////////////z9AAAAAAAAAAAAAAAAAAAD5////BwAAAAAAAAAA/P//f////////////////x8AAAAAAAAAAAAAAAAAAADy/x8GBgAAAAAAAAAA/P/////v/8///////////z8AAAAAAAAAAAAAAAAAAAD0/w8ABgAAAAAAAAAA/v////+//4///////////z8AAAAAAAAAAAAAAAAAAADu/wcADgAAAAAAAACA//////8f/x/+/////////x8AAAAAAAAAAAAAAAAAAACI/wcALAAAAAAAAADA//////8//z/g/////////w8AAAAAAAAAAAAAAAAAAACQ/wcACAAAAAAAAADg//////9//r+A/////////wcAAAAAAAAAAAAAAAAAAAAQ/wMAAAAAAAAAAADg//////9//n8cgP///////ycAAAAAAAAAAAAAAAAAAAAA/gMAAAAAAAAAAADw////////+P9/AP///////xEAAAAAAAAAAAAAAAAAAAAA/AMAHQAAAAAAAADw////////+P//APz/f///fxAAAAAAAAAAAAAAAAAAAAAA+AcAYAAAAAAAAAD4////////+f9/APz/B///BgAAAAAAAAAAAAAAAAAAAAAA/AccgAEAAAAAAADw////////8f9/AOD/B/5/AAAAAAAAAAAAAAAAAQAAAAAA+A8eADgAAAAAAADw////////4f8/AOD/Afw/BgAAAAAAAAAAAAAAAAAAAAAA8J8PAPwCAAAAAADw////////4/8fAOD/APw/AgAAAAAAAAAAAAAAAAAAAAAAgP8PAAAAAAAAAADw////////x/8HAOB/APx/ADAAAAAAAAAAAAAAAAAAAAAAAP4PAAAAAAAAAAD4////////h/8BAOA/APz/ADAAAAAAAAAAAAAAAAAAAAAAAID/AAAAAAAAAAD4////////j/8AAMAPAMD/ATAAAAAAAAAAAAAAAAAAAAAAAAD/AQAAAAAAAAD4////////nx8AAMAPAMD/ATAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAAAAAAAD4////////vwcAAIAPAMD/AcAAAAAAAAAAAAAAAAAAAAAAAADgAQAAAAAAAAD4////////fwAAAIAPAMD8AQABAAAAAAAAAAAAAAAAAAAAAADAAAgAAAAAAADw////////f2AAAAAPAID4AUACAAAAAAAAAAAAAAAAAAAAAADAAe9zAAAAAADg/////////34AAAAPAEBwAAgAAAAAAAAAAAAAAAAAAAAAAAAAE+9/AAAAAADA/////////38AAAAXAEAgAAQCAAAAAAAAAAAAAAAAAAAAAAAAz///AAAAAACA/////////z8AAAASAMAAAIACAAAAAAAAAAAAAAAAAAAAAAAAyP//AQAAAACA/////////z8AAAAwAIAAAEAHAAAAAAAAAAAAAAAAAAAAAAAAgP//AwAAAAAA/v///////x8AAAAwAAADAAMBAAAAAAAAAAAAAAAAAAAAAAAAwP//fwAAAAAA/A/+/////x8AAAAAAAAHAAcAAAAAAAAAAAAAAAAAAAAAAAAAgP///wAAAAAAEAD8/////w8AAAAAADAGwAcAAAAAAAAAAAAAAAAAAAAAAAAAgP///wEAAAAAAADA/////wcAAAAAAGAG4AEAAAAAAAAAAAAAAAAAAAAAAAAA4P///wEAAAAAAADA/////wMAAAAAAMAM+AMAAAAAAAAAAAAAAAAAAAAAAAAA4P///wMAAAAAAADg/////wEAAAAAAIAL/gMQAAAAAAAAAAAAAAAAAAAAAAAA8P///wMAAAAAAADg////fwAAAAAAAIAH/vMQAAAAAAAAAAAAAAAAAAAAAAAA8P///wcAAAAAAADg////PwAAAAAAAAAP/gMAAQAAAAAAAAAAAAAAAAAAAAAA+P///38AAAAAAADg////PwAAAAAAAAAO/DmAAwAAAAAAAAAAAAAAAAAAAAAA+P///38BAAAAAADA////HwAAAAAAAAA+/DkA8gAAAAAAAAAAAAAAAAAAAAAA8P////8fAAAAAACA////DwAAAAAAAAA8wChE/gcAAAAAAAAAAAAAAAAAAAAA+P////8/AAAAAACA////BwAAAAAAAAA4AEAA8B8AAAAAAAAAAAAAAAAAAAAA+P//////AQAAAAAA////BwAAAAAAAAAwAEAAxD8NAAAAAAAAAAAAAAAAAAAA+P//////AQAAAAAA////BwAAAAAAAADAAQAAxP+AAAAAAAAAAAAAAAAAAAAA8P//////AQAAAAAA/v//BwAAAAAAAACAHwAAwH8ABAAAAAAAAAAAAAAAAAAA4P//////AQAAAAAA/v//BwAAAAAAAAAAQFYEAMcAAAAAAAAAAAAAAAAAAAAA4P//////AAAAAAAA/v//DwAAAAAAAAAAAAgBAIABMAAAAAAAAAAAAAAAAAAAwP//////AAAAAAAA/v//DwAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAgP////9/AAAAAAAA/P//DwAAAAAAAAAAAAAAAQQAAAAAAAAAAAAAAAAAAAAAgP////8/AAAAAAAA/v//HyAAAAAAAAAAAACAHwQAAAAAAAAAAAAAAAAAAAAAAP////8fAAAAAAAA/v//HyAAAAAAAAAAAADADwwAAAAAAAAAAAAAAAAAAAAAAP////8fAAAAAAAA////HzAAAAAAAAAAAADsDxwAAAAAAAAAAAAAAAAAAAAAAP7///8fAAAAAAAA////DzgAAAAAAAAAAAD/DxwAAAAA/////////////////wcAAADg////////AAAA8MD///////////8AwMH///d/AAAAAAAAAAAAAAAAAOD///8fAAAAAAAA////Ax8AAAAAAAAAAMD//z4AAABAAAAAAAAAAAAAAAAAAMD///8PAAAAAAAA////AB8AAAAAAAAAAMD//z8AAAAAAAAAAAAAAAAAAAAAAMD///8PAAAAAAAA/v9/AB8AAAAAAAAAAOD//38AAAAAAAAAAAAAAAAAAAAAAMD///8PAAAAAAAA/v9/AB8AAAAAAAAAAPz///8BAAEAAAAAAAAAAAAAAAAAAMD///8HAAAAAAAA/P9/gA8AAAAAAAAAgP////8BAAIAAAAAAAAAAAAAAAAAAMD///8DAAAAAAAA/P//gA8AAAAAAAAAwP////8DAAAAAAAAAAAAAAAAAAAAAMD//38AAAAAAAAA/P9/AA8AAAAAAAAAwP////8HAAAAAAAAAAAAAAAAAAAAAOD//x8AAAAAAAAA+P9/AAcAAAAAAAAA4P////8PAAAAAAAAAAAAAAAAAAAAAOD//w8AAAAAAAAA+P8fAAIAAAAAAAAAwP////8fAAAAAAAAAAAAAAAAAAAAAOD//wcAAAAAAAAA+P8fAAAAAAAAAAAA4P////8fAAAAAAAAAAAAAAAAAAAAAOD//wcAAAAAAAAA+P8fAAAAAAAAAAAAwP////8fAAAAAAAAAAAAAAAAAAAAAOD//wcAAAAAAAAA8P8PAAAAAAAAAAAAgP////8/AAAAAAAAAAAAAAAAAAAAAOD//wMAAAAAAAAA4P8HAAAAAAAAAAAAgP////8fAAAAAAAAAAAAAAAAAAAAAPD//wMAAAAAAAAA4P8HAAAAAAAAAAAAgP////8fAAAAAAAAAAAAAAAAAAAAAPD//wEAAAAAAAAAwP8DAAAAAAAAAAAAAP////8fAAAAAAAAAAAAAAAAAAAAAOD//wAAAAAAAAAAwP8BAAAAAAAAAAAAAP8D/P8PAAAAAAAAAAAAAAAAAAAAAPD/fwAAAAAAAAAAwH8AAAAAAAAAAAAAgP8A2P8HAAAAAAAAAAAAAAAAAAAAAPD/OwAAAAAAAAAAgAEAAAAAAAAAAAAAAAcA6P8HAAAAAAAAAAAAAAAAAAAAAPj/BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwP8DAAACAAAAAAAAAAAAAAAAAPj/BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8DAAAEAAAAAAAAAAAAAAAAAPz/BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8DAAAIAAAAAAAAAAAAAAAAAPj/AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGgAAAA4AAAAAAAAAAAAAAAAAPg/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAPw/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAPwHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAALAAAAAAAAAAAAAAAAAPwfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAIADAAAAAAAAAAAAAAAAAPgHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAMABAAAAAAAAAAAAAAAAAPwHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAP4BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHgAAAAAAAAAAAAAAAAAAP4BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAP4DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH6AAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAIAfAAAAAAAeeADADwAAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAPD/AADA/////////z8AAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAgP///wH4//////////8DAAAAAAAAAAAAAAAAAAAAADAfAAAAAAAAAAAAAADw8////wP+////////////AwAAAAAAAAAAAAAAAAAAAHA/AAAAAAAAAAA8//P//////+D/////////////HwAAAAAAAAAAAAAAAAAAAP5+AAAAAAAA5v////////////D//////////////38AAAAAAAAAAAAAAAAAAAB+AAAAAACA/////////////////////////////38AAAAAAAAAYAYA4ON/OPh/AAAAAADw/////////////////////////////x8AAAAAAADwv/MXgP////8fAAAAAADw/////////////////////////////wMAAAAAAPz///////////8HAAAAAAD+/////////////////////////////wAAAAAAAPz//////////z8AAAAAAP///////////////////////////////wAAAADA/////////////wEAAAAA8P///////////////////////////////wAAAACH////////////PwAAAPgA/////////////////////////////////wcAAAAcgP//////////fwAAAP4BwP//////////////////////////////HwAAAAAAAP7//////////wf8wD8AwP//////////////////////////////DwAAAAAA/v////////////8HAAD4////////////////////////////////HwAAAAAA+P//////////////4f///////////////////////////////////wAAAAAA/P///////////////////////////////////////////////////x8A3x8AAP7/////////////////////////////////////////////fwAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","coast":"-298,-400,-1,-3,-2,-2,-10,1,-11,-1,-7,2,-2,2,11,0,11,-1,3,2,3,2,5,-2;-796,-397,-10,-1,-6,2,-3,1,0,1,-4,1,3,2,10,-1,5,-1,4,-2,1,-2;-226,-390,6,-2,3,-3,0,-3,0,-2,-7,-2,-9,-1,-9,-1,-10,-1,-12,0,-7,2,1,2,11,1,4,2,3,2,2,2,3,2,4,2,2,0,8,1,7,-1;-606,-368,6,0,6,1,-2,-2,-5,-1,-7,0,-5,2,1,1,6,-1;-628,-367,8,-2,-3,0,-7,0,-6,2,3,1,5,-1;-495,-360,6,0,5,0,3,-3,-4,1,-6,0,-6,0,-7,-1,-5,1,-3,3,3,0,7,0,7,-1;-342,-355,0,-2,-1,-2,-1,-2,-6,-1,-5,-1,-7,1,3,2,-6,-1,-6,-1,-4,2,0,2,5,2,4,0,6,0,1,3,0,1,0,4,3,3,5,1,2,-2,2,-2,2,-2,1,-3,2,-2;-900,-424,5,3,9,-1,2,0,1,1,2,0,1,1,0,-1,1,0,7,-2,6,2,2,1,14,1,5,-2,2,0,8,-2,14,-1,11,-2,20,-1,14,2,21,-1,12,-2,14,1,13,2,2,2,-20,0,-16,2,-5,1,-13,2,1,2,2,2,2,2,-1,2,-9,1,-3,2,-8,1,12,0,12,1,7,-2,9,2,8,2,4,1,-2,2,-6,2,-8,1,-10,1,-9,0,-10,1,-3,2,-6,1,-4,2,-2,6,3,-1,4,-2,8,1,8,1,4,-2,8,0,7,1,6,1,6,2,7,1,0,1,-1,2,1,2,6,1,3,-2,8,1,6,2,7,0,7,0,6,1,6,1,6,1,4,0,3,0,8,0,6,0,7,0,7,0,7,0,7,-1,7,1,7,0,8,-1,6,1,6,1,6,1,6,-1,6,1,5,1,4,-1,1,-2,4,-2,5,2,6,-2,6,-1,6,-1,7,0,7,1,7,0,7,-1,7,-1,2,3,-3,1,-2,2,-7,0,-3,2,-1,2,-1,4,3,-1,7,0,6,0,6,-1,5,-1,3,-2,6,0,7,1,7,1,6,0,5,-1,7,0,4,4,4,-2,6,-1,6,1,4,-2,7,-1,6,0,6,-1,4,2,2,1,5,-2,6,1,5,-1,4,-2,7,1,5,1,5,1,6,1,7,0,6,1,5,1,3,2,1,2,0,2,-2,2,-2,2,-1,2,-1,1,-1,2,1,2,2,2,2,2,1,2,-1,2,-1,2,3,3,2,1,4,2,3,2,4,1,2,2,3,2,3,1,5,0,3,2,3,1,5,0,3,1,3,2,4,1,3,-2,-2,-1,-5,-2,-2,-1,-4,1,-4,-1,-3,-1,-4,-1,-3,-1,0,-2,0,-2,2,-2,-3,-1,-5,-1,-2,-1,-3,-2,-4,-2,0,-2,1,-2,3,-1,4,-2,4,-1,2,-2,1,-2,2,-2,2,-2,1,-1,1,-5,2,-2,0,-2,2,-2,-1,-2,-3,-3,-3,-1,-6,-1,-3,-2,-3,-1,-7,-2,-7,-1,-6,-1,-7,-1,-4,-2,-8,0,-9,0,-8,-1,-8,0,1,-2,8,0,6,-2,3,-2,-6,-1,-8,0,-8,-1,0,-2,0,-2,6,-2,1,-1,6,-2,11,-1,9,-1,7,-2,9,-2,12,0,13,-2,8,-1,10,-2,4,-2,3,-2,6,2,8,1,9,2,10,1,9,1,13,0,12,0,10,-1,3,2,7,1,13,0,10,1,9,1,10,1,12,1,7,1,-3,2,-2,2,0,2,-10,0,-10,-1,-10,0,-2,2,1,3,2,1,8,2,8,1,6,1,6,2,5,2,6,1,7,0,4,1,7,0,8,0,6,1,6,2,5,1,7,1,5,2,4,2,2,1,-5,2,1,2,4,1,5,1,5,1,6,2,3,2,3,2,4,2,5,-1,3,-1,6,0,0,1,3,2,5,0,1,-2,6,0,7,1,6,0,6,0,2,-2,5,1,5,1,6,1,6,1,5,1,5,1,5,1,3,2,3,-2,6,1,3,-2,3,-2,6,1,2,2,5,1,7,0,2,-2,4,2,5,0,6,1,5,0,6,-1,5,0,3,-2,3,-1,5,0,6,1,6,0,5,0,5,0,6,1,4,1,5,1,5,1,4,1,3,3,2,1,6,0,2,-2,4,-1,5,0,4,-2,3,-1,5,1,2,2,5,1,5,2,5,1,6,1,3,1,5,1,4,1,4,-1,5,2,3,2,5,-1,4,2,1,1,4,2,4,1,5,1,5,0,4,0,5,-1,4,-1,0,-2,5,-2,3,-1,6,-1,3,-1,4,-2,5,0,4,1,4,2,5,-1,5,-1,5,0,4,-1,5,0,5,-5,-1,-1,0,-2,-5,-2,-4,-2,1,-1,5,0,0,-2,-3,-2,-2,-2,4,-2,5,0,6,1,3,2,2,1,2,2,3,1,2,2,2,3,3,0,6,0,5,1,5,1,3,2,1,2,4,1,4,2,5,1,2,1,3,1,4,1,5,-1,4,1,5,1,6,-1,3,2,3,3,2,-1,2,-3,4,-1,5,0,5,0,5,0,5,0,3,0,4,0,4,-1,4,1,6,0,4,0,6,0,3,1,2,2,4,1,6,4,3,-1,4,-1,4,-2,6,-3,5,0,4,0,6,1,5,1,4,1,4,1,5,1,4,1,4,-1,2,-2,4,-1,6,0,3,-2,6,-1,6,0,5,0,4,2,4,1,4,1,5,-1,5,-1,5,1,4,0,4,0,5,-1,5,1,5,1,5,0,6,0,4,1,5,0,1,2,0,2,3,-1,1,-2,2,-2,2,-2,4,-1,6,1,7,0,4,0,7,0,4,0,7,0,5,-1,4,-1,-1,-2,3,-1,6,-2,5,-1,7,-1,6,-1,6,0,5,0,3,1,5,-1,4,-2,4,-1,6,0,6,-1,2,-2,6,-1,4,-2,5,-1,6,0,6,0,6,0,6,0,5,-1,5,-1,6,-1,3,-1,-1,-2,-2,-2,-2,-2,-2,-2,-3,-2,-6,-1,-3,-2,-7,-1,-2,-2,-3,-2,-4,-1,-2,-2,-1,-2,-1,-2,0,-2,3,-2,1,-2,3,-2,9,-1,2,-2,-9,-1,-8,-1,-9,0,-4,-3,-1,-2,-2,-2,-3,-2,7,-1,2,-2,4,-2,7,-2,6,-2,8,-1,11,-2,3,-2,14,-1,1,-1,4,-1,14,1,11,-1,-1791,-2;-339,-269,7,-3,7,-1,-3,-3,-4,0,-3,2,-1,-3,-5,-1,-5,1,-4,1,-5,1,-6,3,-5,2,-7,6,4,-1,7,-4,6,-1,3,2,2,3,4,2,4,0,2,-3,2,-3;-293,-255,4,-3,-1,-2,-7,-1,-2,2,-4,-2,-3,2,6,3,4,-2,3,3;351,-249,-7,0,0,3,0,2,1,1,3,-2,5,0,0,-1,-2,-3;727,-204,5,-2,3,1,3,1,3,0,1,-6,-2,-2,0,-4,-2,1,-4,-3,-1,0,-3,0,-3,5,-1,3,-2,4,0,2,3,0;865,-205,1,-2,4,2,1,-2,0,-2,-2,-2,-3,-4,-2,-2,1,-2,-3,0,-5,-2,-1,-3,-3,-6,-4,-2,-2,-1,-5,0,-3,2,-6,0,0,2,2,3,7,5,3,1,3,2,5,3,3,2,2,4,2,1,0,3,4,3,1,-3;873,-181,4,-5,0,3,2,-1,1,-4,4,-1,3,-1,3,2,3,0,-2,-5,-1,-3,-4,0,-1,-1,0,-2,-1,-1,-1,-3,-3,-3,-4,-2,-1,1,-2,1,3,4,-2,2,-5,2,0,2,4,2,1,4,-1,3,-2,3,1,1,-3,2,-4,5,-2,3,2,1,3,-3,4,-1,1,-5;836,-111,-2,-1,-3,1,-4,3,-3,2,-3,4,-1,1,2,0,3,-1,2,-2,2,-1,4,-3,3,-3;892,-87,2,-1,-1,-3,-3,0,-3,0,-1,2,2,2,3,-1,1,1;-900,-83,1797,-1,-3,-1,-1,2,2,1,2,0,-1797,2,1,0,-1,-3;839,-82,-1,-1,-2,2,0,2,3,-3;836,-75,0,-4,-1,1,-1,0,-1,1,0,4,3,-2;250,-68,1,-6,1,-2,0,-3,-1,-1,-2,3,-1,-2,1,-3,0,-2,-2,-2,0,-4,-2,-6,-2,-6,-3,-10,-2,-7,-3,-6,-4,-1,-4,-2,-3,1,-4,2,-1,3,-1,4,-1,4,-1,4,1,3,2,1,0,2,3,4,0,3,-1,2,-1,3,0,5,2,3,0,3,3,0,3,1,1,1,3,0,2,3,5,3,1,3,-1,2,2,-1,3,4,0,3,2,2,2,-2,1,-2,1,-4;718,-69,2,-4,3,2,1,-2,3,-2,-1,-2,1,-4,1,-3,1,-1,2,-4,-1,-2,2,-4,5,-2,4,-3,3,-2,0,-1,2,-3,2,-6,2,1,2,-2,2,1,1,-5,3,-3,2,-2,4,-4,2,-4,0,-3,-1,-3,3,-5,0,-4,-1,-2,-2,-5,0,-3,-1,-3,-2,-5,-3,-2,-2,-4,-2,-3,-1,-4,-2,-2,-2,-4,0,-4,0,-1,-3,-2,-5,0,-5,-2,-2,-2,-3,-2,-5,2,-3,1,1,3,-3,-1,-4,-4,-4,1,-3,1,-3,0,-5,2,-3,3,-1,4,-1,2,-3,2,-4,1,1,2,-1,4,-2,-3,-5,-1,3,2,1,3,1,3,0,4,-4,-5,-3,-1,-2,-4,-4,2,0,2,-3,4,-3,2,1,1,-6,3,-4,0,-4,3,-9,-1,-7,-2,-5,-1,-5,0,-6,-3,-4,-1,-1,-2,-2,-2,-4,-1,-3,0,-5,1,-3,-1,-4,0,-3,-3,-1,1,-2,-2,-3,-1,-4,0,-3,0,-5,3,-3,1,0,3,3,1,1,1,-1,1,1,4,-1,3,-2,5,-1,3,0,3,-2,3,0,1,-2,2,-1,4,-3,4,0,2,2,-2,-2,5,3,-2,1,-1,0,2,-2,4,-1,2,-1,1,1,3,1,1,0,3,0,3,2,3,0,-4,2,4,4,2,3,2,4,1,2,1,1,-1,4,2,3,1,1,1,1,0,3,0,5,2,3,2,1,2,3,3,0,2,1,3,3,4,2,-4,2,1,-1,2,1,2,2,-1,1,4,3,3,1,2,2,0,0,2,3,-1,0,2,2,0,2,1,4,-2,3,-3,3,0,3,-1,-1,3,2,4,3,1,-1,1,2,3,3,2,3,-1,4,1,0,3,-4,2,3,0,3,-1,3,-2,4,-1,1,0,3,-1,3,1,2,0,1,1,3,-3,-2,-2,-1,-2,-2,-1,0,-2,-1,-2,-2,-3,0,-1,4,-3,4,-1,3,-2,4,-3,1,0,3,-1,0,-2,5,-2,3,2,1,3,1,2,1,3,2,4,-1,2,0,2,0,3,0,3,1,1,-1,2,2,3,1,2,0,2,2,2,1,-3,0,-3,2,-1,0,-2,2,-2,0,-3,0,-2;811,-52,1,-2,-3,0,-2,3,3,-1,1,0;604,-51,-3,0,-6,3,5,1,2,-1,2,-2,0,-1;804,-49,-2,0,-3,0,-1,1,1,2,3,-1,1,-1,1,-1;808,-48,0,-1,-4,4,-1,3,2,0,1,-4,2,-2;622,-51,-4,-1,-1,1,1,2,2,3,5,2,0,1,5,1,3,0,2,1,2,-1,-2,-1,-5,-3,-5,-1,-3,-4;589,-40,2,-2,3,1,2,-3,-6,-1,-4,0,-2,0,1,3,3,0,1,2;615,-40,-1,-3,-8,-2,-6,1,0,2,4,1,3,-2,3,1,5,2;799,-42,1,-1,-4,2,-3,2,-2,2,1,0,2,-1,4,-2,1,-2;788,-37,-1,0,-2,1,-3,2,1,1,3,-2,2,-2;543,-34,10,0,1,2,9,-3,2,-3,7,-1,7,-3,-6,-2,-6,2,-4,0,-5,0,-5,1,-6,2,-4,1,-2,-1,-9,2,-1,2,-4,1,3,5,6,-1,4,-2,2,0,1,-2;674,-31,-3,-3,0,3,0,2,1,2,2,-2,0,-2;779,-34,-1,-1,-2,2,-2,3,-1,4,0,1,1,-2,1,-1,3,-3,2,-2,-1,-1;760,-27,-3,-1,0,-1,-3,-1,-3,-2,-2,0,-5,2,-2,1,0,2,4,-1,3,0,1,3,1,0,0,-3,3,1,1,1,3,2,0,3,3,0,1,-1,0,-2,-2,-3;636,-17,-2,-2,-3,1,-1,2,5,0,1,-1;652,-15,2,-4,-4,2,-4,0,-3,0,-3,0,1,3,6,0,5,-1;766,-22,-2,-2,-1,3,-1,2,-2,2,-3,2,-4,1,2,2,2,-2,2,-1,2,-1,2,-2,2,-2,1,-2;671,-6,1,-8,5,-3,4,5,6,3,5,0,4,-1,4,-2,5,-1,9,-3,9,-3,3,-3,3,-2,1,-3,8,-3,1,-3,-4,-1,1,-3,4,-3,4,-6,3,1,-1,-3,4,0,-1,-1,5,-2,-1,-2,-3,0,-1,1,-4,1,-5,0,-4,4,-3,2,-3,5,-6,2,-5,-2,-3,-1,1,-4,-4,-2,-3,1,-5,0,-4,5,-5,1,-2,-2,-6,0,2,4,3,1,-1,6,-2,4,-10,4,-4,1,-8,4,-1,-2,-2,-1,-1,2,0,2,-4,3,5,2,4,0,-1,1,-7,0,-2,3,-4,1,-2,2,6,2,3,1,8,-2,1,-2;626,7,-4,-5,-4,-1,-4,1,-9,0,-4,-1,-1,-4,5,-4,2,2,10,2,-1,-2,-2,0,-2,-3,-4,-2,4,-6,-1,-2,5,-5,0,-4,-3,-1,-2,2,3,4,-5,-2,-2,1,1,2,-4,3,1,5,-3,-2,0,-5,0,-8,-3,0,-2,1,1,5,-1,5,-2,0,-1,3,2,3,1,4,2,8,1,2,4,4,4,-2,7,-1,5,1,5,3,1,-1;643,6,0,-5,-2,1,-1,-3,2,-3,-2,0,-2,3,-1,6,1,4,2,2,0,-3,3,0,0,-2;529,-29,-5,0,-5,4,-6,4,-2,3,-4,4,-2,4,-4,7,-5,4,-1,4,-2,4,-5,3,-2,5,-4,2,-5,6,-1,2,4,0,7,-1,5,-5,4,-3,2,-2,5,-6,5,0,4,-3,3,-4,4,-2,-2,-5,3,-1,2,0,1,-4,1,-3,4,0,3,-3,-2,-7,0,-7;589,9,6,-4,-6,-1,-2,-3,1,-5,-5,-3,0,-5,-2,-8,-1,2,-6,-3,-2,4,-3,0,-3,1,-6,-1,-1,2,-4,0,-4,0,-1,7,-2,1,-3,5,0,4,0,5,3,3,4,-2,4,1,1,4,2,1,6,2,4,3,2,4,2,2,4,2,4,4,3,4,2,0,2,-3,0,-2,4,-1,4,-2,0,-2,-4,0,1,-3,-4,-1,-2,-5,3,-5,-1,-2;632,42,0,-3,1,-3,-2,-5,-2,5,-2,-2,1,-4,-1,-2,-6,3,-1,3,1,3,-3,2,-2,-2,-2,0,-4,-3,0,2,2,4,3,2,2,1,2,-2,4,2,1,2,3,0,0,4,4,-3,1,-2,0,-2;406,31,-4,-1,-3,4,-1,7,3,8,3,-3,3,-3,2,-5,-1,-6,-2,-1;-305,51,-4,-1,-1,0,2,2,0,2,2,0,2,0,-1,-3;620,51,-2,-1,-1,-3,-2,-2,-3,4,1,1,1,1,1,3,2,1,0,-4,3,5,0,-5;593,47,-7,-5,2,3,4,3,3,4,3,5,0,-4,-3,-3,-2,-3;609,59,3,-1,4,0,0,-2,-3,-2,-3,-2,0,3,0,2,-1,2;628,61,1,-6,-4,2,0,-2,1,-3,-2,-1,0,3,-2,0,0,3,2,0,0,2,-3,4,5,0,2,-2;608,65,-2,-4,-2,3,-2,3,4,0,2,-2;607,93,3,-2,1,1,1,-1,-1,-2,2,-4,-2,-4,-3,-1,0,-4,1,-4,2,-1,3,1,6,-3,-1,-3,2,-1,-1,-2,-4,2,-1,3,-2,-2,-3,3,-4,-1,-3,1,0,2,2,2,-2,1,0,-2,-3,3,0,2,-1,5,2,-2,1,8,2,5,3,0;-328,91,-1,-1,-4,0,-3,0,0,2,1,1,4,0,2,-1,1,-1;-385,89,-1,0,-3,0,-3,2,1,1,2,1,1,-1,4,0,2,-1,1,-2,-4,0;-363,99,4,0,1,0,4,0,3,-1,1,0,1,-2,3,1,0,-2,2,0,2,-2,-1,-2,-3,1,-2,0,-2,0,-1,-1,-2,0,0,1,-2,-1,-2,-3,-1,1,-1,1,-3,1,-2,0,-3,0,-3,-1,-2,2,0,1,5,0,4,-1,1,1,-2,3,0,1,-3,1,1,2,3,-1;552,93,-5,-2,-4,2,0,4,3,2,5,2,3,-1,1,-2,-2,-2,-1,-3;-778,95,-2,0,0,2,0,2,1,1,-1,1,1,0,2,-1,1,0,1,-1,1,-1,0,-1,-2,-1,-2,-1;-780,103,-2,0,-1,1,-1,0,0,1,1,0,2,0,1,-1,0,-1;-784,106,0,-1,-3,0,1,1,2,0;-788,107,-1,-1,-2,1,0,1,1,1,0,-1,2,-1;-797,110,0,-1,-2,1,0,1,1,0,1,0,0,-1;-398,114,2,-2,4,1,2,-2,4,-3,3,-2,2,0,3,-1,0,-1,3,-1,4,-2,0,-1,-4,0,-3,-1,-4,1,-7,-1,4,3,-2,1,-4,1,-1,1,-2,3,-2,0,-5,1,-2,1,-6,1,-2,1,2,1,-5,0,-3,-2,-3,0,0,-1,-3,-1,-2,0,3,2,1,2,2,1,3,1,3,0,2,1,4,0,4,0,5,-2;-388,119,-1,0,-1,2,-2,2,1,3,2,0,1,-4,0,-3;606,114,-2,-4,-3,4,0,4,2,5,4,3,3,-1,-1,-3,-3,-8;-389,133,-6,-1,0,2,2,0,4,0,0,-1;-385,133,-1,-4,-1,1,0,3,-2,2,4,-2;673,171,1,-2,-3,-3,-2,2,-3,-2,-1,-2,-3,1,0,2,3,3,2,0,3,2,3,-1;173,178,-4,-2,1,-1,-5,-2,-3,1,-1,2,3,0,1,1,3,0,5,1;119,179,2,-2,4,0,4,0,0,-1,2,1,0,-2,-7,0,-6,1,1,3;78,191,-2,-4,1,-1,-1,-3,-4,2,-3,1,-7,2,1,3,6,-1,5,1,4,0;46,206,3,-3,-1,-7,-2,0,-2,-1,-2,1,0,6,-1,3,3,-1,2,2;705,186,-2,-4,1,-3,-3,-3,-6,-3,-9,0,-7,-6,-3,2,-1,4,-8,-1,-6,-2,-6,-1,5,-3,-3,-9,-4,-2,-2,2,1,5,-3,1,-2,3,5,2,2,3,5,3,4,3,10,2,5,-1,6,9,3,-3,7,5,3,2,3,6,-1,6,3,3,5,1,3,-7,-1,-4,-4,-5,0,-5;48,211,-2,-4,-2,1,-1,3,1,2,3,2,1,-4;720,221,3,-1,4,2,1,-6,-8,-1,-4,-5,-8,3,-3,-5,-5,0,-1,5,3,4,5,0,1,7,2,4,6,-5,4,-2;-318,233,3,-1,5,0,-3,-2,-1,0,-7,2,-1,2,2,1,2,-2;-309,246,-2,-1,-7,2,-5,2,2,1,7,-1,5,-3;-618,243,-2,-1,-8,2,-2,2,-4,2,-1,1,-5,1,-2,3,0,1,5,-1,4,-1,4,-1,2,-1,2,-3,5,-2,2,-2;-281,253,-3,-4,3,2,4,-1,-2,-2,4,-1,3,1,5,-2,-2,-3,4,0,0,-2,2,-3,-2,-5,-3,0,-3,1,1,4,-1,1,-6,-5,-3,1,4,2,-5,1,-6,0,-9,0,-1,1,3,2,-2,2,4,3,5,8,3,2,5,2,2,0,-1,-1,-3,-4;-664,270,5,1,-1,-6,4,-4,-2,0,-3,2,-2,2,-2,2,-1,2,0,2,2,-1;718,254,5,-9,-7,2,-3,-8,5,-5,0,-3,-4,3,-4,-4,0,4,0,5,0,5,1,4,0,7,-3,5,0,7,5,2,-2,2,2,1,2,-3,1,-5,0,-5,2,-5;-34,261,-9,-3,-7,1,4,5,-2,5,6,4,4,3,4,0,6,-3,-3,-4,1,-3,-4,-5;63,278,-3,-4,-5,3,0,2,7,2,1,-3;-765,286,-5,-2,-3,1,0,2,4,2,3,1,3,0,2,-2,-4,-2;-15,293,-5,-5,5,0,5,0,-1,-4,-5,-4,6,0,4,-7,4,-1,3,-5,1,-2,6,-1,0,-4,-3,-1,2,-3,-4,-2,-7,0,-8,-2,-3,1,-3,-2,-5,1,-3,-2,-3,1,7,5,5,1,-8,1,-1,2,5,2,-3,2,1,3,8,0,0,3,-3,3,-6,1,-1,1,1,3,-1,1,-3,-2,0,4,-3,3,2,5,4,4,4,0,6,0;-828,300,-3,-1,-3,1,-3,1,5,1,4,-1,0,-1;-396,311,-2,-3,-2,1,-2,1,2,2,2,0,2,-1;-409,314,-6,-3,-4,0,-1,1,4,3,7,0,0,-1;-859,319,3,-1,4,0,4,-1,5,-1,-1,0,-4,-1,-3,1,-2,1,-5,0,-1,0,0,2;-426,328,1,-2,3,1,3,-1,5,-2,6,-2,0,-2,4,0,3,-1,-4,-2,-8,1,-3,3,-4,-3,-8,-3,-1,3,-7,0,4,2,1,4,2,5,3,-1;-73,332,-1,-3,6,-3,-7,-4,-14,-4,-4,-1,-7,1,-14,2,5,2,-11,2,9,1,0,2,-11,1,4,3,7,1,8,-3,8,2,6,-1,8,3,8,-1;-379,336,-6,-1,-1,3,2,3,5,0,3,-1,0,-2,0,-1,-3,-1;-900,345,12,-4,13,-5,0,-3,3,-1,-1,3,14,0,10,-5,-5,-2,-9,-1,0,-5,-2,-1,-4,0,-4,2,-7,2,-1,2,-5,1,-6,-1,-3,2,2,2,-6,-2,2,-2,-3,-2,1800,0,-6,-2,-7,0,5,-3,3,-4,2,-1,0,-2,-1,-1,-9,1,-14,-4,-5,-1,-7,-3,-8,-3,-1,-3,-7,4,-14,-4,-2,2,-5,-2,-6,0,-2,-3,-6,-5,0,-2,6,-1,-1,-7,-4,0,-2,-5,2,-2,-9,-2,-2,-6,-7,-1,-2,-5,-7,-5,-2,3,-2,8,-3,11,3,7,4,3,0,2,8,1,9,7,8,5,9,4,4,7,-6,-1,-3,-4,-12,-5,-4,6,-13,-2,-13,-8,4,-3,-11,-2,-8,0,1,4,-8,0,-6,-2,-16,1,-16,-2,-16,-10,-19,-11,8,-1,2,-3,5,-1,3,2,6,0,7,-6,0,-4,-4,-5,0,-6,-3,-8,-7,-7,-2,-3,-7,-6,-6,-6,-4,-3,-6,-3,-3,0,-4,2,-6,-3,-1,-2,-2,0,-2,-1,-2,-2,1,-4,-3,-1,-1,-1,-2,-1,-3,-1,-2,-1,0,-2,-1,-1,2,-1,3,-2,4,-6,1,-3,0,-6,-2,-3,-4,-1,-4,-2,-5,0,0,3,1,3,-2,6,3,0,-3,5,-3,1,0,-1,-2,-1,0,1,-1,1,-1,1,1,2,1,0,0,1,1,3,0,1,-3,0,-3,2,-7,-2,-3,-2,-6,-2,3,3,-1,2,4,3,-3,3,-4,-2,-6,-4,-3,-3,-5,0,-2,-2,2,-4,4,-1,1,-2,4,-1,5,3,5,-2,3,0,1,-2,-7,-2,-3,-2,-5,-3,-2,-3,5,-3,2,-5,3,-5,4,-4,-1,-3,-3,-2,2,-2,2,-2,0,-4,-2,-4,-2,0,-4,-6,-4,-6,-5,-6,-7,-5,-7,-4,-5,-1,-3,-2,-2,2,-3,-3,-7,-2,-5,-1,-2,-5,-3,-1,-1,4,1,2,-6,2,-3,-1,-6,-5,-5,-4,-1,-4,4,-5,5,-7,4,-3,3,-4,3,-9,-1,-9,-4,-3,-6,-3,-4,-4,-6,-5,-2,3,1,4,-3,2,-5,1,-2,3,-2,5,-5,2,-4,0,1,4,-5,0,0,-5,-3,-8,-1,-4,0,-4,3,0,2,-5,1,-4,3,-3,3,0,3,-3,1,0,3,-3,2,-4,0,-3,0,-2,0,-2,1,-3,1,-1,2,-5,0,-2,-3,0,-5,4,-6,4,-1,2,-3,4,0,4,-2,3,1,3,-2,2,-2,2,0,3,-3,3,-2,2,-1,-3,-1,3,0,3,2,5,-1,3,2,4,-2,3,1,6,-2,2,-2,6,-1,7,-2,4,-3,-3,-6,-3,-3,0,-3,1,2,6,-1,5,-4,6,0,2,-3,0,-3,4,-2,3,0,3,-1,2,-2,3,-5,0,1,-2,-2,-3,-2,1,0,-1,-2,1,-2,0,-1,-2,-3,1,-6,-2,0,-3,-3,-3,-7,-4,-5,-5,-4,-4,-5,-3,0,-2,-3,-1,-4,-2,-2,-1,-2,-3,1,-7,0,-4,-2,-5,0,-8,-2,0,-3,-4,2,-2,-5,-1,-1,-4,-2,-1,-5,5,-2,6,-2,6,-2,2,-3,5,-1,6,-1,3,-4,7,-2,10,-2,6,0,6,-1,5,-7,-3,-4,0,-6,6,2,2,-1,2,-6,4,-4,2,-1,3,-4,4,-9,-1,-8,0,-8,-1,-9,2,-5,1,-6,1,-2,6,-3,1,-3,-1,-5,-3,-7,2,-5,4,-4,1,-4,5,-3,7,-3,-1,-3,2,-2,-2,-3,0,1,-2,-1,-1,2,-4,2,-5,3,-1,0,-1,4,-3,0,-2,0,-1,0,-2,2,-1,0,-2,1,-1,0,3,1,3,1,1,2,-2,0,-3,-1,-3,1,-2,1,0,0,-1,4,1,4,0,3,0,3,3,4,3,3,3,2,2,0,-3,-1,0,1,-4,2,-4,3,-2,4,0,3,-1,2,-3,1,-2,2,0,0,-1,-2,-3,-1,-2,-2,-1,-2,-4,-2,0,-1,-1,-1,-2,1,-4,-1,0,-2,0,-3,-2,0,-3,-2,-1,-3,0,-2,-1,0,-2,-2,-1,-3,0,-3,-1,-2,-1,-4,-1,-1,-2,0,-2,-5,-2,-8,-2,-5,-4,-2,0,-1,0,-3,-2,-3,-1,-5,0,-1,-1,-1,-1,-1,0,-1,-2,-3,1,-1,-1,-4,0,-1,3,0,3,-1,1,-1,4,-1,2,1,0,0,3,0,1,0,2,-1,2,-1,1,-1,2,-2,2,-3,4,-1,4,-4,4,-2,1,-3,4,-1,4,0,3,-3,5,-2,2,-3,1,-1,3,0,1,-1,3,-2,1,-2,4,-3,4,-2,3,-3,0,1,3,0,2,1,2,0,1,-2,-3,-1,-3,-1,-3,-1,-1,-2,2,-2,2,-4,7,2,-5,3,-6,4,-7,1,-3,2,-3,4,-5,-1,-1,1,-3,5,-5,1,-1,2,-5,-1,-1,1,-5,1,-6,2,-1,3,-2,3,-6,1,-4,3,-3,7,-5,3,-2,2,-3,2,-2,2,-2,2,-1,-1,-2,-2,-1,2,-2,1,-1,1,-2,3,-2,2,0,5,1,5,1,5,2,2,0,2,1,3,0,1,0,3,1,2,0,3,2,2,0,0,-1,-1,-3,0,-3,-1,-2,-1,-5,-3,-6,-3,-6,-4,-7,-4,-6,-6,-7,-5,-4,-8,-5,-4,-4,-6,-6,-1,-2,-1,-1,-4,-2,-1,-2,-2,-1,0,-3,-2,-2,-1,-4,-2,-1,-2,-7,0,-2,3,-2,0,-1,-1,-4,0,-1,0,-2,2,-4,2,-4,2,-2,0,-2,0,-5,1,-4,0,-8,1,-2,-2,-4,-2,-4,-3,-3,-4,-2,-6,-2,-6,-5,-2,-1,-3,-4,-2,-1,0,-3,2,-4,1,-3,0,-2,1,1,0,-5,-1,-3,1,-1,-1,-2,-2,-1,-4,-2,-6,-3,-2,-2,0,-2,2,0,-1,-3,-1,-3,-1,-5,-1,-2,-3,-2,-1,-1,-2,-3,-2,-2,-3,-4,-5,-5,-4,-3,-4,-2,-5,-2,-2,0,-1,-2,-3,1,-3,-1,-5,1,-3,-1,-2,1,-5,-2,-5,-1,-3,-2,-2,0,-2,2,-2,0,-2,2,0,-1,-1,2,0,3,-1,3,1,1,0,4,-3,4,-3,5,-3,6,-4,4,-2,4,-1,4,-1,4,-2,8,0,6,-1,2,-2,3,-2,4,-3,6,-1,3,-4,5,0,3,-1,4,1,4,2,5,0,2,2,4,1,2,3,4,1,2,1,4,-1,2,-1,2,-1,3,-2,3,1,1,1,2,-1,5,-1,3,-3,4,1,1,-1,1,-1,4,-5,5,-5,5,-3,4,-3,5,0,2,1,2,1,3,1,4,0,1,1,5,1,4,-2,4,-2,1,-1,2,-2,0,1,2,-6,-2,-2,0,-2,-1,-4,0,-2,3,-2,4,-3,3,-4,0,-5,0,-4,0,-4,-1,-8,-3,-2,-2,-5,-1,-4,1,-3,0,-3,1,-3,0,-6,-1,-4,-1,-5,-2,-1,0,-1,0,-5,2,-5,4,-4,3,-3,3,-2,0,-3,2,-3,3,-1,2,0,4,-2,2,-2,2,-2,1,-1,1,0,2,-1,1,-2,1,-2,2,-2,1,-2,1,0,1,-1,1,0,1,-1,4,0,2,-2,4,-2,2,2,1,2,3,2,3,-1,2,2,3,0,5,0,4,-1,3,1,2,-2,3,-2,2,0,2,0,2,2,2,2,2,-1,2,2,4,3,3,2,1,1,3,0,2,2,3,3,2,3,5,3,2,5,1,4,3,2,1,4,5,-1,6,2,4,0,3,4,3,5,2,3,3,4,5,1,3,4,0,3,-2,5,0,5,-1,2,0,5,3,5,0,4,3,4,1,9,1,8,0,3,0,4,2,6,0,2,-2,3,1,6,2,3,-1,0,-2,4,1,1,0,-3,-3,0,-2,2,-2,-1,-4,-3,-2,1,-3,2,0,2,-3,1,0,6,-2,2,0,5,0,6,-3,3,-4,4,-1,7,-2,5,-3,3,2,2,2,-1,4,2,2,3,3,4,0,6,-1,2,-2,2,0,2,-1,5,0,1,-2,6,0,5,-1,5,-2,3,-1,3,2,2,1,5,1,3,-1,2,-2,1,1,4,-1,4,0,2,1,2,2,-1,0,2,2,1,4,0,1,1,0,1,5,3,3,0,4,1,2,-2,2,2,2,-3,0,-4,1,-4,-3,-7,0,-4,2,-6,0,-1,-2,-4,0,-4,2,-6,0,-3,5,-3,3,2,4,-3,2,5,5,8,0,2,4,10,-1,6,4,6,1,8,0,9,-3,7,-2,6,1,4,-1,6,3,1,2,-2,3,-3,2,-2,1,-2,1,-7,4,-5,2,-5,3,4,1,4,4,-3,2,8,2,0,1,-5,0,-4,-1,-3,-2,-5,0,-4,-2,0,-3,3,-1,5,0,-1,-1,-6,-1,-7,-3,-2,1,1,2,-6,2,1,1,5,1,-2,1,-7,2,-1,2,-4,-1,-2,-3,-4,-4,0,-1,-2,-1,-2,1,-1,-6,-3,-3,-2,-3,2,-3,1,-2,4,-1,-1,-2,-6,0,-2,-2,-4,-2,-2,2,0,1,-3,0,-2,1,-6,-2,3,-2,-3,-1,-2,0,-3,2,-1,-1,1,-3,3,-2,-2,-1,3,-2,2,-2,0,-3,-4,2,1,-3,-3,0,2,-5,-4,0,-4,2,-2,4,0,4,-2,2,-3,3,0,1,-1,0,0,2,-3,1,0,3,0,3,1,2,-1,0,-1,1,-2,1,-2,1,-4,2,-3,2,-5,2,-4,3,1,1,-2,2,0,1,-4,1,-1,-2,-2,2,0,1,1,0,1,1,-4,1,-4,-2,0,-3,-1,-1,2,-3,5,-2,2,-4,6,-4,4,0,1,-1,-2,-1,5,-2,4,-2,4,-2,0,-1,-1,-2,-2,2,-5,1,-2,-3,4,-2,-1,-2,-2,-1,-2,-4,-3,0,0,1,1,3,2,1,-2,3,-2,2,-2,1,-1,2,-4,1,-2,2,-4,0,-3,3,-5,3,-3,3,-2,5,-2,0,-5,2,-2,-1,-3,-2,-2,-1,-4,-2,-10,1,-7,-2,-1,-3,0,-3,-5,-3,-6,-1,0,-2,-3,-2,-2,-4,2,-3,-3,-3,-1,-3,-4,-1,-4,-4,-6,0,-5,0,-3,-1,-2,-2,-2,0,-2,2,-2,3,-4,0,-2,-1,-3,1,-2,-1,0,4,0,3,-2,1,-2,2,1,3,2,2,0,2,1,3,0,2,-1,2,0,1,0,4,-2,2,7,4,6,-1,7,0,5,-1,4,0,8,0,3,3,1,10,-5,5,-4,3,-7,2,-1,3,7,2,8,-2,-2,6,5,-2,12,4,1,4,5,1,4,1,2,1,5,7,6,3,5,-1,1,1,4,1,1,-1,3,2,-1,2,0,3,-2,3,-1,5,1,1,2,2,4,0,2,1,4,2,0,-3,-2,-2,1,-1,3,-1,-2,-2,-1,1,-4,-4,2,-2,0,-2,5,-1,0,-2,5,1,3,1,5,-2,3,-1,3,1,8,3,6,1,5,-1,0,-1,5,0,1,2,7,2,-1,4,0,4,3,3,5,2,4,-4,4,0,1,4,0,3,-2,-1,-3,2,0,3,6,1,6,1,6,-1,5,0,6,3,-6,3,-9,-1,-9,-2,-8,-1,-3,3,-4,2,1,5,-3,4,3,3,4,3,12,6,3,1,-1,2,-6,2,-9,-1,-5,-4,1,-3,-8,-4,-10,-4,-3,-7,3,-4,5,-3,-5,-5,-5,-1,-2,-9,-3,-4,-6,0,-3,-4,-5,0,-2,5,-4,5,-4,7,-3,3,-10,-5,-7,-2,-7,3,-1,5,-2,12,5,3,13,4,10,5,9,7,12,10,8,4,14,6,11,2,8,0,8,4,9,0,9,1,15,-4,-6,-1,6,-3,5,2,8,-3,14,-2,18,-5,4,-3,1,-3,-6,-3,-8,-1,-22,4,-4,-1,8,-3,1,-8,6,-1,4,-2,1,3,-3,2,3,2,12,-3,4,1,-3,3,11,5,5,0,5,-2,3,4,-5,3,3,3,-4,3,14,-2,3,-3,-6,0,0,-3,4,-2,7,1,2,4,10,2,18,4,3,0,-5,-3,7,-1,3,2,10,0,7,2,6,-3,5,4,-5,3,3,1,15,-1,6,-2,19,-6,3,3,-5,3,0,1,-6,0,1,3,-2,4,-1,1,10,5,3,4,4,1,13,-1,1,-3,-5,-4,3,-2,2,-3,-1,-7,5,-3,-2,-3,-10,-7,6,-1,2,2,6,1,1,2,4,3,-3,3,3,3,-6,0,-1,3,4,5,-6,4,8,4,-1,3,3,0,2,-3,-2,-4,6,-1,-2,3,8,2,10,1,9,-3,-4,4,0,5,8,1,12,0,11,1,-4,2,6,4,6,0,9,2,14,1,1,1,13,1,4,-1,12,2,9,0,1,2,5,2,12,2,8,-1,-6,-1,11,-1,1,-3,5,2,14,0,12,-3,4,-2,-2,-2,-5,-2,-13,-3,-4,-1,6,-1,8,-1,4,1,3,-3,2,1,8,1,16,-1,1,-2,21,-1,0,4,11,-1,8,0,8,-3,2,-3,-3,-2,7,-4,7,-2,5,5,8,-2,9,1,9,-1,4,1,8,-1,-3,5,6,2,46,-3,4,-3,13,-4,20,1,10,-1,4,-2,0,-3,6,-2,6,1,9,0,10,-1,9,1,9,-5,6,2,-4,3,2,2,16,-1,11,0,14,-2,-1793,-2;246,206,2,-3,2,0,2,-2,-4,0,-1,-4,-1,-2,-2,-1,0,-2,2,-4,5,-1,3,-3,7,0,8,1,1,1,-1,4,0,5,-3,1,1,4,-4,0,2,4,4,-1,5,2,-4,3,-1,3,-4,-2,-1,-3,-1,3,-1,1,1,2,0,2,-6,2,-3,4,-2,1,0,2,4,0,1,3,4,1,4,-1,1,5,-1,3,-5,0,-4,1,-6,-2,-4,-1,-3,-3,-5,-1,-5,-5,5,-5,-1,-3,6,-6,3,-3;-478,346,-3,-2,-7,1,-4,0,-7,2,4,2,4,2,5,-2,3,-1,2,-1,3,-1;-900,358,1800,-4,-5,0,-1,1,-1794,3;-900,358,1,0,4,0,7,-2,-5,-2,-7,0,0,4;-453,347,0,-5,7,4,6,-3,-2,-4,5,-3,5,4,4,4,0,5,7,0,8,-1,7,-2,0,-3,-4,-2,4,-3,-1,-2,-10,-4,-7,-1,-5,2,-1,-3,-5,-4,-2,-2,-5,-4,-8,0,-4,-2,0,-3,-6,-1,-6,-4,-5,-6,-2,-3,0,-6,7,-1,2,-5,3,-4,7,1,9,-2,5,-2,3,-2,7,-1,5,-2,8,-1,6,0,-1,-5,1,-5,4,-5,7,-5,4,2,3,5,-3,8,-3,2,8,3,6,3,2,4,0,3,-4,4,-6,4,6,5,-2,5,-2,8,4,1,9,-2,5,0,4,1,4,-1,7,-3,1,-2,9,-1,0,-4,2,-6,4,-1,4,-3,7,3,5,5,3,3,4,-5,6,-6,6,-6,-2,-3,7,-3,4,-3,8,-1,3,-2,2,-4,4,-1,2,-2,1,-5,-4,-2,-4,-2,-8,-2,-6,-4,-9,-1,-10,1,-8,0,-5,0,-4,-3,-7,-3,-7,-6,-6,-5,5,1,8,6,10,5,8,0,4,-2,-5,-4,2,-5,2,-4,6,-2,8,0,5,6,1,-4,3,-1,-6,-4,-11,-3,-5,-2,-6,-3,-4,0,0,4,9,4,-8,0,-6,0,1,-2,-5,-2,-5,-2,-6,-2,-2,-3,-1,-1,0,-2,2,-3,2,0,-1,2,2,-1,-1,-2,-3,-1,-3,0,-3,0,-2,-1,-3,0,-5,-1,8,1,1,-1,-7,-2,-3,0,0,1,-1,-2,1,0,-1,-3,-4,-4,0,1,-1,0,-2,1,1,-2,2,-1,0,-2,-2,-2,-3,-4,1,4,-2,2,-1,4,-1,-2,1,-4,-3,1,3,-1,1,-5,1,-1,1,-1,0,-5,-3,-4,-5,-1,-3,-3,-3,-1,-2,-2,-1,-1,-6,-3,-2,-3,-3,-3,0,-3,0,-4,2,-4,2,-4,0,-2,3,-6,0,-3,-1,-2,-1,-3,-1,-1,-3,1,-1,2,-2,1,-2,5,-3,3,0,2,1,4,-2,3,-4,4,-1,0,-6,-2,-3,3,-3,1,-6,-1,-4,1,-4,0,-2,-1,1,-2,0,-2,1,-1,-1,0,-2,1,-2,-1,-3,0,-4,2,-4,0,-4,1,-3,0,-4,-2,-5,-3,-5,-2,-3,-3,-1,-2,0,-4,0,-2,1,-2,-2,-4,-1,-4,0,-6,0,-3,1,-3,1,-2,1,-4,3,-4,2,-2,2,-3,5,-1,2,-2,4,1,4,1,4,1,3,0,3,2,1,3,1,5,1,1,3,1,5,1,5,0,3,1,1,-1,0,-3,-3,-3,-1,-3,1,-1,-1,-2,-1,-4,-1,2,-1,0,0,-1,0,-2,0,-2,0,-1,-1,-1,1,-1,-1,-2,-1,-2,-1,0,-1,-2,2,0,2,0,0,-1,1,1,2,0,1,0,2,0,3,0,1,0,1,1,2,0,1,-1,1,1,1,0,2,-1,1,0,2,-1,1,-1,2,-1,1,-1,0,-2,0,-1,-1,-2,-1,-2,0,-2,1,-2,0,-2,-1,0,-1,-3,1,-1,-1,-1,0,-1,1,-1,1,-3,2,-2,2,-2,2,-2,0,-1,2,0,2,-1,2,0,2,2,3,1,2,1,3,0,0,-1,2,0,3,-1,1,-1,2,-2,3,0,4,4,2,0,0,2,1,4,2,2,4,1,0,1,4,-1,4,3,2,1,2,2,2,0,1,-1,-1,-2,0,-1,-3,-1,2,-2,0,-3,-2,-3,2,-4,2,1,1,3,-2,2,0,4,6,2,0,2,1,2,2,-4,4,0,3,-3,0,-1,5,0,5,0,3,-2,4,-1,2,2,0,1,7,1,6,0,-5,-2,2,-2,4,-1,4,-2,1,-4,2,0,2,-1,4,-2,3,-3,0,-3,2,0,2,-2,2,-2,6,-1,1,1,4,0,5,-1,2,-1,4,-1,5,-4,1,-2,1,0,2,-3,2,-8,3,-1,0,-4,-3,-4,1,-1,9,-1,0,-5,4,3,6,-2,8,-3,3,-3,-1,-2,6,1,10,-3,7,1,7,-5,7,-5,4,-2,4,0,2,-1,2,-7,0,-3,-2,-8,-2,-3,-7,-7,-3,-6,-4,-4,-1,0,-2,-4,1,-9,-2,-8,0,-3,-2,-2,-1,-7,-5,-7,-1,-5,-4,-2,-1,-3,-5,0,-8,-2,-4,-2,-5,-1,-6,-4,-4,-5,-1,-4,1,-3,-1,-5,-1,-2,-4,-3,-5,-9,-5,-4,-3,-2,-3,-5,-3,-3,-2,-3,-6,-3,-3,1,-3,0,-5,2,-3,0,-3,2,0,-2,6,-4,-1,-4,3,-2,0,-3,-5,-6,-7,-3,-10,-1,-6,1,1,-3,-1,-4,1,-2,-3,-2,-5,-1,-5,2,-2,-1,1,-5,3,-2,3,2,2,-3,-5,-1,-4,-3,-1,-6,-1,-2,-5,0,-3,-3,-2,-4,5,-3,5,-1,-2,-5,-6,-2,-3,-6,-5,-2,-2,-3,2,-5,3,-3,-2,1,-4,0,-3,-2,-4,-1,-1,-5,-2,0,-6,1,-6,4,-6,3,-1,3,1,3,-2,3,-1,9,2,4,5,4,-7,2,5,4,1,8,6,-1,2,10,-3,1,-2,-6,-3,1,2,7,2,9,2,4,-2,5,0,5,2,0,3,8,4,8,2,8,-1,7,1,5,0,6,2,6,1,9,2,11,2,11,-1,8,-1,7,-5,3,0,2,-10,5,-9,6,-4,3,-2,4,1,1,-5,7,-4,9,-5,10,-2,2,-2,4,-4,3,-3,2,1,3,-2,4,2,4,3,3,3,4,-1,2,-2,-2,-3,2,1,1,-1,5,2,0,1,4,2,3,0,2,2,1,4,2,-1,1,2,1,0,2,1,2,2,0,2,4,2,2,-1,1,0,3,-1,5,1,1,0,4,-2,3,-2,2,-1,2,1,2,-1,0,-1,2,-3,1,-2,0,-1,-2,-2,-1,-1,-1,0,-1,2,-2,-1,-1,-1,-1,-2,0,-1,3,-1,-1,-2,1,-1,2,-2,0,-1,0,-2,0,0,-1,-1,1,-3,1,-1,1,1,1,0,1,-2,1,-2,1,-1,1,-1,2,-1,0,0,-1,-1,-1,-1,1,-1,1,-1,1,0,1,1,2,-2,0,1,1,-1,2,-3,2,-1,2,-2,1,-2,3,1,0,0,1,-2,1,-1,-1,-2,0,-2,0,-2,1,-3,1,-1,1,-3,1,-3,0,-2,1,-3,2,-6,5,-2,2,-4,1,-3,0,-4,-2,-3,-1,-3,2,-4,1,-5,2,-3,1,-6,2,-4,2,-2,2,-2,0,-5,1,-3,3,-5,3,-2,3,-2,2,2,1,-1,1,2,1,0,2,-2,2,0,2,-2,3,-5,5,-5,4,-2,3,-4,2,-1,1,1,3,-3,1,-3,3,-1,3,-3,1,-3,2,-2,3,0,1,-3,4,-2,4,0,2,-3,2,-2,0,-3,1,-1,-2,1,-2,1,-4,1,-2,4,-4,1,-1,1,0,0,-2,1,0,1,-3,2,-1,1,-2,3,-3,2,-4,1,-3,1,-2,1,-3,2,0,2,-2,2,-2,0,-1,-2,-2,-1,0,-1,3,-4,3,-3,2,-3,2,0,3,-1,3,-2,2,-3,2,-1,-1,-1,2,-3,1,-3,3,2,0,2,2,0,2,-4,3,-3,2,-1,3,-2,3,-3,4,-2,5,0,2,-4,3,-2,1,-1,1,-2,0,-2,2,-5,0,-1,1,-1,3,-5,5,-4,7,0,1,-2,2,-4,4,0,4,-3,3,1,4,0,4,-2,4,2,5,1,9,0,6,-2,5,-1,2,0,1,7,-2,3,-5,1,2,-1,4,-1,4,-1,0,-10,5,-3,2,-9,2,-3,5,1,3,-7,2,-1,4,-6,3,0,3,-2,2,-5,1,-1,5,-7,4,-2,5,-5,0,-8,0,-6,2,-10,5,-5,1,-9,1,-7,0,-10,2,-6,2,-5,-1,1,-3,-3,0,-6,-1,-4,-2,-6,-1,0,3,2,5,5,1,-1,1,-6,-2,-4,-4,-7,-3,4,-3,-5,-3,-6,-2,-5,-2,-1,-2,-8,-3,-1,-2,-6,-2,-3,0,-5,-1,-5,-2,-4,-2,-9,-1,-1,1,6,2,5,2,5,2,6,1,3,2,7,3,1,1,3,2,1,4,3,3,-6,-2,-2,1,-2,-2,-4,3,-1,-2,-2,2,-5,-2,-3,0,0,3,1,2,-4,2,-6,-1,-4,2,-4,2,0,2,-4,2,2,3,4,3,2,3,4,0,4,-1,4,3,3,-1,4,2,-1,2,-3,1,4,2,-3,0,-5,-1,-2,-1,-4,1,-7,-1,-7,1,-2,2,-7,3,7,2,12,3,4,0,-1,-3,11,1,-4,3,-7,2,-3,2,-5,2,-7,2,3,2,9,1,6,2,1,2,5,3,5,0,10,2,4,0,8,3,8,-1,3,-3,3,1,8,0,0,-1,7,-1,5,1,11,-2,10,0,3,-1,7,1,8,-2,5,0,9,-2,8,-2,5,-1,5,3,6,1,7,0,8,2,8,1,3,-2,4,1,1,2,4,0,8,-5,7,4,1,-4,6,1,2,1,6,0,7,-2,12,-2,7,-1,5,1,7,-3,-8,-2,10,-2,13,1,4,1,6,-3,5,2,-5,3,3,1,6,0,4,1,4,-1,5,-3,6,0,9,-2,7,1,8,0,-1,3,5,1,7,-2,0,-5,4,4,4,0,2,5,-6,3,-5,2,0,6,6,4,7,-1,5,-2,6,-6,-4,-2,9,-2;-571,366,-2,-3,11,2,7,-3,5,3,5,-2,4,-5,3,2,-4,5,4,1,5,-1,6,-2,3,-5,2,-3,8,-3,9,-2,0,-2,-9,0,4,-2,-2,-2,-9,1,-9,1,-6,0,-9,-2,-15,-1,-7,0,-2,2,-7,1,-5,0,-6,4,4,0,7,1,7,0,7,1,-10,1,-10,0,-8,0,-2,2,11,2,-7,-1,-9,2,4,4,4,2,13,3,5,-1;-523,367,-4,-3,-8,3,2,1,7,0,3,-1;-382,366,1,-2,-6,0,-5,0,-5,0,-2,0,-5,3,0,1,2,1,12,-1,8,-2;-433,366,4,-3,5,4,12,2,9,-5,-1,-4,10,2,5,2,11,-3,7,-2,1,-2,9,1,5,-3,12,-2,4,-2,5,-5,-9,-2,12,-4,8,-1,7,-4,8,-1,-2,-3,-9,-6,-6,2,-8,5,-6,-1,-1,-3,6,-2,6,-3,2,-1,4,-5,-2,-4,-6,2,-13,4,7,-5,5,-3,1,-1,-13,2,-11,3,-6,2,2,1,-8,3,-7,2,0,-1,-15,-1,-4,2,4,4,9,0,10,0,-1,2,1,3,7,4,-2,3,-2,1,-7,3,-10,1,3,2,-5,3,-5,0,-4,2,-2,-2,-10,0,-18,1,-10,1,-8,1,-5,2,6,2,-7,0,-2,5,4,5,5,2,13,1,-4,-3;-502,369,6,-1,9,1,1,-2,-4,-2,7,-2,-1,-5,-8,-2,-5,1,-3,2,-12,4,0,1,10,0,-6,3,6,2;718,366,-8,0,-10,1,-1,0,5,2,6,0,7,-2,1,-1;-466,364,-5,-4,-6,0,-3,5,0,2,3,2,4,2,11,0,9,-2,-7,-4,-6,-1;-602,357,-13,-2,-3,2,-12,2,2,2,4,4,4,3,-5,3,17,1,7,-1,13,0,5,-2,5,-2,-6,-1,-12,-3,-6,-4,0,-2;754,375,-6,-2,-8,1,-9,2,1,1,9,0,13,-2;-468,375,-3,-2,-7,0,-6,2,3,2,7,1,4,-2,2,-1;725,378,-4,-4,-18,0,-8,-1,-10,3,3,4,6,1,13,-1,18,-2;-492,384,3,-3,0,-2,-2,-4,-8,-1,-5,1,0,3,-9,0,0,4,6,0,7,1,7,0,1,1;-541,381,2,-2,4,1,6,0,0,-3,-3,-2,-16,-1,-13,-2,-8,0,0,2,10,2,-23,-1,-7,1,7,5,5,1,14,-1,9,-3,9,-1,-7,5,4,2,5,-1,2,-2;288,354,-3,-1,-17,1,-1,2,-9,1,-1,3,5,1,0,3,10,4,-4,1,12,4,-2,2,11,3,17,3,17,1,8,2,10,1,3,-2,-3,-2,-18,-2,-15,-3,-16,-4,-7,-5,-8,-5,1,-4,10,-4;-473,385,5,-1,10,0,4,-2,-1,-2,6,-1,3,-1,7,0,7,-1,8,1,10,1,8,0,6,-2,1,-2,-3,-2,-8,-1,-6,1,-14,-1,-11,0,-8,1,-13,1,-2,3,0,2,-5,3,-11,0,-6,2,2,2,11,-1;-581,388,-1,-4,-4,-1,-4,-1,-10,-2,-7,-1,-7,2,8,3,10,4,8,-1,7,1;-469,388,-2,-1,-10,1,-1,1,10,0,3,-1;-551,388,-9,-1,-8,2,4,1,8,1,7,-1,-2,-2;124,389,-12,-2,-8,1,3,2,-3,1,10,1,2,-2,8,-1;-548,393,-6,-1,-9,0,0,1,6,1,2,0,7,-1;-479,390,-8,-1,-4,1,-2,2,0,2,6,0,3,0,6,-2,-1,-2;-500,392,2,-2,-9,0,-8,2,-11,0,5,1,-6,2,0,2,9,-1,14,-2,4,-2;525,392,-28,-2,9,6,4,1,4,-1,13,-2,-2,-2;91,399,17,-4,-13,-2,-3,-4,-4,-1,-2,-4,-6,0,-11,3,4,2,-7,1,-10,4,-4,4,14,2,3,-2,7,0,2,2,7,0,6,-1;127,402,10,-2,-7,-2,-15,-1,-15,1,-1,1,-7,0,-5,3,15,1,8,-1,5,1,12,-1;256,403,-7,-1,-5,0,0,-1,-6,-1,-5,1,2,2,-11,0,10,1,8,0,1,-1,2,1,5,1,8,-1,-2,-1;500,394,-11,0,-14,1,-8,2,-4,4,-7,1,13,3,11,1,9,-2,12,-5,-1,-5;-435,398,6,-1,-7,-2,-9,-4,-9,0,-10,1,-6,2,0,2,4,1,-9,0,-5,2,-4,2,4,2,3,2,6,0,-3,1,12,0,6,-2,9,-1,8,-1,4,-4;-342,416,13,-1,11,0,9,-2,0,-1,-13,-2,-12,-1,-4,-1,11,0,-12,-4,-8,-1,-9,-4,-10,-1,-3,-1,-16,0,7,-1,-3,-1,4,-2,-5,-2,-7,-1,-3,-2,-7,-2,1,-1,8,0,1,-1,-14,-3,-13,1,-15,-1,-7,1,-9,0,-1,3,9,1,-2,4,3,0,13,-2,-7,3,-8,1,4,2,9,1,2,2,-8,2,-2,2,14,0,4,-1,8,2,-11,1,-18,0,-9,1,-4,2,-6,2,-1,1,8,1,5,1,10,0,8,2,6,0,5,-1,4,2,7,1,8,1,16,0,2,-1,15,1,11,0,11,0;-135,418,31,-4,-9,-2,-20,-1,-27,0,3,-1,18,1,15,-2,9,1,5,-1,-6,-3,13,2,24,2,15,-1,3,-3,-20,-3,-3,-1,-16,-1,11,0,-5,-4,-5,-3,1,-6,6,-3,-8,0,-8,-2,9,-3,1,-4,-5,0,6,-5,-11,0,6,-2,-2,-2,-7,0,-7,0,6,-4,0,-2,-9,2,-3,-1,7,-2,6,-3,2,-4,-9,-1,-4,2,-6,3,2,-3,-6,-3,13,0,7,0,-13,-5,-14,-4,-14,-1,-6,0,-5,-2,-7,-6,-11,-3,-3,0,-7,-2,-7,-1,-4,-3,0,-3,-3,-4,-8,-4,2,-3,-2,-5,-3,-5,-7,0,-7,4,-10,0,-5,3,-4,5,-8,6,-3,3,0,5,-7,5,1,3,-3,2,5,6,8,2,2,2,1,4,-6,-2,-3,-1,-4,-1,-6,2,-1,3,2,3,5,0,10,-1,-9,3,-4,2,-5,-1,-4,1,5,5,-3,2,-4,3,-6,6,-6,1,0,3,-13,3,-11,0,-13,0,-13,-1,-5,2,-9,3,13,2,10,0,-21,1,-11,2,0,2,19,3,18,2,2,2,-13,2,4,2,18,3,7,1,-2,2,12,1,15,1,15,0,6,-2,13,3,12,-2,7,0,10,-2,-11,3,0,2,17,3,18,0,6,2,18,0,40,0"};
  let geoCache = null;
  function geo() {
    if (geoCache) return geoCache;
    if (!GEO) throw new Error("Orb3D: dünya verisi bu sürümde yok");
    const bin = atob(GEO.mask), mask = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) mask[i] = bin.charCodeAt(i);
    const coast = GEO.coast.split(";").map(s => {
      const d = s.split(",").map(Number), out = [];
      let x = 0, y = 0;
      for (let i = 0; i < d.length; i += 2) { x += d[i]; y += d[i + 1]; out.push([y / 5, x / 5]); }
      return out;
    });
    geoCache = { mask: mask, coast: coast };
    return geoCache;
  }
  /** Bu nokta karada mı? (1° çözünürlük) */
  function isLand(lat, lon) {
    const m = geo().mask;
    const y = Math.min(179, Math.max(0, Math.floor(90 - lat))), x = ((Math.floor(lon + 180) % 360) + 360) % 360;
    const i = y * 360 + x;
    return (m[i >> 3] >> (i & 7)) & 1;
  }
  function landDots(spacing) {
    const pts = [], d = spacing || 1.6;
    for (let la = -84; la <= 84; la += d) {
      const step = d / Math.max(0.2, Math.cos(la * Math.PI / 180));
      const off = ((la / d) % 2) * step / 2;           // satırları kaydır: ızgara gibi durmasın
      for (let lo = -180 + off; lo < 180; lo += step) if (isLand(la, lo)) pts.push.apply(pts, latLon(la, lo, 1.002));
    }
    return pts;
  }

  /* =====================================================================
   * Motor
   * ===================================================================== */
  function create(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return null;
    const colors = Object.assign({ line: "#ebe6da", accent: "#c98a4b" }, opts.colors || {});
    const pal = {};
    Object.keys(colors).forEach(k => { pal[k] = rgb(colors[k]); });
    const colorOf = c => pal[c || "line"] || rgb(c);
    const F = opts.perspective || 3.4;
    const sizeK = opts.size || 0.32;
    const fx = Object.assign({ spin: 2.6, tilt: 0.9, scale: 0.35, fade: 0.85 }, opts.scrollEffect || {});
    const reduce = opts.reducedMotion !== "ignore" && global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const autoRot = reduce ? 0 : (opts.autoRotate == null ? 0.12 : opts.autoRotate);
    const list = (opts.shapes || []).slice();
    const markers = [], arcs = [];

    let W = 0, H = 0, dpr = 1, running = false, visible = true, destroyed = false;
    let t0 = performance.now(), last = t0, time = 0;
    let px = 0, py = 0, tx = 0, ty = 0;             // fare takibi
    // dragY: yatay dönüş (ay), dragX: eğim (ax). ay = L iken L boylamı öndedir.
    let dragY = opts.startLon != null ? opts.startLon * Math.PI / 180 : 0, dragX = 0, vY = 0, vX = 0, dragging = false;
    let spinA = 0, autoPaused = false, goal = null;
    let progress = 0;
    const baseTilt = opts.tilt == null ? 0.38 : opts.tilt;

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    }

    // Kameradan noktaya giden ışın birim küreye noktadan önce çarpıyor mu?
    function hidden(x, y, z) {
      const dz = z + F, a = x * x + y * y + dz * dz, b = -2 * F * dz, c = F * F - 1;
      const disc = b * b - 4 * a * c;
      if (disc <= 0) return false;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      return t > 0.0005 && t < 0.999;
    }

    // Çizim kovaları: aynı renk + saydamlık tek path'te çizilir (binlerce stroke yerine)
    const LV = 12;
    function bucketsFor() { const b = []; for (let i = 0; i < LV; i++) b.push([]); return b; }

    function frame(now) {
      if (destroyed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; time += dt;
      if (opts.follow !== false) { px += (tx - px) * 0.05; py += (ty - py) * 0.05; }
      if (!autoPaused) spinA += dt * autoRot;
      if (goal) {
        dragY += (goal.y - dragY) * 0.08; dragX += (goal.x - dragX) * 0.08;
        if (Math.abs(goal.y - dragY) + Math.abs(goal.x - dragX) < 0.002) goal = null;
      } else if (!dragging) {
        dragY += vY; dragX += vX; vY *= 0.94; vX *= 0.94;
        if (!autoPaused) dragX *= 0.985;      // bırakınca eğim yavaşça eski hâline döner
      }

      const ay = spinA + progress * fx.spin + px * 0.5 + dragY;
      const ax = baseTilt + progress * fx.tilt + py * 0.35 + dragX;
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      const R = Math.min(W, H) * sizeK * (1 + progress * fx.scale);
      const ox = W / 2, oy = H / 2;
      const fade = 1 - progress * fx.fade;

      ctx.clearRect(0, 0, W, H);
      if (fade <= 0.01) return;

      const proj = (x0, y0, z0, out) => {
        let x = x0 * cy + z0 * sy, z = -x0 * sy + z0 * cy;
        const y = y0 * cx - z * sx; z = y0 * sx + z * cx;
        const s = F / (F + z);
        out[0] = ox + x * R * s; out[1] = oy - y * R * s; out[2] = z; out[3] = s; out[4] = x; out[5] = y;
        return out;
      };
      const A = [0, 0, 0, 0, 0, 0], B = [0, 0, 0, 0, 0, 0];

      for (const sh of list) {
        if (sh.visible === false) continue;
        const col = colorOf(sh.color), al = (sh.alpha == null ? 1 : sh.alpha) * fade;
        if (sh.horizon) {
          // kürenin ekrandaki gerçek kenarı (perspektifle biraz küçülür)
          ctx.strokeStyle = rgba(col, al);
          ctx.lineWidth = Math.max(1, dpr * 0.9) * (sh.width || 1);
          ctx.beginPath(); ctx.arc(ox, oy, R * F / Math.sqrt(F * F - 1) * (sh.radius || 1), 0, Math.PI * 2); ctx.stroke();
          continue;
        }
        const accent = sh.color === "accent";
        const sp = sh.spin ? time * (sh.spin.speed == null ? 0.2 : sh.spin.speed) : 0;
        const spin = sp ? (p => sh.spin.axis === "x" ? rotX(p, sp) : sh.spin.axis === "z" ? rotZ(p, sp) : rotY(p, sp)) : null;
        const backA = sh.backAlpha == null ? 0 : sh.backAlpha;
        // depth: öndekiler daha belirgin (portföydeki gibi)
        const shade = z => { const d = 1 - (z + 1.6) / 3.2; return Math.max(0.05, Math.min(1, d)); };
        const lvl = a => Math.max(0, Math.min(LV - 1, Math.round(a * (LV - 1))));
        // küre üstündeki çizgi ve noktalar kenara yaklaştıkça solsun (kenarda yığılmasın)
        const limb = z => sh.occlude ? Math.max(0.12, Math.min(1, (-z - 1 / F) / 0.32)) : 1;
        const behind = z => F + z < 0.35;   // kameranın arkası ya da çok yakını

        if (sh.lines) {
          const b = bucketsFor();
          for (const l of sh.lines) {
            for (let i = 0; i < l.length; i += 3) {
              let p = [l[i], l[i + 1], l[i + 2]];
              if (spin) p = spin(p);
              proj(p[0], p[1], p[2], B);
              if (i > 0) {
                let a = accent ? 0.25 + shade((A[2] + B[2]) / 2) * 0.75 : (sh.flat ? 1 : 0.13 + shade((A[2] + B[2]) / 2) * 0.87);
                a *= limb(Math.max(A[2], B[2]));
                if (behind(A[2]) || behind(B[2])) a = 0;
                if (sh.occlude) {
                  const hA = hidden(...unproj(A)), hB = hidden(...unproj(B));
                  if (hA || hB) a = backA ? a * backA : 0;
                }
                if (a > 0.01) b[lvl(a)].push(A[0], A[1], B[0], B[1]);
              }
              for (let k = 0; k < 6; k++) A[k] = B[k];
            }
          }
          ctx.lineWidth = Math.max(1, dpr * 0.9) * (sh.width || 1);
          ctx.lineCap = "round";
          for (let k = 0; k < LV; k++) {
            const seg = b[k];
            if (!seg.length) continue;
            ctx.strokeStyle = rgba(col, (k / (LV - 1)) * al);
            ctx.beginPath();
            for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i], seg[i + 1]); ctx.lineTo(seg[i + 2], seg[i + 3]); }
            ctx.stroke();
          }
        }
        if (sh.points) {
          const b = bucketsFor(), pts = sh.points, ds = (sh.dot || 1.4) * dpr;
          for (let i = 0; i < pts.length; i += 3) {
            let p = [pts[i], pts[i + 1], pts[i + 2]];
            if (spin) p = spin(p);
            proj(p[0], p[1], p[2], B);
            if (behind(B[2])) continue;
            let a = (sh.flat ? 1 : 0.15 + shade(B[2]) * 0.85) * limb(B[2]);
            if (sh.occlude && hidden(...unproj(B))) a = backA ? a * backA : 0;
            if (a > 0.01) b[lvl(a)].push(B[0], B[1], Math.min(B[3], 1.8));
          }
          for (let k = 0; k < LV; k++) {
            const seg = b[k];
            if (!seg.length) continue;
            ctx.fillStyle = rgba(col, (k / (LV - 1)) * al);
            ctx.beginPath();
            for (let i = 0; i < seg.length; i += 3) { const s = ds * seg[i + 2]; ctx.rect(seg[i] - s / 2, seg[i + 1] - s / 2, s, s); }
            ctx.fill();
          }
        }
      }

      // yaylar: iki nokta arasında kavis, üstünde yürüyen ışık
      for (const arc of arcs) {
        const col = colorOf(arc.color || "accent");
        let prev = null, prevH = false;
        const n = arc.path.length / 3;
        ctx.lineWidth = Math.max(1, dpr * 1.1) * (arc.width || 1);
        for (let i = 0; i < n; i++) {
          proj(arc.path[i * 3], arc.path[i * 3 + 1], arc.path[i * 3 + 2], B);
          const h = hidden(...unproj(B));
          if (prev && !(h && prevH)) {
            ctx.strokeStyle = rgba(col, (h || prevH ? 0.15 : 0.75) * fade);
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
          }
          prev = [B[0], B[1]]; prevH = h;
        }
        if (!reduce) {
          const k = ((time * (arc.speed || 0.35) + arc.phase) % 1) * (n - 1), i = Math.floor(k);
          proj(arc.path[i * 3], arc.path[i * 3 + 1], arc.path[i * 3 + 2], B);
          if (!hidden(...unproj(B))) {
            ctx.fillStyle = rgba(col, fade);
            ctx.beginPath(); ctx.arc(B[0], B[1], 2.4 * dpr * B[3], 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // işaretler: nabız atan nokta + yazı
      ctx.textBaseline = "middle";
      ctx.font = (opts.labelFont || "500 " + Math.round(11 * dpr) + "px ui-monospace, Menlo, Consolas, monospace");
      // öndeki işaret önce çizilir; yazısı başka bir yazıyla çakışan işaretin yazısı atlanır
      const seen = [], boxes = [];
      for (const m of markers) {
        const o = proj(m.p[0], m.p[1], m.p[2], [0, 0, 0, 0, 0, 0]);
        if (!hidden(o[4], o[5], o[2])) seen.push([m, o]);
      }
      seen.sort((u, v) => u[1][2] - v[1][2]);
      for (const [m, P] of seen) {
        for (let k = 0; k < 6; k++) B[k] = P[k];
        const col = colorOf(m.color || "accent"), s = B[3] * dpr * (m.size || 1);
        // kenara yaklaştıkça soluklaşsın
        const edge = Math.max(0, Math.min(1, -B[2] * 2.2));
        const pulse = reduce ? 0.5 : (time * 0.9 + m.phase) % 1;
        ctx.strokeStyle = rgba(col, (1 - pulse) * 0.8 * fade * edge);
        ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(B[0], B[1], (3 + pulse * 10) * s, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(col, fade * (0.4 + edge * 0.6));
        ctx.beginPath(); ctx.arc(B[0], B[1], 3 * s, 0, Math.PI * 2); ctx.fill();
        if (m.label && opts.labels !== false) {
          const lw = ctx.measureText(m.label).width, lh = 14 * dpr, bx = B[0] + 8 * s, by = B[1] - lh / 2;
          if (boxes.some(q => bx < q[0] + q[2] && bx + lw > q[0] && by < q[1] + q[3] && by + lh > q[1])) continue;
          boxes.push([bx, by, lw, lh]);
          ctx.fillStyle = rgba(colorOf(colors.label ? "label" : "line"), 0.9 * fade * edge);
          ctx.fillText(m.label, B[0] + 8 * s, B[1]);
        }
      }
    }
    // proj çıktısından kamera uzayı koordinatı (gizlilik testi için)
    function unproj(o) { return [o[4], o[5], o[2]]; }

    function loop(now) {
      if (!running || destroyed) return;
      frame(now);
      requestAnimationFrame(loop);
    }
    function setRunning(on) {
      on = on && !destroyed;
      if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
      else if (!on) running = false;
    }
    // hareket yoksa (reduce) yalnızca gerektiğinde bir kare çiz
    const still = reduce;
    function kick() { if (still || !running) frame(performance.now()); }

    /* ---------- olaylar ---------- */
    const off = [];
    const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); off.push(() => t.removeEventListener(ev, f, o)); };
    resize();
    if (global.ResizeObserver) { const ro = new ResizeObserver(() => { resize(); kick(); }); ro.observe(canvas); off.push(() => ro.disconnect()); }
    else on(global, "resize", () => { resize(); kick(); });
    if (opts.follow !== false && !reduce) on(global, "pointermove", e => { tx = e.clientX / global.innerWidth - 0.5; ty = e.clientY / global.innerHeight - 0.5; }, { passive: true });

    if (opts.drag) {
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
      if (getComputedStyle(canvas).pointerEvents === "none") canvas.style.pointerEvents = "auto";
      let lx = 0, ly = 0;
      on(canvas, "pointerdown", e => { dragging = true; goal = null; autoPaused = !!opts.stopOnDrag; lx = e.clientX; ly = e.clientY; vX = vY = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
      on(canvas, "pointermove", e => {
        if (!dragging) return;
        const k = 3 / Math.max(200, canvas.clientWidth);
        // yüzey parmakla birlikte gitsin
        vY = -(e.clientX - lx) * k; vX = -(e.clientY - ly) * k * 0.6;
        dragY += vY; dragX = Math.max(-1.2, Math.min(1.2, dragX + vX));
        lx = e.clientX; ly = e.clientY;
        kick();
      });
      const up = () => { dragging = false; canvas.style.cursor = "grab"; if (still) { vX = vY = 0; } };
      on(canvas, "pointerup", up); on(canvas, "pointercancel", up);
    }

    if (opts.scroll) {
      const el = typeof opts.scroll === "string" ? document.querySelector(opts.scroll) : opts.scroll;
      const upd = () => {
        const r = el.getBoundingClientRect();
        progress = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
        kick();
      };
      on(global, "scroll", upd, { passive: true });
      upd();
    }

    if (opts.pauseOffscreen !== false) {
      if (global.IntersectionObserver) {
        const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; setRunning(visible && !document.hidden && !still); });
        io.observe(canvas); off.push(() => io.disconnect());
      }
      on(document, "visibilitychange", () => setRunning(visible && !document.hidden && !still));
    }

    frame(performance.now());
    if (!still) setRunning(true);

    /* ---------- dışarıya açılan ---------- */
    let mk = 0;
    const api = {
      canvas: canvas,
      add(shape) { list.push(shape); kick(); return shape; },
      remove(shape) { const i = list.indexOf(shape); if (i > -1) list.splice(i, 1); kick(); },
      clear() { list.length = 0; markers.length = 0; arcs.length = 0; kick(); },
      shapes: list,
      /** { lat, lon, label?, color?, size? } */
      addMarker(m) { const o = Object.assign({ p: latLon(m.lat, m.lon, 1.004), phase: (mk++ * 0.37) % 1 }, m); markers.push(o); kick(); return o; },
      removeMarker(m) { const i = markers.indexOf(m); if (i > -1) markers.splice(i, 1); kick(); },
      /** { from: [lat, lon], to: [lat, lon], height?, color?, speed? } */
      addArc(a) {
        const p0 = latLon(a.from[0], a.from[1]), p1 = latLon(a.to[0], a.to[1]);
        const dot = Math.max(-1, Math.min(1, p0[0] * p1[0] + p0[1] * p1[1] + p0[2] * p1[2])), w = Math.acos(dot);
        const h = a.height == null ? 0.12 + w * 0.12 : a.height, path = [];
        for (let i = 0; i <= 64; i++) {
          const t = i / 64, s0 = w ? Math.sin((1 - t) * w) / Math.sin(w) : 1 - t, s1 = w ? Math.sin(t * w) / Math.sin(w) : t;
          const lift = 1 + Math.sin(Math.PI * t) * h;
          path.push((p0[0] * s0 + p1[0] * s1) * lift, (p0[1] * s0 + p1[1] * s1) * lift, (p0[2] * s0 + p1[2] * s1) * lift);
        }
        const o = Object.assign({ path: path, phase: (mk++ * 0.29) % 1 }, a);
        arcs.push(o); kick(); return o;
      },
      removeArc(a) { const i = arcs.indexOf(a); if (i > -1) arcs.splice(i, 1); kick(); },
      /** Kaydırma ilerlemesini elle vermek için (0..1) */
      setProgress(p) { progress = Math.max(0, Math.min(1, p)); kick(); },
      /** Belirli bir noktayı öne çevirir (yumuşakça) */
      focus(lat, lon) {
        // ön: ay = lon; orta enlem: ax = -lat
        let d = (lon * Math.PI / 180 - (spinA + dragY)) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        autoPaused = true; vX = vY = 0;
        goal = { y: dragY + d, x: Math.max(-1.2, Math.min(1.2, -lat * Math.PI / 180 - baseTilt)) };
        if (still) { dragY = goal.y; dragX = goal.x; goal = null; }
        kick();
      },
      /** focus sonrası kendiliğinden dönmeyi sürdür */
      resume() { autoPaused = false; },
      pause() { setRunning(false); },
      play() { if (!still) setRunning(true); },
      render() { frame(performance.now()); },
      destroy() { destroyed = true; running = false; off.forEach(f => f()); ctx.clearRect(0, 0, W, H); }
    };
    (opts.markers || []).forEach(api.addMarker);
    (opts.arcs || []).forEach(api.addArc);
    return api;
  }

  /* ---------- hazır dünya ---------- */
  function globe(canvas, opts) {
    // speed > 0: gerçek dünya yönünde (batıdan doğuya) döner. viewLat: ortadaki enlem.
    opts = Object.assign({ drag: true, speed: 0.08, viewLat: 22, startLon: 30 }, opts || {});
    opts.autoRotate = opts.autoRotate != null ? opts.autoRotate : -opts.speed;
    opts.tilt = opts.tilt != null ? opts.tilt : -opts.viewLat * Math.PI / 180;
    const g = geo(), s = [];
    if (opts.outline !== false) s.push({ horizon: true, color: "line", alpha: 0.35 });
    if (opts.graticule !== false) s.push(shapes.graticule({ step: opts.graticuleStep || 30, color: "line", alpha: 0.16, backAlpha: opts.seeThrough ? 0.4 : 0 }));
    if (opts.dots !== false) s.push({ points: landDots(opts.dotSpacing), color: "land", alpha: 0.85, dot: opts.dotSize || 1.6, occlude: true, backAlpha: opts.seeThrough ? 0.25 : 0 });
    if (opts.coast !== false) s.push(shapes.geoLines(g.coast, { color: "land", alpha: 0.7, width: 1, backAlpha: opts.seeThrough ? 0.2 : 0 }));
    (opts.rings || []).forEach(r => s.push(shapes.ring(Object.assign({ alpha: 0.9 }, r))));
    const o = Object.assign({}, opts, {
      colors: Object.assign({ line: "#ebe6da", accent: "#c98a4b", land: "#ebe6da" }, opts.colors || {}),
      shapes: s.concat(opts.shapes || [])
    });
    return create(canvas, o);
  }

  const Orb3D = { create: create, globe: globe, shapes: shapes, latLon: latLon, isLand: isLand };
  global.Orb3D = Orb3D;
  if (typeof module !== "undefined" && module.exports) module.exports = Orb3D;
})(typeof window !== "undefined" ? window : globalThis);
