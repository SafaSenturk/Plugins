# web-utils

De L'Amour'da kullanılan küçük tarayıcı yardımcıları. Tek dosya, bağımlılık yok.

```html
<script src="web-utils.js"></script>
<script>
  const { esc, slugify, money, parseNum, toast, shrinkImage, storage } = WebUtils;
  money(1234.5);            // "1.234,50 TL"
  parseNum("1.234,50 TL");  // 1234.5
  slugify("Çiçekli Şampuan"); // "cicekli-sampuan"
  toast("Kaydedildi");  toast("Bir hata oldu", true);
  const dataUrl = await shrinkImage(input.files[0], { maxWidth: 1200 });
  storage.set("ayarlar", { ses: true }); storage.get("ayarlar", {});
</script>
```

| Fonksiyon | Ne yapar |
|---|---|
| `esc(s)` | HTML'e yazılacak metni kaçışlar (XSS'e karşı) |
| `slugify(s)` | Türkçe karakterleri çevirip adres dostu yapar |
| `money(n, "TL")` / `parseNum(s)` | Türk biçimiyle para yazar / okur |
| `fmtDate(ts, withTime)` | Tarihi Türkçe biçimde yazar |
| `getPath` / `setPath` | `"items.2.title"` gibi yollarla iç içe nesne okur/yazar |
| `debounce(fn, ms)` | Arka arkaya çağrıları tek çağrıya indirir |
| `shrinkImage(file, opts)` | Görseli tarayıcıda küçültüp JPEG data adresine çevirir |
| `toast(msg, bad)` | Ekranın altında kısa bildirim |
| `storage.get/set/remove` | Hata vermeyen localStorage (JSON) |
| `clone`, `uid`, `lower` | Kopya, rastgele kimlik, Türkçe küçük harf |
