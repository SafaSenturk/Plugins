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
  const GEO = /*GEO*/null;
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
