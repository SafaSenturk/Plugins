# flutter-weather-sky

Hava durumuna ve gece/gündüze göre değişen tam ekran **hareketli gökyüzü**, elle çizilmiş hava ikonları ve WMO hava kodlarının (Open-Meteo, birçok hava API'si) anlamları. [Atmos](https://github.com/SafaSenturk/flutter-weather-app) uygulamasından çıkarıldı.

**Gereken:** sadece Flutter. Görsel ya da ikon paketi yok; her şey `CustomPainter` ile çiziliyor.

| Dosya | İçerik |
|---|---|
| `weather_condition.dart` | `WeatherCondition.fromCode(wmoKodu)` ve 8 gökyüzü ailesi (`Sky`) |
| `sky_background.dart` | `SkyBackground`: gradyan, güneş parıltısı ya da yıldızlar, süzülen bulutlar, yağmur, kar, sis, şimşek |
| `weather_icon.dart` | `WeatherIcon`: güneş, ay, bulut, damla, kar tanesi, şimşek ikonları |
| `test/` | Kod eşleme ve her gökyüzünün çizim testi |

```dart
final condition = WeatherCondition.fromCode(json['weather_code'] as int); // 63 → rain
Stack(
  children: [
    Positioned.fill(child: SkyBackground(sky: condition.sky, isDay: json['is_day'] == 1)),
    Center(child: WeatherIcon(condition: condition, isDay: true, size: 96)),
  ],
);
```

`skyGradient(sky, isDay)` gökyüzünün renklerini döndürür. Kartları ya da durum çubuğunu aynı renklere uydurmak için kullanabilirsin.

---

## English

A full-screen **animated sky** that follows the weather and the time of day, hand-drawn weather icons, and the meaning of every WMO weather code (used by Open-Meteo and many other weather APIs). Taken from the [Atmos](https://github.com/SafaSenturk/flutter-weather-app) app.

It needs only Flutter: no images or icon packs, everything is drawn with `CustomPainter`.
- `WeatherCondition.fromCode(code)` maps a WMO code to a condition and one of 8 sky families.
- `SkyBackground(sky:, isDay:)` animates sun glow or stars, clouds, rain, snow, fog and lightning.
- `WeatherIcon(condition:, isDay:, size:)` draws the matching icon.
