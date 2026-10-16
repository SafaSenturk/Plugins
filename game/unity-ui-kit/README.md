# unity-ui-kit

Kodla kurulan oyun arayüzü. Hiç sprite, font ya da prefab gerektirmez.
Yuvarlak köşeli koyu paneller, altın çerçeve, gölgeli yazı, dolum barı, butonlar, sekmeler ve dikey menüler içerir.
SupermarketOyunu'ndaki `ArayuzStili` ve `PanelKurucu`'dan çıkarıldı.

İki dosyayı da (`ArayuzStili.cs`, `PanelKurucu.cs`) projeye ekleyin. Gerekirse kanvası ve EventSystem'i kendisi kurar.

```csharp
// Menü paneli (ekran ortasında, içerik kadar uzar)
GameObject p = PanelKurucu.Panel("Magaza", "MAĞAZA", 520);
PanelKurucu.SekmeSatiri(p, new[] { "Ürünler", "Mobilya" }, aktif, i => SekmeAc(i));
Transform satir = PanelKurucu.Satir(p, "Elma  ×10  —  25₺");
PanelKurucu.Buton(satir, "Satın al", 120, () => SatinAl("elma"));
PanelKurucu.MenuButonu(p, "Kapat", () => Destroy(p));
var perde = PanelKurucu.Karartma(0.5f);           // arkayı karart

// HUD: köşeye sabit panel, yazı ve bar
RectTransform hud = ArayuzStili.Panel(ArayuzStili.Kanvas, new Vector2(0, 1), new Vector2(20, -20), new Vector2(300, 90));
Text para = ArayuzStili.Yazi(hud, "₺0", 28, FontStyle.Bold, ArayuzStili.ParaYesili, TextAnchor.MiddleLeft,
                             new Vector2(0, 1), new Vector2(16, -10), new Vector2(260, 36));
ArayuzStili.Bar(hud, new Vector2(16, -54), new Vector2(268, 22), ArayuzStili.Altin, out RectTransform dolum);
ArayuzStili.Doldur(dolum, dolum.gameObject, 0.7f);
```

- Kendi kanvasınız varsa önce `ArayuzStili.KanvasAta(kanvas)` çağırın.
- Renkler `ArayuzStili`'nin başında (`Altin`, `ButonMavi`, `PanelIci` …). Değiştirince bütün arayüz değişir.
- Eski (legacy) `UnityEngine.UI.Text` kullanır. Ek paket gerekmez.
