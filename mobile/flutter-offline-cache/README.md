# flutter-offline-cache

API yanıtları için **önce çevrimdışı** önbellek (stale-while-revalidate). İnternet yokken boş ekran ya da hata yerine son kaydedilen veriyi "çevrimdışı" işaretiyle döndürür. [Atmos](https://github.com/SafaSenturk/flutter-weather-app) uygulamasındaki hava durumu deposundan genelleştirildi.

**Gereken:** `shared_preferences`.

**Nasıl çalışır?**
- **Taze veri:** [`freshFor`] süresinden yeni bir değer bellekten döner; istek atılmaz.
- **Eski veri:** değilse `fetch` çağrılır, ham JSON diske yazılır ve değer döner.
- **İstek başarısız olursa:** son kayıt `isStale: true` ve hata bilgisiyle döner. Hata yalnızca hiç kayıt yoksa fırlatılır.
- **`peek(id)`:** bilinen değeri anında verir. Ekran hemen çizilir, arka planda yenilenir.
- **Sürüm değişimi:** JSON yapısı değişip eski kayıt çözülemezse kayıt sessizce yok sayılır. `namespace`'i artır (`"forecast.v2"`).

```dart
final cache = OfflineCache<Forecast>(
  prefs: await SharedPreferences.getInstance(),
  namespace: 'forecast.v1',
  decode: Forecast.fromJson,
);

final instant = cache.peek(city.id);          // varsa hemen göster
final result = await cache.load(city.id, () => api.forecast(city));
if (result.isStale) showBanner('Çevrimdışı · ${timeAgo(result.savedAt)}');
render(result.value);
```

`test/` klasöründe taze/bayat/hata/bozuk kayıt durumları için testler var.

---

## English

An **offline-first**, stale-while-revalidate cache for API responses, generalised from the weather repository of the [Atmos](https://github.com/SafaSenturk/flutter-weather-app) app. Needs `shared_preferences`.

How it works:
- A fresh value comes from memory with no request.
- Otherwise the raw JSON is fetched and saved to disk.
- If the request fails, the last saved copy is returned with `isStale: true`, so the screen can show an "offline" banner instead of an error.
- `peek` returns what is known instantly.
- Copies that no longer decode are ignored.
