# flutter-image-filters

Klasik görüntü işleme algoritmaları, saf Dart ile elle yazılmış. OCR öncesi belge temizleme, kenar bulma ya da eğitim amaçlı "görüntü laboratuvarı" için. [Vision Lab](https://github.com/SafaSenturk/flutter-ai-vision-app) uygulamasından çıkarıldı.

**Gereken:** [`image`](https://pub.dev/packages/image) paketi (piksel erişimi için). Flutter'a bağımlı değil; sunucu tarafı Dart'ta da çalışır.

| Fonksiyon | Ne yapar |
|---|---|
| `toGray` | `0.299·R + 0.587·G + 0.114·B` (ITU-R BT.601) |
| `histogram`, `equalize` | Histogram ve kümülatif histogramla kontrast eşitleme |
| `otsuThreshold`, `binarize` | Sınıflar arası varyansı en büyük yapan global eşik ve siyah-beyaza çevirme |
| `adaptiveThreshold` | Bradley–Roth: **integral görüntü** ile piksel başına O(1) yerel ortalama |
| `sobel` | `√(Gx² + Gy²)` kenar şiddeti |
| `convolve3`, `gaussianBlur`, `sharpen` | 3×3 konvolüsyon: Gauss bulanıklığı, keskinleştirme ya da kendi çekirdeğin |
| `applyFilter(image, LabFilter)` | Filtreyi adıyla uygular |
| `runFilter(bytes, LabFilter)` | Fotoğrafı çözer, döndürür, küçültür, filtreler; PNG, süre, histogram ve eşikle `FilterResult` döndürür |

```dart
// Arayüz donmasın diye arka planda çalıştır.
final result = await Isolate.run(() => runFilter(bytes, LabFilter.ocrReady));
Image.memory(result.png);
print('${result.millis} ms, eşik: ${result.threshold}');
```

**Neden uyarlamalı eşik?** Vision Lab'deki test fotoğrafında (gölgeli, basılı bir duyuru) ML Kit:
- Orijinal fotoğrafta 1729 ms'de 53 kelime buldu.
- Global Otsu eşiğinde 47 kelime buldu; kırmızı başlık kayboldu.
- `adaptiveThreshold` ile 184 ms'de 54 kelime buldu.

---

## English

Classic image-processing algorithms written by hand in pure Dart, taken from the [Vision Lab](https://github.com/SafaSenturk/flutter-ai-vision-app) app. Needs the [`image`](https://pub.dev/packages/image) package; works outside Flutter too.

Filters:
- Grayscale.
- Histogram equalization.
- Otsu threshold.
- **Adaptive (Bradley–Roth) threshold** with an integral image.
- Sobel edges.
- 3×3 convolution (blur / sharpen).

`runFilter` returns the PNG, the timing, the histogram and the threshold. Run it inside `Isolate.run` so the UI never freezes.

On a shadowed document, adaptive thresholding before ML Kit OCR:
- Found 54 words in 184 ms, against 53 words in 1729 ms on the original photo.
- Kept the coloured heading that a global Otsu threshold lost (Otsu found only 47 words).
