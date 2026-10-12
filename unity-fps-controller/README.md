# unity-fps-controller

Birinci şahıs oyuncu kontrolü: WASD ile yürüme, Shift ile koşma, Space ile zıplama, fareyle bakış.
SupermarketOyunu'ndaki `OyuncuKontrol`'den çıkarıldı. Market, dövüş ve yetenek sistemine olan bağları kaldırıldı.

## Kurulum
1. Bir `Oyuncu` nesnesi oluşturun ve `OyuncuKontrol` ekleyin (CharacterController kendiliğinden gelir).
2. Kamerayı oyuncunun **alt nesnesi** yapın ve göz hizasına koyun (y ≈ 1,6). Kamera kendiliğinden bulunur.

```csharp
OyuncuKontrol.Engel = () => envanter.Acik || diyalog.Acik;  // açıkken bakış ve hareket durur
OyuncuKontrol.HareketEngeli = () => konusuyor;               // bakış serbest, yürüme kapalı
oyuncu.hizCarpani = 1f + seviye * 0.05f;                     // yetenek / iksir
```

- Oyun duraklatıldığında (`Time.timeScale = 0`) kendiliğinden durur. [unity-pause-menu](../unity-pause-menu/) ile birlikte çalışır.
- Input System de eski Input Manager da desteklenir.
- Çapraz yürüme artık daha hızlı değil. Eski kodda `normalized` vardı ama gamepad için `ClampMagnitude` daha doğru.
