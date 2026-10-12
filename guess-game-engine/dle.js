/* =====================================================================
 * DleEngine — "Loldle / Wordle" tarzı tahmin oyunu motoru
 * gamedle (Android) oyunundaki mantığın arayüzden bağımsız JS sürümü.
 *
 *   const game = DleEngine.create({
 *     entities: [{ name: "Ahri", imageUrl: "…", attributes: { cinsiyet: "Kadın", bolge: "Ionia", cikis: "2011" } }, …],
 *     attributes: ["cinsiyet", "bolge", { key: "cikis", type: "number" }],
 *     mode: "daily",          // "daily" | "random"
 *     maxGuesses: 0           // 0 = sınırsız
 *   });
 *   game.guess("Lux")  -> { ok, row?, error?, won, lost }
 *
 * Değer karşılaştırma:
 *   - Çoklu değer "|" ile ayrılır ("Orta|Alt"): hepsi aynı = correct,
 *     en az biri ortak = partial, hiçbiri = wrong
 *   - type:"number": eşit = correct, değilse wrong + yön ("higher": doğru
 *     cevap daha büyük, "lower": daha küçük)
 * ===================================================================== */
(function (global) {
  "use strict";

  const norm = s => String(s == null ? "" : s).trim().toLocaleLowerCase("tr");
  const split = v => String(v == null ? "" : v).split("|").map(x => x.trim()).filter(Boolean);

  // tarihe bağlı, her cihazda aynı sonucu veren sayı (FNV-1a)
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  // Günün cevabı: liste ada göre sıralanır, tarih+tuz karıştırılır.
  // (gün+yıl)%n yerine bu: art arda günlerde listede komşu karakterler gelmez.
  function dailyIndex(n, date, salt) { return n ? hash(dayKey(date) + "|" + (salt || "")) % n : -1; }

  function compareValue(guessVal, answerVal, type) {
    if (type === "number") {
      const g = Number(guessVal), a = Number(answerVal);
      if (!isFinite(g) || !isFinite(a)) return { state: norm(guessVal) === norm(answerVal) ? "correct" : "wrong" };
      if (g === a) return { state: "correct" };
      return { state: "wrong", direction: a > g ? "higher" : "lower" };
    }
    const gs = new Set(split(guessVal).map(norm)), as = new Set(split(answerVal).map(norm));
    const same = gs.size === as.size && [...gs].every(x => as.has(x));
    if (same) return { state: "correct" };
    if ([...gs].some(x => as.has(x))) return { state: "partial" };
    return { state: "wrong" };
  }

  function create(opts) {
    const entities = (opts.entities || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "tr"));
    const attrs = (opts.attributes || []).map(a => typeof a === "string" ? { key: a, type: "set" } : Object.assign({ type: "set" }, a));
    const maxGuesses = opts.maxGuesses || 0;
    const byName = new Map(entities.map(e => [norm(e.name), e]));
    if (!entities.length) throw new Error("DleEngine: liste boş");

    let answer = opts.answer ? byName.get(norm(opts.answer)) : null;
    if (!answer) answer = opts.mode === "daily"
      ? entities[dailyIndex(entities.length, opts.date, opts.salt)]
      : entities[Math.floor((opts.random || Math.random)() * entities.length)];

    const history = [];
    let won = false, lost = false;

    function compare(guessed) {
      return attrs.map(a => Object.assign({
        key: a.key, label: a.label || a.key,
        value: split(guessed.attributes[a.key]).join(", ") || "—"
      }, compareValue(guessed.attributes[a.key], answer.attributes[a.key], a.type)));
    }

    const api = {
      guess(name) {
        if (won || lost) return { ok: false, error: "finished", won, lost };
        const e = byName.get(norm(name));
        if (!e) return { ok: false, error: "unknown", won, lost };
        if (history.some(r => r.name === e.name)) return { ok: false, error: "duplicate", won, lost };
        const row = { name: e.name, imageUrl: e.imageUrl, correct: e === answer, cells: compare(e) };
        history.push(row);
        if (row.correct) won = true;
        else if (maxGuesses && history.length >= maxGuesses) lost = true;
        return { ok: true, row, won, lost };
      },
      giveUp() { if (!won) lost = true; return answer.name; },
      // yazarken öneri: tahmin edilmemiş, adı yazılanla başlayan/içeren
      suggest(text, limit) {
        const q = norm(text);
        if (!q) return [];
        const used = new Set(history.map(r => r.name));
        const pool = entities.filter(e => !used.has(e.name));
        const starts = pool.filter(e => norm(e.name).startsWith(q));
        const has = pool.filter(e => !norm(e.name).startsWith(q) && norm(e.name).includes(q));
        return starts.concat(has).slice(0, limit || 8).map(e => e.name);
      },
      get history() { return history.slice(); },
      get won() { return won; },
      get lost() { return lost; },
      get finished() { return won || lost; },
      get guessesLeft() { return maxGuesses ? Math.max(0, maxGuesses - history.length) : Infinity; },
      // oyun bitince ya da hile ekranında
      get answer() { return won || lost ? answer : null; },
      names: () => entities.map(e => e.name),
      // paylaşım metni: 🟩🟨🟥 ve ⬆⬇
      shareText(title) {
        const icon = c => c.state === "correct" ? "🟩" : c.state === "partial" ? "🟨" : c.direction === "higher" ? "⬆️" : c.direction === "lower" ? "⬇️" : "🟥";
        return (title || "Tahmin") + " " + (won ? history.length : "X") + (maxGuesses ? "/" + maxGuesses : "") + "\n" +
          history.map(r => r.cells.map(icon).join("")).join("\n");
      }
    };
    return api;
  }

  // "Bugün oynandı mı?" — localStorage ile (tarayıcı)
  const daily = {
    played(gameId, date) { try { return localStorage.getItem("dle:" + gameId) === dayKey(date); } catch (e) { return false; } },
    markPlayed(gameId, date) { try { localStorage.setItem("dle:" + gameId, dayKey(date)); } catch (e) { /* yok say */ } }
  };

  const DleEngine = { create, compareValue, dailyIndex, dayKey, daily };
  global.DleEngine = DleEngine;
  if (typeof module !== "undefined" && module.exports) module.exports = DleEngine;
})(typeof window !== "undefined" ? window : globalThis);
