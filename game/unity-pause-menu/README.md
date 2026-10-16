# unity-pause-menu

Esc ile açılan duraklatma menüsü. Oyun donar (`Time.timeScale = 0`), ekran kararır, tıklanabilir menü çıkar:
Devam / Kaydet / Yükle / (sizin butonlarınız) / Çık. SupermarketOyunu'ndan çıkarıldı.

**Gerekli:** [unity-ui-kit](../unity-ui-kit/) (`ArayuzStili.cs`, `PanelKurucu.cs`).
Input System de eski Input Manager da çalışır.

`DuraklatmaMenusu.cs`'yi projeye ekleyin. Sahneye bir şey koymanız gerekmez, kendiliğinden kurulur.

```csharp
void Awake()
{
    DuraklatmaMenusu.Kaydet = () => kayit.Kaydet();      // yoksa Kaydet butonu çıkmaz
    DuraklatmaMenusu.Yukle  = () => kayit.Yukle();
    DuraklatmaMenusu.Engel  = () => envanter.Acik;         // açıkken Esc menüyü açmasın
    DuraklatmaMenusu.EkButon("⚙   Ayarlar", AyarlariAc);
    DuraklatmaMenusu.Degisti += durdu => muzik.mute = durdu;
    DuraklatmaMenusu.OyundaImlecKilitli = false;           // fareyle oynanan (FPS olmayan) oyunlar
}

// oyuncu kodunda
if (DuraklatmaMenusu.Duraklatildi) return;
```

Kısayollar: Esc aç/kapat, F5 kaydet, F9 yükle, Q (menüdeyken) kaydet ve çık.
Mobilde ekrandaki bir düğmeden `DuraklatmaMenusu.Ac()` çağırın.
