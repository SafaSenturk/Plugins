# guess-game-engine

"Loldle / Wordle" tarzı **tahmin oyunu motoru**. gamedle'daki oyun mantığı
arayüzden ayrıldı; herhangi bir karakter/ürün/şehir listesiyle çalışır.

| Dosya | Platform |
|---|---|
| `dle.js` | Tarayıcı / Node (bağımlılık yok) |
| `DleEngine.kt` | Kotlin (Android'e bağlı değil, Compose/ViewModel'den çağrılır) |
| `DailyTracker.kt` | Android: "bugün oynandı mı?" (DataStore) |

İki sürüm aynı gün için **aynı cevabı** seçer. Web ve mobil sürüm aynı
günlük karakteri gösterir.

## Kural
- Çoklu değerler `|` ile: `"Orta|Destek"`. Hepsi aynı 🟩, en az biri ortak 🟨, hiçbiri 🟥.
- `type: "number"` olan özellikte yön de verilir: ⬆️ cevap daha büyük, ⬇️ daha küçük (ör. çıkış yılı).
- Günlük modda cevap tarih + `salt`'tan hesaplanır. Liste sırası değişse de aynı kalır.
  Eski `(gün + yıl) % n` yöntemi art arda günlerde listede yan yana duran karakterleri seçiyordu; bu yöntem öyle yapmıyor.

## JS
```js
const game = DleEngine.create({
  entities: [{ name: "Ahri", imageUrl: "…", attributes: { cinsiyet: "Kadın", koridor: "Orta", yil: "2011" } }],
  attributes: [{ key: "cinsiyet", label: "Cinsiyet" }, { key: "koridor", label: "Koridor" }, { key: "yil", label: "Yıl", type: "number" }],
  mode: "daily", salt: "lol", maxGuesses: 0
});
const r = game.guess("Lux");   // { ok, row: { name, cells: [{ label, value, state, direction }] }, won, lost }
// r.error: "unknown" | "duplicate" | "finished"
game.suggest("a");              // otomatik tamamlama
game.shareText("LoLdle");       // 🟩🟨⬆️ paylaşım metni
DleEngine.daily.markPlayed("lol"); DleEngine.daily.played("lol");
```

## Kotlin
```kotlin
val engine = DleEngine(entities, listOf(Attribute("cinsiyet", "Cinsiyet"), Attribute("yil", "Yıl", "number")),
                       daily = true, salt = "lol")
when (val r = engine.guess(text)) {
    is GuessResult.Ok -> rows.add(r.row)
    GuessResult.Unknown -> error = "Böyle bir karakter yok"
    GuessResult.Duplicate -> error = "Bunu zaten denedin"
    GuessResult.Finished -> {}
}
// ViewModel'de: if (engine.won) tracker.markPlayed("lol")
```
`DleEngine.kt`'deki `package` satırını kendi projenize göre değiştirin.
