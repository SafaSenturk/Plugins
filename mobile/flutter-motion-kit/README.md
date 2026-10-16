# flutter-motion-kit

Uygulamalara "canlı" his veren küçük, temaya uyumlu arayüz parçaları. [GlobeGo](https://github.com/SafaSenturk/flutter-travel-app-ui) ve [NovaShop](https://github.com/SafaSenturk/flutter-ecommerce-app) uygulamalarından çıkarıldı.

**Gereken:** sadece Flutter. Her dosya tek başına kopyalanabilir (`slide_to_confirm.dart` yalnızca `glass.dart`'a ihtiyaç duyar).

| Dosya | Widget | Ne işe yarar |
|---|---|---|
| `slide_to_confirm.dart` | `SlideToConfirm` | "Devam ··· Kaydır →" düğmesi: dokununca `onTap`, sona sürükleyince `onSlid`; erken bırakılınca yaylanarak geri döner, ok hafifçe titreşir |
| `pressable.dart` | `Pressable` | Basılıyken hafifçe küçülen kart/düğme sarmalayıcısı; ekran okuyucuya düğme olarak görünür |
| `reveal.dart` | `Reveal` | Liste öğelerini sırayla, aşağıdan kayarak getirir |
| `glass.dart` | `Glass` | Fotoğraf üstündeki düğmeler için buzlu cam |
| `skeleton.dart` | `Shimmer`, `SkeletonBox` | Yükleniyor iskeleti ve üstünden geçen parıltı; açık/koyu temaya uyar |
| `message_view.dart` | `MessageView` | Boş liste ve hata ekranları için ikon + başlık + açıklama + düğme |
| `test/` | | Widget testleri |

```dart
SlideToConfirm(
  label: 'Devam',
  hint: 'Kaydır',
  onTap: nextPage,
  onSlid: startApp,
);

ListView.builder(
  itemBuilder: (context, i) => Reveal(
    key: ValueKey('$filter-${items[i].id}'), // filtre değişince yeniden oynar
    index: i,
    child: Pressable(onTap: () => open(items[i]), child: ProductCard(items[i])),
  ),
);

Shimmer(child: Column(children: [SkeletonBox(height: 180), SizedBox(height: 12), SkeletonBox(height: 18, width: 140)]));

MessageView(
  icon: Icons.wifi_off_rounded,
  title: 'İnternet yok',
  body: 'Bağlantını kontrol edip tekrar dene.',
  actionLabel: 'Tekrar dene',
  onAction: reload,
  tone: Theme.of(context).colorScheme.error,
);
```

---

## English

Small, theme-aware widgets that make an app feel alive, taken from the [GlobeGo](https://github.com/SafaSenturk/flutter-travel-app-ui) and [NovaShop](https://github.com/SafaSenturk/flutter-ecommerce-app) apps. Needs only Flutter; each file can be copied on its own.

| Widget | What it does |
|---|---|
| `SlideToConfirm` | Tap the knob or drag it to the end; springs back when released early |
| `Pressable` | Scales down while pressed; announced as a button |
| `Reveal` | Staggered fade-and-slide entrance for list items |
| `Glass` | Frosted-glass background for controls on top of photos |
| `Shimmer` / `SkeletonBox` | Loading skeletons with a moving highlight; follows light and dark themes |
| `MessageView` | Empty and error states: icon, title, text and an action button |
