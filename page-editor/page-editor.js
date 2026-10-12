/* =====================================================================
 * PageEditor — De L'Amour site editörünün bağımsız sürümü
 * ---------------------------------------------------------------------
 * Tek dosya, bağımlılık yok. Delamour'daki 68-editor.js + 69-canvas.js +
 * 16-css-editor.js'den çıkarıldı; Firebase, ürün kataloğu ve mağaza
 * router'ı yerine takılabilir "adapter"lar kullanır.
 *
 * Kullanım:
 *   <script src="page-editor.js"></script>
 *   const editor = PageEditor.create({
 *     mount: document.getElementById("app"),
 *     blocks: { hero: {...}, text: {...} },   // blok tipleri (aşağıya bakın)
 *     pages: { home: "Ana sayfa", menu: "Menü ekranı" },
 *     siteCss: "...",                          // önizlemede kullanılacak CSS
 *     storage: PageEditor.localStorage("oyunum"), // ya da kendi adapter'ınız
 *   });
 *
 * Oyunun içinde (editör olmadan) yayındaki sayfayı göstermek için:
 *   const live = await storage.load().then(r => r.live);
 *   el.innerHTML = PageEditor.renderPage(live, "home", { blocks, lang: "tr" });
 *
 * Blok tipi:
 *   {
 *     label: "Kapak", icon: "image", group: "Temel", hint: "…",
 *     variants: [["a","Görünüm A"],["b","Görünüm B"]],     // isteğe bağlı
 *     fields: [ { k:"title", label:"Başlık", type:"text", i18n:true }, … ],
 *     make: () => ({ title: "Yeni başlık" }),            // yeni blok
 *     render: (b, h) => "<section>…</section>"            // HTML döndürür
 *   }
 *   Alan tipleri: text, area, toggle, select, seg, swatch, range, image,
 *                 link, color, number, items (alt alanlı liste)
 *   i18n:true alanlar İngilizce eşini key + "_en" altında saklar.
 *
 *   render'a gelen h yardımcıları:
 *     h.t(obj, "title")    dile göre metin (en boşsa tr'ye düşer)
 *     h.esc(s)             HTML kaçışı
 *     h.rich(s)            **kalın**, *eğik*, [yazı](adres), paragraflar
 *     h.ed("title")        editörde çift tıklayıp yerinde yazma için öznitelik
 *     h.item(key, i)       liste elemanını sürüklenebilir yapan öznitelik
 *     h.itemX(key, i)      editörde elemanı silen × düğmesi
 *     h.addItem(key, label, max)  editörde listenin sonuna "+ Ekle" düğmesi
 *     h.canvas             editörün içinde mi?
 *     h.lang               "tr" | "en"
 *
 * Storage adapter (hepsi Promise döndürebilir):
 *   load()            -> { draft, live }        (ikisi de null olabilir)
 *   saveDraft(doc)
 *   publish(doc)      -> yayınlanan belge ({ rev, publishedAt } eklenmiş)
 *   history()         -> [{ id, rev, publishedAt, ...doc }]   (isteğe bağlı)
 *   upload(file)      -> görsel adresi           (isteğe bağlı; yoksa base64)
 * ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- yardımcılar ---------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const uid = p => (p || "b") + Math.random().toString(36).slice(2, 8);
  const lower = s => String(s || "").toLocaleLowerCase("tr");
  function slugify(s) {
    const map = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" };
    return lower(s).replace(/[çğıöşü]/g, c => map[c] || c).normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
  }
  function getPath(o, path) { return String(path).split(".").reduce((a, k) => (a == null ? undefined : a[k]), o); }
  function setPath(o, path, v) {
    const ks = String(path).split(".");
    let cur = o;
    for (let i = 0; i < ks.length - 1; i++) {
      const k = ks[i];
      if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      cur = cur[k];
    }
    cur[ks[ks.length - 1]] = v;
  }
  // aynı içerik, anahtarları başka sırada: yine aynı içerik
  function stableJSON(v) {
    if (Array.isArray(v)) return "[" + v.map(stableJSON).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + stableJSON(v[k])).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  }
  function bare(d) {
    if (!d) return "";
    const x = clone(d);
    ["rev", "publishedAt", "publishedBy", "updatedAt", "updatedBy", "id"].forEach(k => delete x[k]);
    return stableJSON(x);
  }
  function fmtDate(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return String(ts); }
  }
  // görseli tarayıcıda küçültüp data: adresine çevirir
  function shrinkImage(file, maxW) {
    return new Promise(res => {
      if (!file || !/^image\//.test(file.type)) { res({ err: "Bir görsel dosyası seçin." }); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const png = /png|gif|webp/.test(file.type);
          let q = 0.82, out = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", q);
          if (png && out.length > 380000) out = c.toDataURL("image/jpeg", q);
          while (out.length > 380000 && q > 0.4) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
          res(out.length > 700000 ? { err: "Görsel çok büyük, daha küçük bir dosya deneyin." } : { url: out });
        };
        img.onerror = () => res({ err: "Görsel okunamadı." });
        img.src = fr.result;
      };
      fr.onerror = () => res({ err: "Dosya okunamadı." });
      fr.readAsDataURL(file);
    });
  }

  /* ---------- simgeler ---------- */
  const ICONS = {
    plus: "M12 5v14M5 12h14", stack: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5", file: "M14 3H6v18h12V7l-4-4zM14 3v4h4",
    image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1 1 0 1 0 0-.01", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3", x: "M6 6l12 12M18 6 6 18", chevL: "M15 6l-6 6 6 6",
    upload: "M12 16V4M7 9l5-5 5 5M4 20h16", layout: "M3 4h18v16H3zM3 9h18M9 9v11", lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
    box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10", text: "M5 6h14M5 12h14M5 18h9", grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    button: "M4 8h16v8H4zM9 12h6", list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01", star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z",
    menu: "M4 6h16M4 12h16M4 18h16", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", play: "M7 4l13 8-13 8z",
    chat: "M4 5h16v11H8l-4 4z", check: "M4 12l5 5L20 6", gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6.3 7.3 4 7l-1 3 2 1v2l-2 1 1 3 2-.3 1.4 1.4-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3-2-1z",
    tags: "M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01", columns: "M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z", spacer: "M4 4h16M4 20h16M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3",
    code: "M8 7l-5 5 5 5M16 7l5 5-5 5", question: "M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01"
  };
  function ico(name) {
    const d = ICONS[name] || ICONS.box;
    return '<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  /* ---------- zengin metin ---------- */
  function linkAttrs(href) {
    href = String(href || "").trim();
    if (/^#[\w-]+$/.test(href)) return ' href="' + esc(href) + '"';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return ' href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"';
    if (/^\/|^[\w-]+(\.html)?$/.test(href)) return ' href="' + esc(href) + '" data-go="' + esc(href) + '"';
    return ' href="#"';
  }
  function richInline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => "<a" + linkAttrs(url.replace(/&amp;/g, "&")) + ">" + txt + "</a>");
  }
  function richParas(txt) {
    return String(txt || "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      .map(p => "<p>" + richInline(p).replace(/\n/g, "<br>") + "</p>").join("");
  }

  /* ---------- sayfayı çizmek (editörde ve oyunda aynı kod) ---------- */
  const LOOK = {
    pad: [["", "Normal"], ["0", "Yok"], ["s", "Az"], ["l", "Çok"]],
    bg: [["", "Yok"], ["soft", "Açık"], ["surface", "Beyaz"], ["dark", "Koyu"], ["accent", "Vurgu"]],
    hide: [["", "Her yerde"], ["phone", "Telefonda gizle"], ["desktop", "Bilgisayarda gizle"]]
  };
  function helpers(lang, canvas) {
    return {
      lang: lang, canvas: canvas, esc: esc, rich: richParas, richInline: richInline, link: linkAttrs,
      t: (o, k) => { if (!o) return ""; if (lang === "en" && o[k + "_en"]) return o[k + "_en"]; return o[k] == null ? "" : o[k]; },
      ed: k => canvas ? ' data-e="' + esc(k) + '"' : "",
      item: (key, i) => canvas ? ' data-item="' + esc(key) + "." + i + '"' : "",
      itemX: (key, i) => canvas ? '<button class="cv-x" data-rmitem="' + esc(key) + "." + i + '" title="Kaldır" aria-label="Kaldır">×</button>' : "",
      addItem: (key, label, max, n) => canvas && !(max && n >= max) ? '<button class="cv-additem" data-additem="' + esc(key) + '"><span>+</span>' + esc(label || "Ekle") + "</button>" : ""
    };
  }
  function renderBlock(b, blocks, h) {
    const T = blocks[b.type];
    if (!T || (b.hidden && !h.canvas)) return "";
    let html = "";
    try { html = T.render(b, h) || ""; } catch (e) { console.warn("PageEditor blok " + b.type + ": " + (e && e.message)); }
    let cls = "";
    if (b.pad) cls += " pad-" + b.pad;
    if (b.bg) cls += " bg-" + b.bg;
    if (b.hide) cls += " hide-" + b.hide;
    if (html) html = '<div class="pe-bx' + cls + '"' + (b.anchor ? ' id="' + esc(slugify(b.anchor)) + '"' : "") + ">" + html + "</div>";
    if (h.canvas) html = '<div class="bw' + (b.hidden ? " is-hidden" : "") + '" data-bid="' + esc(b.id) + '" data-btype="' + esc(b.type) + '">' +
      (html || '<div class="cv-empty">' + esc(T.label || b.type) + " — boş</div>") + "</div>";
    return html;
  }
  function pageOf(doc, key) {
    if (!doc) return null;
    if (String(key).indexOf("custom:") === 0) return (doc.custom || []).find(p => p.slug === key.slice(7)) || null;
    return (doc.pages || {})[key] || null;
  }
  function renderPage(doc, key, opts) {
    opts = opts || {};
    const h = helpers(opts.lang || "tr", !!opts.canvas);
    const pg = pageOf(doc, key || "home");
    if (!pg) return "";
    if (pg.active === false && !opts.canvas) return "";
    const title = h.t(pg, "title");
    const head = String(key).indexOf("custom:") === 0 && pg.showTitle !== false && title
      ? '<header class="cpage"><h1' + h.ed("@title") + ">" + esc(title) + "</h1></header>" : "";
    return head + (pg.blocks || []).map(b => renderBlock(b, opts.blocks || {}, h)).join("");
  }
  function themeCss(theme) {
    const th = theme || {}, c = th.colors || {};
    const v = [];
    if (c.paper) v.push("--pe-paper:" + c.paper);
    if (c.surface) v.push("--pe-surface:" + c.surface);
    if (c.ink) v.push("--pe-ink:" + c.ink);
    if (c.accent) v.push("--pe-accent:" + c.accent);
    if (c.band) v.push("--pe-band:" + c.band);
    if (th.font) v.push("--pe-head-font:" + th.font);
    v.push("--pe-radius:" + ({ soft: "8px", round: "18px" }[th.radius] || "0px"));
    return ":root{" + v.join(";") + "}";
  }

  // önizlemenin ve oyunun ortak temel stilleri: blokların zemin/boşluk ayarları
  const BASE_CSS = `
:root{--pe-paper:#fff;--pe-surface:#fff;--pe-ink:#1B1E26;--pe-accent:#2563EB;--pe-band:#14161c;--pe-head-font:inherit;--pe-radius:0px}
.pe-bx{padding:48px 0}.pe-bx.pad-0{padding:0}.pe-bx.pad-s{padding:20px 0}.pe-bx.pad-l{padding:96px 0}
.pe-bx.bg-soft{background:color-mix(in srgb,var(--pe-paper) 92%,var(--pe-ink))}.pe-bx.bg-surface{background:var(--pe-surface)}
.pe-bx.bg-dark{background:var(--pe-band);color:#fff}.pe-bx.bg-accent{background:var(--pe-accent);color:#fff}
@media (max-width:760px){.pe-bx.hide-phone{display:none}}
@media (min-width:761px){.pe-bx.hide-desktop{display:none}}
.cpage{max-width:960px;margin:0 auto;padding:40px 20px 0}.cpage h1{font-family:var(--pe-head-font);margin:0}
`;

  /* ---------- tuvalin (iframe) içindeki stiller ---------- */
  const CANVAS_CSS = `
html.canvas a,html.canvas button,html.canvas summary,html.canvas label{cursor:default}
html.canvas [data-e]{cursor:text}
html.canvas .bw{cursor:grab;position:relative}
html.canvas .bw.is-hidden{opacity:.35;filter:grayscale(.7)}
@media (max-width:760px){html.canvas .pe-bx.hide-phone{display:block;opacity:.35}}
@media (min-width:761px){html.canvas .pe-bx.hide-desktop{display:block;opacity:.35}}
html.canvas #pe-root{-webkit-user-select:none;user-select:none;min-height:100vh}
html.canvas #pe-root img,html.canvas #pe-root a{-webkit-user-drag:none}
html.canvas [data-item]{position:relative}
.cv-empty{padding:28px;text-align:center;border:1.5px dashed #C5CBD6;color:#7C8494;font:13px "Helvetica Neue",Helvetica,Arial,sans-serif;margin:8px}
.cv-blank{padding:80px 20px;text-align:center;color:#7C8494;font:15px "Helvetica Neue",Helvetica,Arial,sans-serif}
.cv{position:absolute;z-index:2147483000;pointer-events:none;display:none;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.cv-hover{outline:1.5px dashed #2563EB;outline-offset:-1.5px}
.cv-tag{position:absolute;left:0;top:-22px;background:#2563EB;color:#fff;font-size:11px;font-weight:500;line-height:1;padding:5px 8px;border-radius:5px 5px 0 0;white-space:nowrap}
.cv-sel{outline:2px solid #2563EB;outline-offset:-2px}
.cv-tools{position:absolute;right:0;top:-33px;display:flex;align-items:center;gap:1px;background:#2563EB;color:#fff;border-radius:7px 7px 0 0;padding:3px;pointer-events:auto;font-size:12px;font-weight:500;line-height:1;box-shadow:0 -2px 10px rgba(37,99,235,.3)}
.cv-sel.tools-in .cv-tools{top:6px;right:6px;border-radius:7px}
.cv-tools button,.cv-grip{background:transparent;border:0;color:#fff;font:inherit;padding:7px 8px;border-radius:5px;cursor:pointer;white-space:nowrap}
.cv-tools button:hover{background:rgba(255,255,255,.2)}
.cv-grip{cursor:grab;letter-spacing:-3px}
.cv-name{padding:0 8px 0 4px;white-space:nowrap}
.cv-add{position:absolute;left:50%;bottom:-16px;transform:translateX(-50%);pointer-events:auto;background:#2563EB;color:#fff;border:2px solid #fff;border-radius:999px;font-size:12px;font-weight:600;padding:7px 13px;cursor:pointer;box-shadow:0 3px 10px rgba(37,99,235,.35);white-space:nowrap}
.cv-line{height:4px;background:#2563EB;border-radius:2px;box-shadow:0 0 0 4px rgba(37,99,235,.18)}
.cv-dragging,.cv-dragging *{cursor:grabbing !important;user-select:none !important}
.cv-editing{outline:2px solid #F59E0B !important;outline-offset:4px;background:rgba(245,158,11,.1);white-space:pre-wrap;cursor:text !important;-webkit-user-select:text;user-select:text}
.cv-x{position:absolute;top:6px;right:6px;z-index:6;width:26px;height:26px;border-radius:50%;border:2px solid #fff;background:#1B1E26;color:#fff;font-size:16px;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);padding:0}
html.canvas [data-item]:hover > .cv-x{display:flex}
.cv-x:hover{background:#B42318}
.cv-additem{display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #2563EB !important;background:rgba(37,99,235,.05) !important;color:#2563EB !important;font:600 13px "Helvetica Neue",Helvetica,Arial,sans-serif;border-radius:8px;padding:14px 18px;cursor:pointer;min-height:52px;width:100%}
.cv-additem > span{font-size:20px;font-weight:400;line-height:1}
.cv-additem:hover{background:rgba(37,99,235,.11) !important}
.cv-dragitem{opacity:.35}
.cv-droptarget{outline:2px dashed #2563EB !important;outline-offset:4px}
`;

  /* ---------- editörün kendi stilleri ---------- */
  const EDITOR_CSS = `
.pe{--e-ink:#1B1E26;--e-ink2:#4B5262;--e-ink3:#7C8494;--e-line:#DCE0E8;--e-line2:#C5CBD6;--e-bg:#F4F6F9;--e-blue:#2563EB;--e-blue-bg:#E8EFFD;--e-red:#B42318;--e-amber:#9A6700;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--e-ink);font-size:14px;font-weight:400;line-height:1.45;
  position:relative;display:flex;flex-direction:column;height:100%;min-height:520px;background:#E9ECF2;overflow:hidden}
.pe *{box-sizing:border-box}
.pe.pe-fixed{position:fixed;inset:0;z-index:9000}
.pe svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;flex:none}
.pe button{font:inherit;color:inherit}
.pe-gate{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
.pe .ubtn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--e-line2);background:#fff;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:.86rem;white-space:nowrap;text-decoration:none;color:var(--e-ink)}
.pe .ubtn:hover{border-color:var(--e-ink3)}
.pe .ubtn.primary{background:var(--e-blue);border-color:var(--e-blue);color:#fff}
.pe .ubtn.primary:disabled{opacity:.5;cursor:default}
.pe .ubtn.danger{color:var(--e-red)}
.ed-top{height:54px;flex:none;display:flex;align-items:center;gap:8px;padding:0 12px;background:#fff;border-bottom:1px solid var(--e-line);white-space:nowrap}
.ed-back{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:var(--e-ink2);padding:7px 8px;border-radius:6px;cursor:pointer}
.ed-back:hover{background:var(--e-bg)}
.ed-title{font-weight:600;margin-right:6px}
.ed-page{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--e-line2);border-radius:7px;padding:0 4px 0 9px;background:#fff}
.ed-page select{border:0;background:transparent;font:inherit;padding:8px 4px;max-width:230px;cursor:pointer}
.ed-seg{display:inline-flex;background:var(--e-bg);border:1px solid var(--e-line);border-radius:8px;padding:2px}
.ed-seg button{border:0;background:transparent;padding:6px 10px;border-radius:6px;cursor:pointer;color:var(--e-ink2);font-size:.86rem}
.ed-seg button[aria-pressed="true"]{background:#fff;color:var(--e-ink);box-shadow:0 1px 2px rgba(0,0,0,.12);font-weight:600}
.ed-seg.wide{display:flex;flex-wrap:wrap}
.ed-seg.wide button{flex:1 1 auto}
.ed-sp{flex:1}
.ed-small{display:none !important}
.ed-ic{border:1px solid var(--e-line2);background:#fff;border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:1.05rem}
.ed-ic:disabled{opacity:.35;cursor:default}
.ed-status{font-size:.8rem;color:var(--e-ink3);padding:0 6px}
.ed-status.s-dirty,.ed-status.s-saving{color:var(--e-amber)}
.ed-status.s-error{color:var(--e-red);font-weight:600}
.ed-link{background:none;border:0;color:var(--e-blue);text-decoration:underline;cursor:pointer;padding:0;font-size:inherit}
.ed-main{flex:1;min-height:0;display:grid;grid-template-columns:272px minmax(0,1fr) 330px}
.ed-left,.ed-right{background:#fff;min-height:0;display:flex;flex-direction:column}
.ed-left{border-right:1px solid var(--e-line)}
.ed-right{border-left:1px solid var(--e-line)}
.ed-stage{min-height:0;overflow:hidden;display:flex;justify-content:center;padding:14px}
.ed-frame{width:100%;height:100%;background:#fff;box-shadow:0 1px 3px rgba(20,24,33,.08),0 14px 36px -16px rgba(20,24,33,.3);transition:width .3s ease;border-radius:4px;overflow:hidden}
.pe.d-tablet .ed-frame{width:820px;max-width:100%}
.pe.d-phone .ed-frame{width:390px;max-width:100%;border-radius:22px;border:8px solid #1B1E26}
.ed-frame iframe{width:100%;height:100%;border:0;display:block;background:#fff}
.ed-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--e-line);flex:none}
.ed-tabs button{border:0;background:none;padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:.74rem;color:var(--e-ink3);cursor:pointer;border-bottom:2px solid transparent}
.ed-tabs button[aria-selected="true"]{color:var(--e-blue);border-bottom-color:var(--e-blue);font-weight:600}
.ed-leftbody{overflow:auto;padding:12px 14px 30px;flex:1}
.ed-hint{font-size:.8rem;color:var(--e-ink3);margin:4px 0 12px;line-height:1.5}
.ed-hint.on{color:var(--e-blue);background:var(--e-blue-bg);padding:8px 10px;border-radius:7px}
.ed-gh{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--e-ink3);margin:16px 0 8px;font-weight:600}
.ed-palette{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ed-tile{display:flex;flex-direction:column;align-items:center;gap:7px;padding:13px 6px 11px;border:1px solid var(--e-line);background:#fff;border-radius:9px;cursor:grab;font-size:.8rem;text-align:center;color:var(--e-ink2)}
.ed-tile svg{width:20px;height:20px;color:var(--e-blue)}
.ed-tile:hover{border-color:var(--e-blue);color:var(--e-ink);box-shadow:0 2px 8px rgba(37,99,235,.12)}
.ed-layer{display:flex;align-items:center;gap:9px;padding:8px 8px;border-radius:7px;cursor:pointer;border:1px solid transparent;margin-bottom:2px}
.ed-layer:hover{background:var(--e-bg)}
.ed-layer.on{background:var(--e-blue-bg);border-color:#BFD2FB}
.ed-layer.is-off{opacity:.55}
.ed-layer.fixed{color:var(--e-ink2);font-size:.86rem}
.ed-layer > span:not(.ed-grip){flex:1;min-width:0;display:flex;flex-direction:column}
.ed-layer b{font-weight:500;font-size:.86rem}
.ed-layer small{color:var(--e-ink3);font-size:.74rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ed-grip{color:var(--e-ink3);cursor:grab;letter-spacing:-3px;font-size:.8rem}
.ed-layer.dragging{opacity:.4}
.ed-layer.drop-above{box-shadow:0 -3px 0 var(--e-blue)}
.ed-layer.drop-below{box-shadow:0 3px 0 var(--e-blue)}
.ed-layers{border-top:1px solid var(--e-line);border-bottom:1px solid var(--e-line);padding:6px 0;margin:6px 0}
.ed-eye{border:0;background:none;color:var(--e-ink3);cursor:pointer;padding:4px 6px;border-radius:5px;font-size:.72rem}
.ed-eye:hover{background:#fff;color:var(--e-ink)}
.ed-pages{display:flex;flex-direction:column;gap:2px}
.ed-pagerow{display:flex;align-items:center;border-radius:7px}
.ed-pagerow > button:first-child{flex:1;display:flex;align-items:center;gap:9px;border:0;background:none;text-align:left;padding:8px;cursor:pointer;border-radius:7px}
.ed-pagerow > button:first-child span{display:flex;flex-direction:column}
.ed-pagerow small{color:var(--e-ink3);font-size:.74rem}
.ed-pagerow em{font-style:normal;color:var(--e-red);font-size:.72rem}
.ed-pagerow:hover{background:var(--e-bg)}
.ed-pagerow.on{background:var(--e-blue-bg)}
.ed-newpage{display:flex;gap:6px;margin-top:14px}
.ed-newpage input{flex:1;min-width:0;border:1px solid var(--e-line2);border-radius:7px;padding:8px 9px;font:inherit}
.ed-presets{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ed-preset{border:1px solid var(--e-line);background:#fff;border-radius:9px;padding:10px;cursor:pointer;text-align:left;font-size:.8rem;display:flex;flex-direction:column;gap:7px}
.ed-preset.on{border-color:var(--e-blue);box-shadow:0 0 0 2px var(--e-blue-bg)}
.ed-preset .dots{display:flex;gap:4px}
.ed-preset .dots i{width:18px;height:18px;border-radius:50%;border:1px solid rgba(0,0,0,.12)}
.ed-colors{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ed-color{display:flex;align-items:center;gap:8px;font-size:.8rem;cursor:pointer}
.ed-color input{width:34px;height:30px;border:1px solid var(--e-line2);border-radius:6px;padding:2px;background:#fff;cursor:pointer}
.ed-rhead{padding:14px 16px 4px;border-bottom:1px solid var(--e-line);position:relative}
.ed-rhead h3{margin:0 0 6px;font-size:1rem;display:flex;align-items:center;gap:8px}
.ed-rhead h3 svg{color:var(--e-blue)}
.ed-close{display:none;position:absolute;right:10px;top:10px;border:0;background:var(--e-bg);border-radius:6px;padding:6px;cursor:pointer}
.ed-rbody{overflow:auto;padding:12px 16px 40px;flex:1}
.ed-empty{text-align:center;color:var(--e-ink2);padding:24px 6px}
.ed-empty > svg{width:34px;height:34px;color:var(--e-line2)}
.ed-empty ul{text-align:left;font-size:.85rem;line-height:1.7;padding-left:18px;color:var(--e-ink2)}
.ed-f{margin:0 0 14px;display:flex;flex-direction:column;gap:6px}
.ed-f > label{font-size:.78rem;font-weight:600;color:var(--e-ink2)}
.ed-f small,.ed-tog + small{font-size:.74rem;color:var(--e-ink3);line-height:1.45}
.ed-en{font-style:normal;font-size:.68rem;background:var(--e-blue-bg);color:var(--e-blue);padding:1px 5px;border-radius:4px}
.ed-in{border:1px solid var(--e-line2);border-radius:7px;padding:8px 10px;font:inherit;background:#fff;width:100%;color:var(--e-ink)}
.ed-in:focus{outline:2px solid var(--e-blue-bg);border-color:var(--e-blue)}
textarea.ed-in{resize:vertical;line-height:1.5}
.ed-tog{display:flex;align-items:center;gap:9px;margin:0 0 12px;cursor:pointer;font-size:.86rem}
.ed-tog input{width:16px;height:16px;accent-color:var(--e-blue)}
.ed-range{display:flex;align-items:center;gap:10px}
.ed-range input{flex:1;accent-color:var(--e-blue)}
.ed-range output{font-size:.8rem;color:var(--e-ink2);min-width:54px;text-align:right}
.ed-variants{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.ed-variants button{border:1px solid var(--e-line2);background:#fff;border-radius:8px;padding:9px 6px;cursor:pointer;font-size:.8rem}
.ed-variants button[aria-pressed="true"]{border-color:var(--e-blue);background:var(--e-blue-bg);color:var(--e-blue);font-weight:600}
.ed-swatches{display:flex;flex-wrap:wrap;gap:6px}
.ed-swatches button{display:flex;align-items:center;gap:6px;border:1px solid var(--e-line);background:#fff;border-radius:999px;padding:4px 9px 4px 4px;cursor:pointer;font-size:.74rem}
.ed-swatches button[aria-pressed="true"]{border-color:var(--e-blue);box-shadow:0 0 0 2px var(--e-blue-bg)}
.ed-swatches i{width:16px;height:16px;border-radius:50%;border:1px solid rgba(0,0,0,.12);background:#fff}
.ed-img{display:flex;gap:10px;align-items:center}
.ed-img img,.ed-img .noimg{width:74px;height:56px;object-fit:cover;border:1px solid var(--e-line);border-radius:6px;background:var(--e-bg);font-size:.7rem;color:var(--e-ink3);display:flex;align-items:center;justify-content:center;text-align:center}
.ed-img > div{display:flex;gap:6px;flex-wrap:wrap}
.ed-linkf{display:flex;flex-direction:column;gap:6px}
.ed-items{display:flex;flex-direction:column;gap:6px}
.ed-item{border:1px solid var(--e-line);border-radius:8px;background:#fff}
.ed-item summary{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 10px;cursor:pointer;font-size:.84rem;list-style:none}
.ed-item summary::-webkit-details-marker{display:none}
.ed-item summary > span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.ed-itemacts{display:flex;gap:2px}
.ed-itemacts button{border:0;background:none;padding:4px 6px;border-radius:5px;cursor:pointer;color:var(--e-ink3)}
.ed-itemacts button:hover{background:var(--e-bg);color:var(--e-ink)}
.ed-itembody{padding:4px 10px 2px;border-top:1px solid var(--e-line)}
.ed-more{border-top:1px solid var(--e-line);margin-top:8px;padding-top:10px}
.ed-more summary{cursor:pointer;font-size:.8rem;font-weight:600;color:var(--e-ink2);margin-bottom:12px}
.ed-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.ed-acts.end{justify-content:flex-end;align-items:center}
.ed-slug{display:flex;align-items:center;gap:4px;font-size:.84rem;color:var(--e-ink3)}
.ed-modal{position:absolute;inset:0;background:rgba(20,24,33,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.ed-modal-in{background:#fff;border-radius:12px;padding:22px 24px;width:min(480px,100%);max-height:84%;overflow:auto;box-shadow:0 24px 60px -20px rgba(0,0,0,.5)}
.ed-modal-in h3{margin:0 0 10px;font-size:1.1rem}
.ed-modal-in p{color:var(--e-ink2);margin:0 0 12px}
.ed-hist{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.ed-histrow{display:flex;align-items:center;gap:10px;border:1px solid var(--e-line);border-radius:8px;padding:9px 10px}
.ed-histrow span{flex:1;display:flex;flex-direction:column}
.ed-histrow small{color:var(--e-ink3);font-size:.76rem}
.pe-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:#1B1E26;color:#fff;padding:10px 16px;border-radius:8px;font-size:.86rem;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90%}
.pe-toast.bad{background:var(--e-red)}
@media (max-width:1180px){
  .ed-main{grid-template-columns:240px minmax(0,1fr)}
  .ed-right{position:absolute;right:0;top:54px;bottom:0;width:min(340px,92%);z-index:20;transform:translateX(102%);transition:transform .25s;box-shadow:-12px 0 30px -18px rgba(0,0,0,.4)}
  .pe.panel-open .ed-right{transform:none}
  .ed-close{display:block}
  .ed-title,.ed-back span{display:none}
}
@media (max-width:760px){
  .ed-top{overflow-x:auto}
  .ed-main{grid-template-columns:minmax(0,1fr)}
  .ed-left{position:absolute;left:0;top:54px;bottom:0;width:min(300px,86%);z-index:19;box-shadow:12px 0 30px -18px rgba(0,0,0,.4);transform:translateX(-102%);transition:transform .25s}
  .pe.left-open .ed-left{transform:none}
  .ed-small{display:inline-flex !important}
  .ed-stage{padding:6px}
}
`;

  const DEVICES = [["desktop", "Bilgisayar"], ["tablet", "Tablet"], ["phone", "Telefon"]];
  const LEFT_TABS = [["add", "Ekle", "plus"], ["layers", "Katmanlar", "stack"], ["pages", "Sayfalar", "file"], ["theme", "Tema", "image"]];
  const DEFAULT_PRESETS = [
    ["acik", "Açık", { paper: "#ffffff", surface: "#ffffff", ink: "#1B1E26", accent: "#2563EB", band: "#14161c" }],
    ["gece", "Gece", { paper: "#0f1117", surface: "#181b24", ink: "#EEF0F5", accent: "#F59E0B", band: "#05060a" }],
    ["orman", "Orman", { paper: "#F4F1EA", surface: "#ffffff", ink: "#1F2A1F", accent: "#3F7D4E", band: "#1F2A1F" }],
    ["sakiz", "Sakız", { paper: "#FFF5F8", surface: "#ffffff", ink: "#3A1D2B", accent: "#E0457B", band: "#3A1D2B" }]
  ];
  const DEFAULT_FONTS = [["", "Sitenin yazı tipi"], ["Georgia, serif", "Georgia (tırnaklı)"], ["'Trebuchet MS', sans-serif", "Trebuchet"], ["'Courier New', monospace", "Daktilo"], ["Impact, sans-serif", "Impact"]];
  const PAGE_FIELDS = [
    { k: "title", label: "Sayfa adı", type: "text", i18n: true },
    { k: "active", label: "Yayında", type: "toggle", def: true, help: "Kapalıyken ziyaretçiler bu sayfayı göremez." },
    { k: "showTitle", label: "Sayfa başlığını göster", type: "toggle", def: true }
  ];
  const LOOK_FIELDS = [
    { k: "pad", label: "Üst ve alt boşluk", type: "seg", opts: LOOK.pad },
    { k: "bg", label: "Zemin", type: "seg", opts: LOOK.bg },
    { k: "hide", label: "Görünürlük", type: "seg", opts: LOOK.hide },
    { k: "anchor", label: "Bölüm adı", type: "text", help: "Bir bağlantıya #ad yazarak bu bloğa kaydırabilirsiniz." }
  ];

  /* =====================================================================
   * Editör
   * ===================================================================== */
  function create(opts) {
    opts = opts || {};
    const BLOCKS = opts.blocks || {};
    const GROUPS = opts.groups || Array.from(new Set(Object.keys(BLOCKS).map(k => BLOCKS[k].group || "Bloklar")));
    const PAGES = opts.pages || { home: "Ana sayfa" };
    const LANGS = opts.langs || ["tr"];
    const PRESETS = opts.themePresets || DEFAULT_PRESETS;
    const FONTS = opts.fonts || DEFAULT_FONTS;
    const store = opts.storage || localStore("page-editor");
    const allowCustom = opts.customPages !== false;
    const DESIGN_MAX = opts.maxSize || 950000;
    const mount = typeof opts.mount === "string" ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) throw new Error("PageEditor: mount bulunamadı");

    const ED = {
      ready: false, loading: false, err: "",
      draft: null, live: null,
      page: Object.keys(PAGES)[0] || "home",
      sel: null, lang: LANGS[0], device: "desktop", left: "add", insertAfter: null,
      undo: [], redo: [], lastKey: "", lastAt: 0,
      save: "saved", saveTimer: null, saveErr: "",
      modal: null, history: null, panelOpen: false, destroyed: false
    };
    const listeners = [];
    function on(target, type, fn, o) { target.addEventListener(type, fn, o); listeners.push([target, type, fn, o]); }

    // stiller bir kez
    if (!document.getElementById("pe-editor-css")) {
      const s = document.createElement("style");
      s.id = "pe-editor-css"; s.textContent = EDITOR_CSS;
      document.head.appendChild(s);
    }
    const root = document.createElement("div");
    root.className = "pe d-desktop" + (opts.fullscreen ? " pe-fixed" : "");
    mount.appendChild(root);
    const $ = s => root.querySelector(s);
    const $$ = s => Array.from(root.querySelectorAll(s));

    let toastTimer = null;
    function toast(msg, bad) {
      let el = $(".pe-toast");
      if (!el) { el = document.createElement("div"); root.appendChild(el); }
      el.className = "pe-toast" + (bad ? " bad" : "");
      el.textContent = msg;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.remove(), bad ? 4200 : 2600);
    }
    const tf = (o, k) => { if (!o) return ""; if (ED.lang !== LANGS[0] && o[k + "_" + ED.lang]) return o[k + "_" + ED.lang]; return o[k] == null ? "" : o[k]; };
    const altLang = () => ED.lang !== LANGS[0];

    /* ---------- belge ---------- */
    function defaultDoc() {
      const d = { pages: {}, custom: [], theme: {} };
      Object.keys(PAGES).forEach(k => {
        const make = opts.defaultBlocks && opts.defaultBlocks[k];
        d.pages[k] = { blocks: (make ? (typeof make === "function" ? make() : clone(make)) : []).map(b => Object.assign({ id: uid("b") }, b)) };
      });
      return d;
    }
    function normalize(d) {
      d = clone(d || {});
      d.pages = d.pages || {};
      Object.keys(PAGES).forEach(k => { d.pages[k] = d.pages[k] || { blocks: [] }; d.pages[k].blocks = d.pages[k].blocks || []; });
      d.custom = (d.custom || []).map(p => Object.assign({ blocks: [] }, p));
      d.theme = d.theme || {};
      const fix = list => list.forEach(b => { if (!b.id) b.id = uid("b"); });
      Object.keys(d.pages).forEach(k => fix(d.pages[k].blocks));
      d.custom.forEach(p => fix(p.blocks));
      return d;
    }

    /* ---------- nerede ne var ---------- */
    const isCustom = () => ED.page.indexOf("custom:") === 0;
    function customPage(slug) { return (ED.draft.custom || []).find(pg => pg.slug === (slug || ED.page.slice(7))) || null; }
    function blocksHere() {
      if (isCustom()) { const pg = customPage(); return pg ? pg.blocks : []; }
      const pg = ED.draft.pages[ED.page];
      return pg ? pg.blocks : [];
    }
    function blockById(id) { return blocksHere().find(b => b.id === id) || null; }
    function targetOf(sel) {
      if (!sel || !ED.draft) return null;
      if (sel.kind === "block") return blockById(sel.id);
      if (sel.kind === "page") return customPage();
      return null;
    }
    const target = () => targetOf(ED.sel);
    function fieldsOf(sel) {
      if (!sel) return [];
      if (sel.kind === "page") return PAGE_FIELDS;
      if (sel.kind === "block") {
        const b = blockById(sel.id);
        if (!b) return [];
        return ((BLOCKS[b.type] || {}).fields || []).concat(LOOK_FIELDS);
      }
      return [];
    }
    function fieldAt(sel, path) {
      const ks = String(path).split(".");
      let fields = fieldsOf(sel), f = null;
      for (let i = 0; i < ks.length; i++) {
        if (/^\d+$/.test(ks[i])) continue;
        f = (fields || []).find(x => x.k === ks[i]) || null;
        if (!f) return null;
        fields = f.fields;
      }
      return f;
    }
    function langKey(sel, path) {
      const f = fieldAt(sel, path);
      return f && f.i18n && altLang() ? path + "_" + ED.lang : path;
    }

    /* ---------- değişiklik, geri al, kaydet ---------- */
    const snapshot = () => JSON.stringify({ draft: ED.draft, page: ED.page, sel: ED.sel });
    function change(fn, key, o) {
      o = o || {};
      const before = snapshot();
      fn();
      if (snapshot() === before) return;
      const now = Date.now();
      // bir alana yazmak harf başına değil, tek adım geri alınır
      if (!(key && key === ED.lastKey && now - ED.lastAt < 1200)) {
        ED.undo.push(before);
        if (ED.undo.length > 100) ED.undo.shift();
      }
      ED.lastKey = key || ""; ED.lastAt = now;
      ED.redo = [];
      dirty();
      refreshCanvas();
      if (o.panels !== false) renderPanels(); else renderTop();
      emit("change", ED.draft);
    }
    function restore(snap) {
      const s = JSON.parse(snap);
      ED.draft = s.draft; ED.sel = s.sel;
      const pageChanged = s.page !== ED.page;
      ED.page = s.page;
      dirty();
      if (pageChanged) loadCanvas(); else refreshCanvas();
      renderPanels();
    }
    function undo() { if (!ED.undo.length) return; ED.redo.push(snapshot()); restore(ED.undo.pop()); ED.lastKey = ""; }
    function redo() { if (!ED.redo.length) return; ED.undo.push(snapshot()); restore(ED.redo.pop()); ED.lastKey = ""; }

    function dirty() {
      ED.save = "dirty";
      clearTimeout(ED.saveTimer);
      ED.saveTimer = setTimeout(saveNow, 1200);
    }
    async function saveNow() {
      clearTimeout(ED.saveTimer);
      if (ED.save === "saved" || !ED.draft) return true;
      const size = JSON.stringify(ED.draft).length;
      if (size > DESIGN_MAX) {
        ED.save = "error"; ED.saveErr = "Tasarım çok büyüdü (" + Math.round(size / 1024) + " KB). Birkaç görseli kaldırın.";
        renderTop(); toast(ED.saveErr, true);
        return false;
      }
      ED.save = "saving"; renderTop();
      try {
        await store.saveDraft(Object.assign(clone(ED.draft), { updatedAt: Date.now() }));
        if (ED.save === "saving") ED.save = "saved";
        ED.saveErr = "";
      } catch (e) {
        ED.save = "error"; ED.saveErr = (e && e.message) || "Kaydedilemedi";
      }
      renderTop();
      return ED.save === "saved";
    }
    const unpublished = () => bare(ED.draft) !== bare(ED.live);

    async function publish() {
      if (!(await saveNow()) && ED.save !== "saved") { toast("Taslak kaydedilemedi; yayınlanmadı.", true); return; }
      ED.modal = { kind: "busy", text: "Yayınlanıyor…" }; renderModal();
      try {
        const rev = ((ED.live && ED.live.rev) || 0) + 1;
        const doc = Object.assign(clone(ED.draft), { rev: rev, publishedAt: Date.now() });
        const out = await store.publish(doc);
        ED.live = normalize(out || doc);
        ED.history = null; ED.modal = null;
        toast("Yayınlandı.");
        emit("publish", ED.live);
      } catch (e) {
        ED.modal = null;
        toast((e && e.message) || "Yayınlanamadı", true);
      }
      renderModal(); renderTop();
    }
    async function loadHistory() {
      ED.history = "loading"; renderModal();
      try { ED.history = store.history ? (await store.history()) || [] : []; }
      catch (e) { ED.history = []; toast((e && e.message) || "Geçmiş okunamadı", true); }
      renderModal();
    }

    /* ---------- yükleme ---------- */
    async function load() {
      if (ED.loading || ED.ready) return;
      ED.loading = true; ED.err = "";
      render();
      try {
        const r = (await store.load()) || {};
        ED.live = r.live ? normalize(r.live) : null;
        ED.draft = normalize(r.draft || r.live || defaultDoc());
        ED.ready = true;
        ED.save = r.draft ? "saved" : "dirty";
        if (!r.draft) dirty();
      } catch (e) {
        ED.err = (e && e.message) || "Yüklenemedi";
      }
      ED.loading = false;
      render();
      if (ED.ready) emit("ready", ED.draft);
    }

    /* ---------- bloklar ---------- */
    function newBlock(type) {
      const T = BLOCKS[type];
      return Object.assign({ id: uid("b"), type: type }, clone(T.make ? T.make() : {}));
    }
    function insert(type, index) {
      if (!BLOCKS[type]) return;
      const b = newBlock(type);
      change(() => {
        const list = blocksHere();
        let at = index;
        if (at === undefined || at === null) {
          const after = ED.insertAfter || (ED.sel && ED.sel.kind === "block" ? ED.sel.id : null);
          const i = after ? list.findIndex(x => x.id === after) : -1;
          at = i > -1 ? i + 1 : list.length;
        }
        list.splice(Math.max(0, Math.min(list.length, at)), 0, b);
        ED.sel = { kind: "block", id: b.id };
        ED.insertAfter = null;
      });
      reveal(b.id);
    }
    function move(id, dir) {
      change(() => {
        const list = blocksHere(), i = list.findIndex(b => b.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        list.splice(j, 0, list.splice(i, 1)[0]);
      });
      reveal(id);
    }
    function moveTo(id, index) {
      change(() => {
        const list = blocksHere(), i = list.findIndex(b => b.id === id);
        if (i < 0) return;
        const b = list.splice(i, 1)[0];
        list.splice(Math.max(0, Math.min(list.length, index > i ? index - 1 : index)), 0, b);
        ED.sel = { kind: "block", id: id };
      });
    }
    function duplicate(id) {
      const src = blockById(id);
      if (!src) return;
      const copy = Object.assign(clone(src), { id: uid("b") });
      change(() => {
        const list = blocksHere();
        list.splice(list.findIndex(b => b.id === id) + 1, 0, copy);
        ED.sel = { kind: "block", id: copy.id };
      });
      reveal(copy.id);
    }
    function toggleHidden(id) { const b = blockById(id); if (b) change(() => { b.hidden = !b.hidden; }); }
    function remove(id) {
      if (!blockById(id)) return;
      change(() => {
        const list = blocksHere(), i = list.findIndex(x => x.id === id);
        list.splice(i, 1);
        const next = list[i] || list[i - 1];
        ED.sel = next ? { kind: "block", id: next.id } : null;
      });
      toast("Blok silindi. Geri almak için Ctrl+Z.");
    }
    function select(sel) {
      ED.sel = sel;
      ED.insertAfter = null;
      if (sel) ED.panelOpen = true;
      renderPanels();
      cvPaint();
    }
    function setText(sel, path, text) {
      const t = targetOf(sel);
      if (!t) return;
      text = String(text).replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
      if (sel.kind === "page" && path === "@title") path = "title";
      const key = langKey(sel, path);
      if ((getPath(t, key) || "") === text) { refreshCanvas(); return; }
      change(() => setPath(t, key, text), "t:" + JSON.stringify(sel) + key);
    }
    function getText(sel, path) {
      const t = targetOf(sel);
      if (!t) return "";
      if (sel.kind === "page" && path === "@title") path = "title";
      const v = getPath(t, langKey(sel, path));
      return v == null ? "" : String(v);
    }
    function blankItem(fields) {
      const o = {};
      (fields || []).forEach(f => {
        if (f.def !== undefined && f.type !== "toggle") o[f.k] = f.def;
        else if (f.type === "select" && f.opts) o[f.k] = f.opts[0][0];
      });
      const lab = (fields || []).find(f => f.k === "label" || f.k === "title" || f.k === "q" || f.k === "name");
      if (lab && o[lab.k] === undefined) o[lab.k] = "Yeni";
      return o;
    }
    function addItem(id, key) {
      const b = blockById(id);
      if (!b) return;
      ED.sel = { kind: "block", id: id };
      const f = fieldAt(ED.sel, key);
      if (f && f.max && (getPath(b, key) || []).length >= f.max) return;
      change(() => {
        const arr = getPath(b, key);
        if (!Array.isArray(arr)) setPath(b, key, []);
        getPath(b, key).push(f && f.fields ? blankItem(f.fields) : {});
      });
    }
    function removeItem(id, path) {
      const b = blockById(id);
      if (!b) return;
      const ks = String(path).split("."), i = Number(ks.pop()), key = ks.join(".");
      change(() => { const arr = getPath(b, key); if (Array.isArray(arr) && i >= 0 && i < arr.length) arr.splice(i, 1); ED.sel = { kind: "block", id: id }; });
    }
    function moveItem(id, key, from, to) {
      const b = blockById(id);
      if (!b || from === to) return;
      change(() => {
        const arr = getPath(b, key);
        if (!Array.isArray(arr) || from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
        arr.splice(to, 0, arr.splice(from, 1)[0]);
        ED.sel = { kind: "block", id: id };
      });
    }
    async function uploadImage(file) {
      if (store.upload) {
        try { return await store.upload(file); } catch (e) { toast((e && e.message) || "Yüklenemedi", true); return null; }
      }
      const r = await shrinkImage(file, opts.imageMaxWidth || 1600);
      if (r.err) { toast(r.err, true); return null; }
      return r.url;
    }

    /* ---------- sayfalar ---------- */
    function openPage(key) {
      if (key === ED.page) return;
      ED.page = key; ED.sel = null; ED.insertAfter = null;
      renderPanels();
      loadCanvas();
      emit("page", key);
    }
    function newPage(title) {
      title = String(title || "").trim();
      if (title.length < 2) { toast("Sayfaya bir ad verin.", true); return false; }
      let slug = slugify(title), n = 2;
      const taken = s => (ED.draft.custom || []).some(pg => pg.slug === s) || PAGES[s];
      while (taken(slug)) slug = slugify(title) + "-" + n++;
      change(() => {
        ED.draft.custom = ED.draft.custom || [];
        const first = BLOCKS.text ? [Object.assign(newBlock("text"), { text: "Bu sayfaya içerik eklemek için soldaki bloklardan birine tıklayın ya da bu yazıya çift tıklayıp değiştirin." })] : [];
        ED.draft.custom.push({ slug: slug, title: title, active: true, order: ED.draft.custom.length, blocks: first });
        ED.page = "custom:" + slug; ED.sel = { kind: "page" };
      });
      loadCanvas();
      return true;
    }
    function deletePage(slug) {
      const pg = customPage(slug);
      if (!pg || !confirm("“" + (pg.title || slug) + "” sayfası silinsin mi?")) return;
      change(() => {
        ED.draft.custom = ED.draft.custom.filter(x => x.slug !== slug);
        if (ED.page === "custom:" + slug) { ED.page = Object.keys(PAGES)[0]; ED.sel = null; }
      });
      loadCanvas();
    }
    function renameSlug(slug, next) {
      next = slugify(next || "");
      const pg = customPage(slug);
      if (!pg || !next || next === slug) return;
      if ((ED.draft.custom || []).some(x => x.slug === next) || PAGES[next]) { toast("Bu adres başka bir sayfada kullanılıyor.", true); renderPanels(); return; }
      change(() => { pg.slug = next; if (ED.page === "custom:" + slug) ED.page = "custom:" + next; });
      loadCanvas();
    }
    function pageList() {
      const out = Object.keys(PAGES).map(k => [k, PAGES[k]]);
      (ED.draft.custom || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(pg => out.push(["custom:" + pg.slug, pg.title || pg.slug]));
      return out;
    }
    function pageLabel(key) { const x = pageList().find(p => p[0] === key); return x ? x[1] : key; }
    function blockLabel(sel) {
      if (!sel) return "";
      if (sel.kind === "page") return "Sayfa başlığı";
      const b = sel.kind === "block" ? blockById(sel.id) : null;
      return b ? (BLOCKS[b.type] || {}).label || b.type : "";
    }

    /* =================================================================
     * Tuval: iframe içinde sayfa. Kod ebeveynde çalışır, iframe'in
     * belgesine dinleyici ekler (srcdoc aynı kökenden sayılır).
     * ================================================================= */
    let win = null, doc = null;
    let cvEditing = null, cvBox = null, cvHover = null, cvLine = null, cvDragged = false;

    function loadCanvas() {
      const f = $("#pe-canvas");
      if (!f) return;
      win = null; doc = null; cvEditing = null;
      const css = (opts.siteCss || "") + BASE_CSS + CANVAS_CSS;
      const head = (opts.siteHead || "") + "<style>" + css + '</style><style id="pe-theme"></style>';
      f.onload = () => {
        win = f.contentWindow; doc = f.contentDocument;
        if (!doc || !doc.getElementById("pe-root")) return;
        doc.documentElement.classList.add("canvas");
        cvInstall();
        paintCanvas();
      };
      f.srcdoc = '<!doctype html><html lang="' + ED.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        head + '</head><body><div id="pe-root"></div></body></html>';
    }
    function paintCanvas() {
      if (!doc) return;
      const r = doc.getElementById("pe-root");
      if (!r) return;
      doc.documentElement.lang = ED.lang;
      doc.getElementById("pe-theme").textContent = themeCss(ED.draft.theme);
      const html = renderPage(ED.draft, ED.page, { blocks: BLOCKS, lang: ED.lang, canvas: true });
      r.innerHTML = html || '<div class="cv-blank">Bu sayfa boş. Soldan bir blok ekleyin ya da buraya sürükleyin.</div>';
      if (typeof opts.afterRender === "function") { try { opts.afterRender(r, { canvas: true, page: ED.page, lang: ED.lang }); } catch (e) { console.warn(e); } }
      cvPaint();
    }
    let refreshQueued = false;
    function refreshCanvas() {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => { refreshQueued = false; if (!cvEditing) paintCanvas(); });
    }
    function reveal(id) {
      setTimeout(() => {
        const el = cvBlockEl(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(cvPaint, 450);
      }, 60);
    }

    function cvBlockEl(id) { return doc ? Array.from(doc.querySelectorAll("#pe-root .bw")).find(x => x.getAttribute("data-bid") === id) || null : null; }
    function cvSelOf(el) {
      if (!el || !el.closest) return null;
      if (el.closest(".cpage") && !el.closest(".bw")) return { kind: "page" };
      const bw = el.closest(".bw");
      if (bw) return { kind: "block", id: bw.getAttribute("data-bid") };
      return null;
    }
    function cvElOf(sel) {
      if (!sel || !doc) return null;
      if (sel.kind === "block") return cvBlockEl(sel.id);
      if (sel.kind === "page") return doc.querySelector(".cpage");
      return null;
    }
    function cvPlace(box, el) {
      if (!box) return;
      if (!el) { box.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      box.style.display = "block";
      box.style.top = (r.top + win.scrollY) + "px";
      box.style.left = (r.left + win.scrollX) + "px";
      box.style.width = r.width + "px";
      box.style.height = Math.max(r.height, 24) + "px";
    }
    function cvPaint() {
      if (!doc || !cvBox) return;
      const sel = ED.sel;
      const el = cvElOf(sel);
      cvPlace(cvBox, el);
      if (!el) return;
      const isBlock = sel.kind === "block";
      const hidden = isBlock && el.classList.contains("is-hidden");
      const b = (label, act, title) => '<button data-cv="' + act + '" title="' + title + '">' + label + "</button>";
      cvBox.querySelector(".cv-tools").innerHTML =
        (isBlock ? '<span class="cv-grip" data-cv="drag" title="Sürükleyerek taşıyın">⋮⋮</span>' : "") +
        '<span class="cv-name">' + esc(blockLabel(sel)) + (hidden ? " · gizli" : "") + "</span>" +
        (isBlock ? b("↑", "up", "Yukarı") + b("↓", "down", "Aşağı") + b("⧉", "dup", "Çoğalt") + b(hidden ? "Göster" : "Gizle", "hide", hidden ? "Göster" : "Gizle") + b("Sil", "del", "Sil") : "");
      cvBox.querySelector(".cv-add").style.display = isBlock ? "" : "none";
      cvBox.classList.toggle("tools-in", el.getBoundingClientRect().top + win.scrollY < 40);
    }
    function cvInstall() {
      const mk = cls => { const d = doc.createElement("div"); d.className = "cv " + cls; doc.body.appendChild(d); return d; };
      cvHover = mk("cv-hover");
      cvHover.innerHTML = '<span class="cv-tag"></span>';
      cvBox = mk("cv-sel");
      cvBox.innerHTML = '<div class="cv-tools"></div><button class="cv-add" data-cv="add" title="Altına blok ekle">+ Blok ekle</button>';
      cvLine = mk("cv-line");

      // sayfadaki hiçbir şey bir yere gitmez: tıklamak seçer
      win.addEventListener("click", ev => {
        const tool = ev.target.closest && ev.target.closest("[data-cv]");
        ev.preventDefault();
        ev.stopPropagation();
        if (cvDragged) { cvDragged = false; return; }
        if (tool) { cvTool(tool.getAttribute("data-cv")); return; }
        if (cvEditing && cvEditing.el.contains(ev.target)) return;
        const add = ev.target.closest && ev.target.closest("[data-additem]");
        const rm = ev.target.closest && ev.target.closest("[data-rmitem]");
        const bw = (add || rm) && (add || rm).closest(".bw");
        if (bw && add) { addItem(bw.getAttribute("data-bid"), add.getAttribute("data-additem")); return; }
        if (bw && rm) { removeItem(bw.getAttribute("data-bid"), rm.getAttribute("data-rmitem")); return; }
        select(cvSelOf(ev.target));
      }, true);
      win.addEventListener("submit", ev => { ev.preventDefault(); ev.stopPropagation(); }, true);
      win.addEventListener("dblclick", ev => {
        const el = ev.target.closest && ev.target.closest("[data-e]");
        if (!el || cvEditing) return;
        ev.preventDefault();
        cvStartEdit(el);
      }, true);
      win.addEventListener("mousemove", ev => {
        if (doc.documentElement.classList.contains("cv-dragging")) return;
        const sel = cvSelOf(ev.target);
        const el = sel && JSON.stringify(sel) !== JSON.stringify(ED.sel) ? cvElOf(sel) : null;
        cvPlace(cvHover, el);
        if (el) cvHover.querySelector(".cv-tag").textContent = blockLabel(sel) + (ev.target.closest("[data-e]") ? " · yazıyı değiştirmek için çift tıklayın" : "");
      });
      doc.addEventListener("mouseleave", () => cvPlace(cvHover, null));
      win.addEventListener("keydown", ev => {
        if (cvEditing) {
          if (ev.key === "Escape") { ev.preventDefault(); const el = cvEditing.el; cvCommit(true); el.blur(); }
          else if (ev.key === "Enter" && !cvEditing.multi && !ev.shiftKey) { ev.preventDefault(); cvEditing.el.blur(); }
          return;
        }
        keydown(ev);
      }, true);
      win.addEventListener("scroll", () => { cvPaint(); cvPlace(cvHover, null); }, { passive: true });
      win.addEventListener("resize", () => cvPaint());

      // seçili bloğun tutamağı hemen sürükler; başka yerde birkaç piksel
      // basılı tutup çekmek: liste elemanını ya da bütün bloğu taşır
      win.addEventListener("pointerdown", ev => {
        if (ev.button !== 0 || cvEditing || !ev.target.closest) return;
        if (ev.target.closest('[data-cv="drag"]')) {
          if (ED.sel && ED.sel.kind === "block") cvDrag(ev, ED.sel.id);
          return;
        }
        if (ev.target.closest(".cv, [data-additem], [data-rmitem]")) return;
        const bw = ev.target.closest("#pe-root .bw");
        if (!bw) return;
        const item = ev.target.closest("[data-item]");
        const x0 = ev.clientX, y0 = ev.clientY;
        const wait = e => {
          if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) < 8) return;
          stop();
          if (item && bw.contains(item)) cvItemDrag(bw, item, e);
          else { select({ kind: "block", id: bw.getAttribute("data-bid") }); cvDrag(e, bw.getAttribute("data-bid")); }
        };
        const stop = () => { win.removeEventListener("pointermove", wait, true); win.removeEventListener("pointerup", stop, true); };
        win.addEventListener("pointermove", wait, true);
        win.addEventListener("pointerup", stop, true);
      }, true);
      win.addEventListener("dragstart", ev => { if (ev.target.closest && ev.target.closest("#pe-root")) ev.preventDefault(); }, true);
      // paletten sürüklenen bloklar
      doc.addEventListener("dragover", ev => {
        if (!ev.dataTransfer || Array.from(ev.dataTransfer.types || []).indexOf("text/pe-block") < 0) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "copy";
        cvShowGap(cvGapAt(ev.clientY));
      });
      doc.addEventListener("dragleave", ev => { if (!ev.relatedTarget) cvLine.style.display = "none"; });
      doc.addEventListener("drop", ev => {
        const type = ev.dataTransfer && ev.dataTransfer.getData("text/pe-block");
        cvLine.style.display = "none";
        if (!type) return;
        ev.preventDefault();
        insert(type, cvGapAt(ev.clientY));
      });
    }
    function cvTool(act) {
      const id = ED.sel && ED.sel.kind === "block" ? ED.sel.id : null;
      if (!id) return;
      if (act === "up") move(id, -1);
      else if (act === "down") move(id, 1);
      else if (act === "dup") duplicate(id);
      else if (act === "hide") toggleHidden(id);
      else if (act === "del") remove(id);
      else if (act === "add") { ED.insertAfter = id; ED.left = "add"; ED.panelOpen = true; root.classList.add("left-open"); renderLeft(); toast("Soldan bir blok seçin; seçili bloğun altına eklenecek."); }
    }
    function cvGapAt(y) {
      const blocks = Array.from(doc.querySelectorAll("#pe-root .bw"));
      const i = blocks.findIndex(b => { const r = b.getBoundingClientRect(); return y < r.top + r.height / 2; });
      return i < 0 ? blocks.length : i;
    }
    function cvShowGap(i) {
      const blocks = Array.from(doc.querySelectorAll("#pe-root .bw"));
      if (!blocks.length) { cvLine.style.display = "none"; return; }
      const ref = blocks[Math.min(i, blocks.length - 1)].getBoundingClientRect();
      cvLine.style.display = "block";
      cvLine.style.top = ((i < blocks.length ? ref.top : ref.bottom) + win.scrollY - 2) + "px";
      cvLine.style.left = (ref.left + win.scrollX) + "px";
      cvLine.style.width = ref.width + "px";
    }
    function cvDrag(ev, id) {
      ev.preventDefault();
      const h = doc.documentElement;
      h.classList.add("cv-dragging");
      let at = null;
      const mv = e => {
        at = cvGapAt(e.clientY);
        cvShowGap(at);
        if (e.clientY < 60) win.scrollBy(0, -14);
        else if (e.clientY > win.innerHeight - 60) win.scrollBy(0, 14);
      };
      const up = () => {
        win.removeEventListener("pointermove", mv, true);
        h.classList.remove("cv-dragging");
        cvLine.style.display = "none";
        cvDragged = true;
        setTimeout(() => { cvDragged = false; }, 0);
        if (at !== null) moveTo(id, at);
      };
      win.addEventListener("pointermove", mv, true);
      win.addEventListener("pointerup", up, { once: true, capture: true });
    }
    function cvItemDrag(bw, item, e0) {
      const path = item.getAttribute("data-item");
      const cut = path.lastIndexOf(".");
      const key = path.slice(0, cut), from = Number(path.slice(cut + 1));
      const sibs = Array.from(bw.querySelectorAll("[data-item]")).filter(x => { const p = x.getAttribute("data-item"); return p.slice(0, p.lastIndexOf(".")) === key; });
      const h = doc.documentElement;
      h.classList.add("cv-dragging");
      item.classList.add("cv-dragitem");
      let tgt = null;
      const mv = e => {
        let best = null, bd = Infinity;
        sibs.forEach(s => {
          const r = s.getBoundingClientRect();
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          if (d < bd) { bd = d; best = s; }
        });
        if (tgt && tgt !== best) tgt.classList.remove("cv-droptarget");
        tgt = best;
        if (tgt && tgt !== item) tgt.classList.add("cv-droptarget");
        if (e.clientY < 50) win.scrollBy(0, -12);
        else if (e.clientY > win.innerHeight - 50) win.scrollBy(0, 12);
      };
      const up = () => {
        win.removeEventListener("pointermove", mv, true);
        h.classList.remove("cv-dragging");
        item.classList.remove("cv-dragitem");
        if (tgt) tgt.classList.remove("cv-droptarget");
        cvDragged = true;
        setTimeout(() => { cvDragged = false; }, 0);
        if (tgt && tgt !== item) {
          const tp = tgt.getAttribute("data-item");
          moveItem(bw.getAttribute("data-bid"), key, from, Number(tp.slice(tp.lastIndexOf(".") + 1)));
        }
      };
      mv(e0);
      win.addEventListener("pointermove", mv, true);
      win.addEventListener("pointerup", up, { once: true, capture: true });
    }
    function cvStartEdit(el) {
      const sel = cvSelOf(el);
      if (!sel) return;
      const path = el.getAttribute("data-e");
      select(sel);
      const f = fieldAt(sel, path === "@title" ? "title" : path);
      cvEditing = { el: el, sel: sel, path: path, old: el.innerHTML, multi: !!f && f.type === "area" };
      el.textContent = getText(sel, path);
      el.classList.add("cv-editing");
      try { el.contentEditable = "plaintext-only"; } catch (e) { /* eski tarayıcılar */ }
      if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
      el.focus();
      const r = doc.createRange();
      r.selectNodeContents(el);
      const s = win.getSelection();
      s.removeAllRanges(); s.addRange(r);
      el.addEventListener("blur", () => cvCommit(false), { once: true });
      cvPlace(cvHover, null);
    }
    function cvCommit(cancel) {
      const e = cvEditing;
      if (!e) return;
      cvEditing = null;
      e.el.removeAttribute("contenteditable");
      e.el.classList.remove("cv-editing");
      if (cancel) { e.el.innerHTML = e.old; return; }
      setText(e.sel, e.path, e.el.innerText);
    }

    /* ---------- editörü çizmek ---------- */
    function render() {
      if (ED.destroyed) return;
      if (!ED.ready) {
        if (!ED.loading && !ED.err) { load(); return; }
        root.innerHTML = '<div class="pe-gate"><div>' + (ED.err ? "<p>" + esc(ED.err) + '</p><button class="ubtn" data-ed="retry">Tekrar dene</button>' : "<p>Editör açılıyor…</p>") + "</div></div>";
        return;
      }
      if (!$("#ed-top")) {
        root.innerHTML =
          '<header class="ed-top" id="ed-top"></header>' +
          '<div class="ed-main">' +
            '<aside class="ed-left" id="ed-left"></aside>' +
            '<main class="ed-stage"><div class="ed-frame"><iframe id="pe-canvas" title="Sayfanın önizlemesi"></iframe></div></main>' +
            '<aside class="ed-right" id="ed-right"></aside>' +
          "</div>" +
          '<div id="ed-modal"></div>';
        loadCanvas();
      }
      renderPanels();
      renderModal();
    }
    function renderPanels() { renderTop(); renderLeft(); renderRight(); }

    function renderTop() {
      const el = $("#ed-top");
      if (!el || !ED.draft) return;
      const status = { saved: "Taslak kaydedildi", dirty: "Kaydedilmemiş değişiklik", saving: "Kaydediliyor…", error: "Kaydedilemedi" }[ED.save];
      const unpub = unpublished();
      el.innerHTML =
        (opts.onExit ? '<button class="ed-back" data-ed="exit" title="Çık">' + ico("chevL") + "<span>Çık</span></button>" : "") +
        '<span class="ed-title">' + esc(opts.title || "Sayfa düzenleyici") + "</span>" +
        '<button class="ubtn ed-small" data-ed="toggle-left">' + ico("plus") + "Bloklar</button>" +
        '<label class="ed-page">' + ico("file") + '<select data-ed-page aria-label="Düzenlenen sayfa">' +
          pageList().map(p => '<option value="' + esc(p[0]) + '"' + (p[0] === ED.page ? " selected" : "") + ">" + esc(p[1]) + "</option>").join("") + "</select></label>" +
        '<span class="ed-seg" role="group" aria-label="Ekran">' + DEVICES.map(d => '<button data-ed="device" data-v="' + d[0] + '" aria-pressed="' + (ED.device === d[0]) + '">' + d[1] + "</button>").join("") + "</span>" +
        (LANGS.length > 1 ? '<span class="ed-seg" role="group" aria-label="Dil">' + LANGS.map(l => '<button data-ed="lang" data-v="' + l + '" aria-pressed="' + (ED.lang === l) + '">' + l.toUpperCase() + "</button>").join("") + "</span>" : "") +
        '<span class="ed-sp"></span>' +
        '<button class="ed-ic" data-ed="undo" title="Geri al (Ctrl+Z)"' + (ED.undo.length ? "" : " disabled") + ">↶</button>" +
        '<button class="ed-ic" data-ed="redo" title="Yinele (Ctrl+Y)"' + (ED.redo.length ? "" : " disabled") + ">↷</button>" +
        '<span class="ed-status s-' + ED.save + '" title="' + esc(ED.saveErr || "") + '">' + status + (ED.save === "error" ? ' <button class="ed-link" data-ed="save">Tekrar dene</button>' : "") + "</span>" +
        (store.history ? '<button class="ubtn" data-ed="history">Geçmiş</button>' : "") +
        (opts.onPreview ? '<button class="ubtn" data-ed="preview">' + ico("eye") + "Önizle</button>" : "") +
        '<button class="ubtn primary" data-ed="publish"' + (unpub ? "" : " disabled") + ">" + (unpub ? "Yayınla" : "Yayında") + "</button>";
    }

    function renderLeft() {
      const el = $("#ed-left");
      if (!el || !ED.draft) return;
      let body = "";
      const tabs = LEFT_TABS.filter(x => x[0] !== "pages" || allowCustom || Object.keys(PAGES).length > 1).filter(x => x[0] !== "theme" || opts.theme !== false);
      if (ED.left === "add") {
        body = (ED.insertAfter ? '<p class="ed-hint on">Seçili bloğun altına eklenecek. <button class="ed-link" data-ed="cancel-insert">Vazgeç</button></p>' : '<p class="ed-hint">Tıklayın ya da sayfaya sürükleyin. Seçili bir blok varsa altına eklenir.</p>') +
          GROUPS.map(g => '<h4 class="ed-gh">' + esc(g) + '</h4><div class="ed-palette">' +
            Object.keys(BLOCKS).filter(k => (BLOCKS[k].group || "Bloklar") === g && !BLOCKS[k].hiddenInPalette).map(k => {
              const T = BLOCKS[k];
              return '<button class="ed-tile" data-ed="add" data-v="' + esc(k) + '" draggable="true" data-drag-type="' + esc(k) + '" title="' + esc(T.hint || "") + '">' + ico(T.icon) + "<span>" + esc(T.label || k) + "</span></button>";
            }).join("") + "</div>").join("");
      } else if (ED.left === "layers") {
        const list = blocksHere();
        body = '<p class="ed-hint">Sürükleyerek sıralayın. Göz simgesi bloğu ziyaretçilerden gizler.</p>' +
          (isCustom() ? '<div class="ed-layer fixed' + (ED.sel && ED.sel.kind === "page" ? " on" : "") + '" data-ed="select" data-sel="' + esc(JSON.stringify({ kind: "page" })) + '">' + ico("file") + "<span>Sayfa başlığı ve ayarları</span></div>" : "") +
          '<div class="ed-layers">' + (list.length ? list.map((b, i) => {
            const T = BLOCKS[b.type] || { label: b.type, icon: "box" };
            const name = blockName(b);
            return '<div class="ed-layer' + (ED.sel && ED.sel.kind === "block" && ED.sel.id === b.id ? " on" : "") + (b.hidden ? " is-off" : "") +
              '" data-ed="select" data-sel="' + esc(JSON.stringify({ kind: "block", id: b.id })) + '" draggable="true" data-layer="' + esc(b.id) + '" data-i="' + i + '">' +
              '<span class="ed-grip" aria-hidden="true">⋮⋮</span>' + ico(T.icon) + "<span><b>" + esc(T.label || b.type) + "</b>" + (name ? "<small>" + esc(name) + "</small>" : "") + "</span>" +
              '<button class="ed-eye" data-ed="hide" data-v="' + esc(b.id) + '" title="' + (b.hidden ? "Göster" : "Gizle") + '">' + (b.hidden ? "Gizli" : ico("eye")) + "</button>" +
            "</div>";
          }).join("") : '<p class="ed-hint">Bu sayfada henüz blok yok.</p>') + "</div>";
      } else if (ED.left === "pages") {
        body = '<p class="ed-hint">Bir sayfaya tıklayın, ortada açılsın.</p><div class="ed-pages">' +
          pageList().map(p => {
            const custom = p[0].indexOf("custom:") === 0;
            const pg = custom ? customPage(p[0].slice(7)) : null;
            return '<div class="ed-pagerow' + (p[0] === ED.page ? " on" : "") + '">' +
              '<button data-ed="page" data-v="' + esc(p[0]) + '">' + ico("file") + "<span>" + esc(p[1]) +
                (pg && pg.active === false ? " <em>kapalı</em>" : "") + "<small>" + (custom ? esc(pg.slug) : "sabit sayfa") + "</small></span></button>" +
              (custom ? '<button class="ed-eye" data-ed="del-page" data-v="' + esc(pg.slug) + '" title="Sayfayı sil">' + ico("trash") + "</button>" : "") +
            "</div>";
          }).join("") + "</div>" +
          (allowCustom ? '<form class="ed-newpage" data-ed-form="newpage"><input name="t" placeholder="Yeni sayfanın adı" maxlength="60"><button class="ubtn primary">' + ico("plus") + "Ekle</button></form>" : "");
      } else if (ED.left === "theme") {
        body = themeHTML();
      }
      el.innerHTML = '<nav class="ed-tabs" role="tablist" style="grid-template-columns:repeat(' + tabs.length + ',1fr)">' +
        tabs.map(x => '<button role="tab" data-ed="left" data-v="' + x[0] + '" aria-selected="' + (ED.left === x[0]) + '">' + ico(x[2]) + "<span>" + x[1] + "</span></button>").join("") + "</nav>" +
        '<div class="ed-leftbody">' + body + "</div>";
    }
    function blockName(b) {
      const first = Object.keys(b).map(k => b[k]).find(v => Array.isArray(v) && v[0] && typeof v[0] === "object");
      const s = tf(b, "title") || tf(b, "text") || tf(b, "label") || (first && (tf(first[0], "title") || tf(first[0], "label") || tf(first[0], "q"))) || "";
      return String(s).replace(/\s+/g, " ").slice(0, 38);
    }
    function themeHTML() {
      const th = ED.draft.theme || {};
      const preset = PRESETS.find(p => p[0] === (th.preset || PRESETS[0][0])) || PRESETS[0];
      const colors = Object.assign({}, preset[2], th.colors || {});
      const cf = (k, label) => '<label class="ed-color"><input type="color" value="' + esc(colors[k] || "#000000") + '" data-ed-color="' + k + '"><span>' + label + "</span></label>";
      return '<p class="ed-hint">Bütün sayfaların renkleri ve yazı tipi. Önce hazır bir tema seçin, sonra isterseniz renkleri tek tek değiştirin.</p>' +
        '<h4 class="ed-gh">Hazır temalar</h4><div class="ed-presets">' + PRESETS.map(p =>
          '<button class="ed-preset' + ((th.preset || "") === p[0] ? " on" : "") + '" data-ed="preset" data-v="' + esc(p[0]) + '">' +
            '<span class="dots"><i style="background:' + esc(p[2].paper) + '"></i><i style="background:' + esc(p[2].ink) + '"></i><i style="background:' + esc(p[2].accent) + '"></i></span>' + esc(p[1]) + "</button>").join("") + "</div>" +
        '<h4 class="ed-gh">Renkler</h4><div class="ed-colors">' +
          cf("paper", "Sayfa zemini") + cf("surface", "Kutular") + cf("ink", "Yazı") + cf("accent", "Vurgu") + cf("band", "Koyu bantlar") + "</div>" +
        '<h4 class="ed-gh">Başlık yazı tipi</h4><select class="ed-in" data-ed-theme="font">' + FONTS.map(f => '<option value="' + esc(f[0]) + '"' + ((th.font || "") === f[0] ? " selected" : "") + ">" + esc(f[1]) + "</option>").join("") + "</select>" +
        '<h4 class="ed-gh">Köşeler</h4>' + segHTML("theme-radius", [["", "Keskin"], ["soft", "Yumuşak"], ["round", "Yuvarlak"]], th.radius || "") +
        '<button class="ubtn" data-ed="theme-reset" style="margin-top:18px">Temayı başa al</button>';
    }
    function segHTML(name, list, val) {
      return '<span class="ed-seg wide" role="group">' + list.map(o => '<button data-ed="' + name + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(val || "") === String(o[0])) + '">' + esc(o[1]) + "</button>").join("") + "</span>";
    }

    function renderRight() {
      const el = $("#ed-right");
      if (!el || !ED.draft) return;
      const sel = ED.sel, t = target();
      let head = "", body = "";
      if (!sel || !t) {
        head = "<h3>" + esc(pageLabel(ED.page)) + "</h3>";
        body = '<div class="ed-empty">' + ico("layout") + "<p>Sayfada bir yere tıklayın; ayarları burada açılır.</p>" +
          "<ul><li>Yazıyı değiştirmek için üzerine <b>çift tıklayın</b>.</li><li>Blok eklemek için soldaki <b>Ekle</b>.</li>" +
          "<li>Sıralamak için bloğun üstündeki ⋮⋮ tutamağını sürükleyin.</li><li>Hiçbir şey <b>Yayınla</b>'ya basmadan görünmez.</li></ul>" +
          (isCustom() ? '<button class="ubtn" data-ed="select" data-sel="' + esc(JSON.stringify({ kind: "page" })) + '">Sayfa ayarları</button>' : "") + "</div>";
      } else if (sel.kind === "page") {
        head = "<h3>" + ico("file") + "Sayfa ayarları</h3>";
        body = fieldsHTML(PAGE_FIELDS, t, "") +
          '<div class="ed-f"><label>Adres</label><div class="ed-slug"><input class="ed-in" value="' + esc(t.slug) + '" data-ed-slug="' + esc(t.slug) + '"></div><small>Değiştirirseniz eski adres çalışmaz.</small></div>' +
          '<button class="ubtn danger" data-ed="del-page" data-v="' + esc(t.slug) + '">' + ico("trash") + "Sayfayı sil</button>";
      } else if (sel.kind === "block") {
        const b = t, T = BLOCKS[b.type] || { label: b.type, fields: [] };
        head = "<h3>" + ico(T.icon || "box") + esc(T.label || b.type) + "</h3>" + (T.hint ? '<p class="ed-hint">' + esc(T.hint) + "</p>" : "");
        body = (T.variants ? '<div class="ed-f"><label>Görünüm</label><div class="ed-variants">' + T.variants.map(v =>
            '<button data-ed="variant" data-v="' + esc(v[0]) + '" aria-pressed="' + ((b.variant || T.variants[0][0]) === v[0]) + '">' + esc(v[1]) + "</button>").join("") + "</div></div>" : "") +
          fieldsHTML(T.fields || [], b, "") +
          (opts.look !== false ? '<details class="ed-more"' + (b.pad || b.bg || b.hide || b.anchor ? " open" : "") + "><summary>Yerleşim ve zemin</summary>" + fieldsHTML(LOOK_FIELDS, b, "") + "</details>" : "") +
          '<div class="ed-acts">' +
            '<button class="ubtn" data-ed="up" data-v="' + esc(b.id) + '" title="Yukarı">↑</button><button class="ubtn" data-ed="down" data-v="' + esc(b.id) + '" title="Aşağı">↓</button>' +
            '<button class="ubtn" data-ed="dup" data-v="' + esc(b.id) + '">Çoğalt</button>' +
            '<button class="ubtn" data-ed="hide" data-v="' + esc(b.id) + '">' + (b.hidden ? "Göster" : "Gizle") + "</button>" +
            '<button class="ubtn danger" data-ed="del" data-v="' + esc(b.id) + '">' + ico("trash") + "Sil</button>" +
          "</div>" + (b.hidden ? '<p class="ed-hint on">Bu blok gizli: ziyaretçiler görmez.</p>' : "");
      }
      el.innerHTML = '<div class="ed-rhead">' + head + '<button class="ed-close" data-ed="close-panel" aria-label="Kapat">' + ico("x") + "</button></div>" + '<div class="ed-rbody">' + body + "</div>";
      root.classList.toggle("panel-open", !!ED.panelOpen);
    }

    function fieldsHTML(fields, obj, base) {
      return (fields || []).filter(f => !f.show || f.show(obj)).map(f => fieldHTML(f, obj, base ? base + "." + f.k : f.k)).join("");
    }
    function fieldHTML(f, obj, path) {
      const alt = f.i18n && altLang();
      const key = alt ? f.k + "_" + ED.lang : f.k;
      const full = alt ? path + "_" + ED.lang : path;
      const v = obj ? obj[key] : undefined;
      const lab = "<label>" + esc(f.label) + (alt ? ' <em class="ed-en">' + ED.lang.toUpperCase() + "</em>" : "") + "</label>";
      const help = f.help ? "<small>" + esc(f.help) + "</small>" : "";
      const ph = alt && obj && obj[f.k] ? obj[f.k] : (typeof f.ph === "function" ? f.ph() : f.ph || "");
      const at = ' data-ef="' + esc(full) + '"';
      let input = "";
      switch (f.type) {
        case "text": input = '<input class="ed-in"' + at + ' value="' + esc(v == null ? "" : v) + '" placeholder="' + esc(ph) + '">'; break;
        case "number": input = '<input class="ed-in" type="number"' + at + ' data-et="num" value="' + esc(v == null ? "" : v) + '"' + (f.min != null ? ' min="' + f.min + '"' : "") + (f.max != null ? ' max="' + f.max + '"' : "") + ">"; break;
        case "area": input = '<textarea class="ed-in"' + at + ' rows="' + (f.rows || 4) + '" placeholder="' + esc(ph) + '">' + esc(v || "") + "</textarea>"; break;
        case "color": input = '<input class="ed-in" type="color" style="height:38px;padding:3px"' + at + ' value="' + esc(v || f.def || "#000000") + '">'; break;
        case "toggle": {
          const isOn = f.def ? v !== false : !!v;
          return '<label class="ed-tog"><input type="checkbox"' + at + ' data-et="toggle"' + (isOn ? " checked" : "") + "><span>" + esc(f.label) + "</span></label>" + help;
        }
        case "select": input = '<select class="ed-in"' + at + ">" + f.opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(v == null ? "" : v) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>"; break;
        case "seg": input = '<span class="ed-seg wide">' + f.opts.map(o => '<button data-ed="set" data-p="' + esc(full) + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(v == null ? "" : v) === String(o[0])) + '">' + esc(o[1]) + "</button>").join("") + "</span>"; break;
        case "swatch": input = '<span class="ed-swatches">' + f.opts.map(o => '<button data-ed="set" data-p="' + esc(full) + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(v || "") === String(o[0])) + '" title="' + esc(o[1]) + '"><i style="background:' + esc(o[2] || o[0] || "#fff") + '"></i>' + esc(o[1]) + "</button>").join("") + "</span>"; break;
        case "range": {
          const n = v === undefined || v === "" || v === null ? (f.def != null ? f.def : (f.min + f.max) / 2) : Number(v);
          input = '<span class="ed-range"><input type="range"' + at + ' data-et="num" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + n + '"><output>' + n + (f.unit || "") + "</output></span>";
          break;
        }
        case "image": input = '<div class="ed-img">' + (v ? '<img src="' + esc(v) + '" alt="">' : '<span class="noimg">Görsel yok</span>') +
          '<div><label class="ubtn">' + ico("upload") + 'Yükle<input type="file" accept="image/*" data-eimg="' + esc(full) + '" hidden></label>' +
          (v ? '<button class="ubtn danger" data-ed="set" data-p="' + esc(full) + '" data-v="">Kaldır</button>' : "") + "</div></div>"; break;
        case "link": input = linkHTML(full, v); break;
        case "items": {
          const items = Array.isArray(obj && obj[f.k]) ? obj[f.k] : [];
          input = '<div class="ed-items">' + items.map((it, i) =>
            '<details class="ed-item"' + (items.length <= 2 ? " open" : "") + "><summary><span>" + esc((f.title ? f.title(it, i, tf) : tf(it, "title") || tf(it, "label") || tf(it, "q")) || (i + 1) + ".") + "</span>" +
              '<span class="ed-itemacts"><button data-ed="item-up" data-p="' + esc(path) + '" data-v="' + i + '" title="Yukarı">↑</button>' +
              '<button data-ed="item-down" data-p="' + esc(path) + '" data-v="' + i + '" title="Aşağı">↓</button>' +
              '<button data-ed="item-del" data-p="' + esc(path) + '" data-v="' + i + '" title="Sil">' + ico("trash") + "</button></span></summary>" +
              '<div class="ed-itembody">' + fieldsHTML(f.fields, it, path + "." + i) + "</div></details>").join("") +
            (items.length < (f.max || 20) ? '<button class="ubtn" data-ed="item-add" data-p="' + esc(path) + '">' + ico("plus") + esc(f.add || "Ekle") + "</button>" : "") + "</div>";
          break;
        }
        default:
          // kendi alan tipiniz: opts.fieldTypes[type](f, value, path) -> HTML
          if (opts.fieldTypes && opts.fieldTypes[f.type]) input = opts.fieldTypes[f.type](f, v, full, { esc: esc, ico: ico });
      }
      return '<div class="ed-f">' + lab + input + help + "</div>";
    }
    function linkHTML(path, v) {
      v = v || "";
      const groups = [["Sayfalar", pageList().map(p => [p[0].indexOf("custom:") === 0 ? p[0].slice(7) : p[0], p[1]])]];
      const anchors = blocksHere().filter(b => b.anchor).map(b => ["#" + slugify(b.anchor), "#" + b.anchor]);
      if (anchors.length) groups.push(["Bu sayfanın bölümleri", anchors]);
      if (opts.links) groups.push.apply(groups, typeof opts.links === "function" ? opts.links() : opts.links);
      const known = groups.some(g => g[1].some(o => o[0] === v));
      return '<div class="ed-linkf"><select class="ed-in" data-ed-linksel="' + esc(path) + '">' +
        (v ? "" : '<option value="" selected>— Seçin —</option>') +
        groups.map(g => g[1].length ? '<optgroup label="' + esc(g[0]) + '">' + g[1].map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</optgroup>" : "").join("") +
        '<option value="__other"' + (v && !known ? " selected" : "") + ">Başka bir adres…</option></select>" +
        (v && !known ? '<input class="ed-in" data-ef="' + esc(path) + '" value="' + esc(v) + '" placeholder="https://…">' : "") + "</div>";
    }

    function renderModal() {
      const el = $("#ed-modal");
      if (!el) return;
      const m = ED.modal;
      if (!m) { el.innerHTML = ""; return; }
      let body = "";
      if (m.kind === "busy") body = "<p>" + esc(m.text) + "</p>";
      else if (m.kind === "publish") {
        body = "<h3>Yayınlansın mı?</h3><p>Taslaktaki bütün değişiklikler herkese görünecek." + (store.history ? " Önceki sürüm Geçmiş'te saklanır." : "") + "</p>" +
          (ED.save !== "saved" ? '<p class="ed-hint on">Önce taslak kaydedilecek.</p>' : "") +
          '<div class="ed-acts end"><button class="ubtn" data-ed="modal-close">Vazgeç</button><button class="ubtn primary" data-ed="publish-go">Yayınla</button></div>';
      } else if (m.kind === "history") {
        const h = ED.history;
        body = '<h3>Yayın geçmişi</h3><p class="ed-hint">Bir sürümü taslağa aldığınızda önce önizleyebilir, beğenirseniz yeniden yayınlarsınız.</p>' +
          (h === "loading" || h === null ? "<p>Yükleniyor…</p>" : !h.length ? "<p>Henüz yayınlanmış bir sürüm yok.</p>" :
            '<div class="ed-hist">' + h.map(x => '<div class="ed-histrow"><span><b>Sürüm ' + (x.rev || "?") + "</b><small>" + fmtDate(x.publishedAt) +
              (ED.live && ED.live.rev === x.rev ? " · şu an yayında" : "") + '</small></span><button class="ubtn" data-ed="restore" data-v="' + esc(x.id || x.rev) + '">Taslağa al</button></div>').join("") + "</div>") +
          '<div class="ed-acts end"><button class="ubtn" data-ed="modal-close">Kapat</button></div>';
      }
      el.innerHTML = '<div class="ed-modal" role="dialog" aria-modal="true"><div class="ed-modal-in">' + body + "</div></div>";
    }

    /* ---------- olaylar ---------- */
    const typingTarget = el => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    function keydown(ev) {
      if (!ED.ready || ED.destroyed) return;
      // sayfada başka bir şey de olabilir: yalnızca editörün içindeyken ya da tuvalden gelince
      if (ev.view === window && !root.contains(document.activeElement) && document.activeElement !== document.body) return;
      const mod = ev.ctrlKey || ev.metaKey;
      const typing = typingTarget(ev.target) || typingTarget(document.activeElement && document.activeElement.tagName === "IFRAME" ? null : document.activeElement);
      if (mod && !typing && (ev.key === "z" || ev.key === "Z")) { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
      if (mod && !typing && (ev.key === "y" || ev.key === "Y")) { ev.preventDefault(); redo(); return; }
      if (mod && (ev.key === "s" || ev.key === "S")) { ev.preventDefault(); saveNow(); return; }
      if (typing) return;
      const id = ED.sel && ED.sel.kind === "block" ? ED.sel.id : null;
      if (ev.key === "Escape") { if (ED.modal) { ED.modal = null; renderModal(); } else select(null); return; }
      if (!id) return;
      if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); remove(id); }
      else if (mod && (ev.key === "d" || ev.key === "D")) { ev.preventDefault(); duplicate(id); }
      else if (ev.altKey && ev.key === "ArrowUp") { ev.preventDefault(); move(id, -1); }
      else if (ev.altKey && ev.key === "ArrowDown") { ev.preventDefault(); move(id, 1); }
    }

    function click(ev) {
      const el = ev.target.closest && ev.target.closest("[data-ed]");
      if (!el || !root.contains(el)) return;
      const a = el.getAttribute("data-ed"), v = el.getAttribute("data-v"), p = el.getAttribute("data-p");
      const t = target();
      ev.preventDefault();
      if (a === "retry") { ED.err = ""; load(); }
      else if (a === "exit") { saveNow().then(() => opts.onExit(api)); }
      else if (a === "device") {
        ED.device = v;
        root.classList.remove("d-desktop", "d-tablet", "d-phone"); root.classList.add("d-" + v);
        renderTop(); setTimeout(cvPaint, 350);
      }
      else if (a === "lang") { ED.lang = v; renderPanels(); refreshCanvas(); }
      else if (a === "undo") undo();
      else if (a === "redo") redo();
      else if (a === "save") saveNow();
      else if (a === "preview") { saveNow().then(() => opts.onPreview(clone(ED.draft), ED.page, ED.lang)); }
      else if (a === "publish") { ED.modal = { kind: "publish" }; renderModal(); }
      else if (a === "publish-go") publish();
      else if (a === "history") { ED.modal = { kind: "history" }; loadHistory(); }
      else if (a === "restore") {
        const h = Array.isArray(ED.history) ? ED.history.find(x => String(x.id || x.rev) === v) : null;
        if (h) { change(() => { ED.draft = normalize(h); ED.sel = null; }); ED.modal = null; renderModal(); loadCanvas(); toast("Sürüm " + h.rev + " taslağa alındı. Beğenirseniz Yayınla'ya basın."); }
      }
      else if (a === "modal-close") { ED.modal = null; renderModal(); }
      else if (a === "left") { ED.left = v; renderLeft(); }
      else if (a === "toggle-left") root.classList.toggle("left-open");
      else if (a === "add") { insert(v); root.classList.remove("left-open"); }
      else if (a === "cancel-insert") { ED.insertAfter = null; renderLeft(); }
      else if (a === "select") select(JSON.parse(el.getAttribute("data-sel")));
      else if (a === "page") openPage(v);
      else if (a === "del-page") deletePage(v);
      else if (a === "close-panel") { ED.panelOpen = false; select(null); }
      else if (a === "up") move(v, -1);
      else if (a === "down") move(v, 1);
      else if (a === "dup") duplicate(v);
      else if (a === "hide") { ev.stopPropagation(); toggleHidden(v); }
      else if (a === "del") remove(v);
      else if (a === "variant" && t) change(() => { t.variant = v; });
      else if (a === "set" && t) change(() => setPath(t, p, v), "s:" + p);
      else if (a === "item-add" && t) {
        const f = fieldAt(ED.sel, p);
        change(() => { const arr = getPath(t, p) || []; arr.push(f && f.fields ? blankItem(f.fields) : {}); setPath(t, p, arr); });
      }
      else if (a === "item-del" && t) change(() => { const arr = getPath(t, p) || []; arr.splice(Number(v), 1); });
      else if ((a === "item-up" || a === "item-down") && t) {
        change(() => { const arr = getPath(t, p) || [], i = Number(v), j = i + (a === "item-up" ? -1 : 1); if (j >= 0 && j < arr.length) arr.splice(j, 0, arr.splice(i, 1)[0]); });
      }
      else if (a === "preset") change(() => { ED.draft.theme = Object.assign({}, ED.draft.theme, { preset: v, colors: Object.assign({}, (PRESETS.find(x => x[0] === v) || [])[2]) }); });
      else if (a === "theme-radius") change(() => { ED.draft.theme.radius = v; });
      else if (a === "theme-reset") change(() => { ED.draft.theme = {}; });
    }
    function input(ev) {
      const el = ev.target;
      if (!root.contains(el)) return;
      const t = target();
      if (el.hasAttribute("data-ef") && t) {
        const path = el.getAttribute("data-ef");
        let val = el.value;
        if (el.getAttribute("data-et") === "toggle") val = el.checked;
        else if (el.getAttribute("data-et") === "num") {
          val = el.value === "" ? "" : Number(el.value);
          const o = el.parentNode.querySelector("output"); if (o) o.textContent = el.value + o.textContent.replace(/^-?[\d.]+/, "");
        }
        const redraw = el.tagName === "SELECT" || el.type === "checkbox";
        change(() => setPath(t, path, val), "f:" + JSON.stringify(ED.sel) + path, { panels: redraw });
        return;
      }
      if (el.hasAttribute("data-ed-linksel") && t) {
        const path = el.getAttribute("data-ed-linksel");
        if (el.value === "__other") {
          setPath(t, path, getPath(t, path) || "https://");
          renderRight();
          const inp = root.querySelector('[data-ef="' + path + '"]'); if (inp) inp.focus();
          return;
        }
        change(() => setPath(t, path, el.value));
        return;
      }
      if (el.hasAttribute("data-ed-page")) { openPage(el.value); return; }
      if (el.hasAttribute("data-ed-color")) {
        const k = el.getAttribute("data-ed-color");
        change(() => { const th = ED.draft.theme; th.preset = th.preset || PRESETS[0][0]; th.colors = Object.assign({}, th.colors, { [k]: el.value }); }, "color:" + k, { panels: false });
        return;
      }
      if (el.hasAttribute("data-ed-theme")) { change(() => { ED.draft.theme[el.getAttribute("data-ed-theme")] = el.value; }); return; }
      if (el.hasAttribute("data-ed-slug") && ev.type === "change") { renameSlug(el.getAttribute("data-ed-slug"), el.value); return; }
      if (el.hasAttribute("data-eimg") && ev.type === "change" && el.files && el.files[0] && t) {
        const path = el.getAttribute("data-eimg");
        uploadImage(el.files[0]).then(url => { if (url) change(() => setPath(t, path, url)); });
      }
    }
    function submit(ev) {
      const f = ev.target.closest && ev.target.closest("[data-ed-form]");
      if (!f || !root.contains(f)) return;
      ev.preventDefault();
      if (f.getAttribute("data-ed-form") === "newpage") {
        const inp = f.querySelector("input");
        if (newPage(inp.value)) inp.value = "";
      }
    }
    let dragLayer = null;
    on(root, "click", click);
    on(root, "input", input);
    on(root, "change", ev => { const el = ev.target; if (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "file" || el.hasAttribute("data-ed-slug")) input(ev); });
    on(root, "submit", submit, true);
    on(document, "keydown", keydown);
    on(window, "beforeunload", ev => { if (ED.ready && ED.save !== "saved") { ev.preventDefault(); ev.returnValue = ""; } });
    on(root, "dragstart", ev => {
      const tile = ev.target.closest && ev.target.closest("[data-drag-type]");
      if (tile) { ev.dataTransfer.setData("text/pe-block", tile.getAttribute("data-drag-type")); ev.dataTransfer.effectAllowed = "copy"; return; }
      const layer = ev.target.closest && ev.target.closest("[data-layer]");
      if (layer) { dragLayer = layer.getAttribute("data-layer"); ev.dataTransfer.setData("text/plain", dragLayer); ev.dataTransfer.effectAllowed = "move"; layer.classList.add("dragging"); }
    });
    on(root, "dragover", ev => {
      if (!dragLayer) return;
      const over = ev.target.closest && ev.target.closest("[data-layer]");
      if (!over) return;
      ev.preventDefault();
      $$(".ed-layer.drop-above,.ed-layer.drop-below").forEach(x => x.classList.remove("drop-above", "drop-below"));
      const r = over.getBoundingClientRect();
      over.classList.add(ev.clientY < r.top + r.height / 2 ? "drop-above" : "drop-below");
    });
    on(root, "drop", ev => {
      if (!dragLayer) return;
      const over = ev.target.closest && ev.target.closest("[data-layer]");
      ev.preventDefault();
      if (over) {
        const r = over.getBoundingClientRect();
        moveTo(dragLayer, Number(over.getAttribute("data-i")) + (ev.clientY < r.top + r.height / 2 ? 0 : 1));
      }
      dragLayer = null;
    });
    on(root, "dragend", () => { dragLayer = null; $$(".ed-layer.dragging,.drop-above,.drop-below").forEach(x => x.classList.remove("dragging", "drop-above", "drop-below")); });

    /* ---------- dışarıya açılan arayüz ---------- */
    const handlers = {};
    function emit(name, data) { (handlers[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.warn(e); } }); }
    const api = {
      on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); return api; },
      getDraft: () => ED.draft ? clone(ED.draft) : null,
      getLive: () => ED.live ? clone(ED.live) : null,
      setDraft(d) { change(() => { ED.draft = normalize(d); ED.sel = null; }); loadCanvas(); },
      openPage: openPage,
      insert: insert,
      select: select,
      save: saveNow,
      publish: publish,
      undo: undo, redo: redo,
      refresh: () => { renderPanels(); refreshCanvas(); },
      destroy() {
        ED.destroyed = true;
        clearTimeout(ED.saveTimer);
        listeners.forEach(x => x[0].removeEventListener(x[1], x[2], x[3]));
        root.remove();
      }
    };
    render();
    return api;
  }

  /* ---------- hazır storage: tarayıcının localStorage'ı ---------- */
  function localStore(ns, keep) {
    ns = ns || "page-editor"; keep = keep || 30;
    const get = k => { try { const s = localStorage.getItem(ns + ":" + k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
    const put = (k, v) => { localStorage.setItem(ns + ":" + k, JSON.stringify(v)); };
    return {
      load: () => Promise.resolve({ draft: get("draft"), live: get("live") }),
      saveDraft: d => { put("draft", d); return Promise.resolve(); },
      publish: d => {
        put("live", d);
        const h = (get("history") || []).filter(x => x.rev !== d.rev);
        h.unshift(Object.assign({ id: "r" + d.rev }, d));
        put("history", h.slice(0, keep));
        return Promise.resolve(d);
      },
      history: () => Promise.resolve(get("history") || []),
      // editör olmadan, oyunun içinde yayındaki hâli okumak için
      live: () => get("live")
    };
  }

  global.PageEditor = {
    create: create,
    renderPage: renderPage,
    themeCss: themeCss,
    baseCss: BASE_CSS,
    localStorage: localStore,
    helpers: { esc: esc, rich: richParas, slugify: slugify, getPath: getPath, setPath: setPath, shrinkImage: shrinkImage, ico: ico }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.PageEditor;
})(typeof window !== "undefined" ? window : globalThis);
