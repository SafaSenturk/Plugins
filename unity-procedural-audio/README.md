# unity-procedural-audio

Ses dosyası **olmadan** oyun efektleri. Sesler kodla, sinüs dalgası ve gürültüden üretilir.
SupermarketOyunu'ndaki `SesYonetici`'den çıkarıldı. Projeye tek dosya eklenir, sahneye bir şey koymanız gerekmez.

`SesYonetici.cs`'yi `Assets/Scripts/` altına koyun.

```csharp
SesYonetici.Bip();        // kasa / seçim
SesYonetici.Para();       // ödül
SesYonetici.Tik();        // menü
SesYonetici.Gumleme();    // düşen kutu
SesYonetici.Darbe();  SesYonetici.SertDarbe();
SesYonetici.Gong();   SesYonetici.Hata();   SesYonetici.Basari();
SesYonetici.Ton(880f, 0.1f);                 // istediğiniz frekans
SesYonetici.AlkisSeviyesi(coşku);            // 0..1, her kare çağrılabilir
SesYonetici.AnaSes = 0.5f;                   // ayarlar menüsü

// kendi sesiniz: t saniye → -1..1 dalga
var lazer = SesYonetici.Uret("Lazer", 0.3f, t => Mathf.Sin(2f * Mathf.PI * (1200f - 3000f * t) * t));
SesYonetici.Cal(lazer, 0.7f);
```

Hazır efektler ilk çalındıklarında bir kez üretilir, sonra bellekten çalınır.
Orijinaldeki `Koli` → `Gumleme`, `Yumruk` → `Darbe` olarak genel adlar aldı.
