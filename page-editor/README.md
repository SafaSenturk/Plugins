# Sayfa düzenleyici (bağımsız sürüm)

De L'Amour'daki site editörünün (`src/parts/68-editor.js`, `69-canvas.js`,
`16-css-editor.js`) başka projelere takılabilen tek dosyalık hâli. Firebase,
ürün kataloğu ya da mağaza router'ı gerektirmez.

- `page-editor.js` — kütüphanenin kendisi (bağımlılık yok, ~1000 satır)
- `demo.html` — oyun sayfalarıyla örnek kullanım; tarayıcıda doğrudan açılır

## Neler var

Ortada iframe içinde canlı önizleme · tıklayınca seçme · çift tıklayıp yerinde
yazma · blokları ve liste elemanlarını sürükleyerek sıralama · paletten
sürükle-bırak · katmanlar · sabit + özel sayfalar · tema (hazır temalar,
renkler, yazı tipi, köşeler) · bilgisayar/tablet/telefon görünümü · TR/EN ·
geri al/yinele (Ctrl+Z / Ctrl+Y) · otomatik taslak kaydı · yayınla + geçmiş.

## Kısa kullanım

```html
<script src="page-editor.js"></script>
<script>
const editor = PageEditor.create({
  mount: "#app",
  blocks: { /* blok tipleri: label, icon, group, fields, make(), render(b, h) */ },
  pages: { home: "Giriş ekranı", gameover: "Oyun bitti" },
  langs: ["tr", "en"],
  siteCss: "/* önizlemede kullanılan CSS */",
  storage: PageEditor.localStorage("oyunum"), // ya da { load, saveDraft, publish, history, upload }
  afterRender: root => { /* oyunun verisiyle doldurulan bloklar için */ }
});

// Oyunun içinde, editör olmadan:
const live = PageEditor.localStorage("oyunum").live();
el.innerHTML = PageEditor.renderPage(live, "home", { blocks, lang: "tr" });
</script>
```

Diğer seçenekler: `title`, `groups`, `defaultBlocks`, `links`, `fieldTypes`,
`themePresets`, `fonts`, `customPages: false`, `theme: false`, `look: false`,
`fullscreen`, `onExit`, `onPreview`. Olaylar: `editor.on("change" | "publish" | "ready" | "page", fn)`.
Ayrıntılar dosyanın başındaki açıklamada.
