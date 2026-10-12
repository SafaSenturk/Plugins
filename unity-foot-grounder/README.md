# unity-foot-grounder

Humanoid karakterlerin animasyon değiştikçe **yere gömülmesini ya da havada süzülmesini** engeller.
Ayak kemiklerini ölçer ve modeli her karede kök hizasına oturtur. SupermarketOyunu'ndaki
`AyakSabitleyici`'nin aynısı; oyuna bağımlılığı yok.

```csharp
// karakterin kök nesnesine ekleyin; model = görünen model (Animator'lı alt nesne)
var sabit = kok.AddComponent<AyakSabitleyici>();
sabit.Kur(model.transform, model.GetComponent<Animator>());
```

- `Kur` çağrılırken model **T-pose**'da olmalı (Animator henüz pozu uygulamamışken, ör. modeli oluşturduğunuz karede).
- Zıplama gibi havada olması gereken anlarda karakteri yere çekmemesi için düzeltme ±0,45 m ile sınırlı (`EnFazlaDuzeltme`).
- Yalnızca Humanoid rig'de çalışır; değilse sessizce devre dışı kalır.
