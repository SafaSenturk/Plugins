/* =====================================================================
 * WebUtils — De L'Amour'dan çıkarılmış küçük tarayıcı yardımcıları
 * Tek dosya, bağımlılık yok. <script src="web-utils.js"> ile ya da
 * require/import ile kullanılır (window.WebUtils ve module.exports).
 * ===================================================================== */
(function (global) {
  "use strict";

  // HTML'e güvenle yazmak için kaçış
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = p => (p || "id") + Math.random().toString(36).slice(2, 8);
  const lower = s => String(s || "").toLocaleLowerCase("tr");

  // "Çiçekli Ürün Şampuanı" -> "cicekli-urun-sampuani"
  function slugify(s) {
    const map = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" };
    return lower(s).replace(/[çğıöşü]/g, c => map[c] || c)
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
  }

  // 1234.5 -> "1.234,50 TL"   (currency: "TL", "₺", "" …)
  function money(n, currency) {
    const v = Number(n);
    if (!isFinite(v)) return "—";
    const c = currency === undefined ? "TL" : currency;
    return v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (c ? " " + c : "");
  }
  // "1.234,50 TL" / "1234.5" / "12,5" -> sayı; okunamazsa null
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).trim().replace(/\s/g, "").replace(/TL|₺/gi, "");
    if (!s) return null;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return isFinite(n) ? n : null;
  }
  // tarih: ms ya da Date -> "12 Eki 2026 14:30"
  function fmtDate(ts, withTime) {
    if (!ts) return "";
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d)) return "";
    return d.toLocaleString("tr-TR", withTime === false ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" });
  }

  // iç içe nesnede yol: getPath(o, "items.2.title"), setPath(o, "a.0.b", 5)
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
    return o;
  }

  function debounce(fn, ms) {
    let t = null;
    const d = function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  // Görseli tarayıcıda küçültür; sunucuya/veritabanına yüklemeden önce.
  // shrinkImage(file, { maxWidth: 1600, maxBytes: 380000 }) -> Promise<dataURL>
  // Hata olursa Error fırlatır (mesajı kullanıcıya gösterilebilir).
  function shrinkImage(file, opts) {
    opts = opts || {};
    const maxW = opts.maxWidth || 1600, target = opts.maxBytes || 380000, hard = opts.hardLimit || target * 1.85;
    return new Promise((ok, fail) => {
      if (!file || !/^image\//.test(file.type)) { fail(new Error("Bir görsel dosyası seçin.")); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          let q = 0.82, out = c.toDataURL("image/jpeg", q);
          while (out.length > target && q > 0.4) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
          if (out.length > hard) fail(new Error("Görsel çok büyük, daha küçük bir dosya deneyin."));
          else ok(out);
        };
        img.onerror = () => fail(new Error("Görsel okunamadı."));
        img.src = fr.result;
      };
      fr.onerror = () => fail(new Error("Dosya okunamadı."));
      fr.readAsDataURL(file);
    });
  }

  // Ekranın altında kısa bildirim. toast("Kaydedildi"), toast("Hata", true)
  function toast(msg, bad) {
    if (!document.getElementById("wu-toast-css")) {
      const s = document.createElement("style");
      s.id = "wu-toast-css";
      s.textContent = "#wu-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;transition:.25s;background:#1B1E26;color:#fff;" +
        "padding:11px 18px;border-radius:9px;font:500 14px system-ui,sans-serif;z-index:2147483600;max-width:calc(100% - 32px);box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none}" +
        "#wu-toast.show{opacity:1;transform:translate(-50%,0)}#wu-toast.bad{background:#B42318}";
      document.head.appendChild(s);
    }
    let el = document.getElementById("wu-toast");
    if (!el) { el = document.createElement("div"); el.id = "wu-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = bad ? "bad" : "";
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(el.__h);
    el.__h = setTimeout(() => el.classList.remove("show"), bad ? 6000 : 3600);
  }

  // localStorage, gizli sekmede ya da kapalıyken patlamasın
  const storage = {
    get(k, def) { try { const s = localStorage.getItem(k); return s == null ? def : JSON.parse(s); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* yok say */ } }
  };

  const WebUtils = { esc, clone, uid, lower, slugify, money, parseNum, fmtDate, getPath, setPath, debounce, shrinkImage, toast, storage };
  global.WebUtils = WebUtils;
  if (typeof module !== "undefined" && module.exports) module.exports = WebUtils;
})(typeof window !== "undefined" ? window : globalThis);
