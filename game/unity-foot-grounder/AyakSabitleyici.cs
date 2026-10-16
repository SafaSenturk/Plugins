using UnityEngine;

// AYAK HİZASI SABİTLEYİCİ — karakterin yerin altına gömülmesini veya havada
// süzülmesini kökten engeller.
//
// NEDEN GEREKLİ: Humanoid klip ayarları ("Bake Into Pose / Based Upon") klipten
// klibe farklı yükseklik referansı üretebiliyor; karakter animasyon değiştikçe
// zıplıyordu. Klip ayarlarını düzeltmek çözümün bir yarısı — bu bileşen diğer
// yarısı: ayak KEMİKLERİNİ ölçüp modeli her kare kök hizasına oturtuyor,
// yani animasyonun ne dediğine bakmadan sonucu garanti ediyor.
//
// Ayak kemiği bilekte durur, taban ondan birkaç santim aşağıdadır — o farkı
// ilk karede T-pose'dan ölçüp sabit olarak kullanıyoruz.
[DefaultExecutionOrder(200)]   // Animator pozu uyguladıktan SONRA çalış
public class AyakSabitleyici : MonoBehaviour
{
    Transform model;
    Transform solAyak, sagAyak;
    float tabanFarki;      // ayak bileği ile taban arası (ölçülüyor)
    bool hazir;

    // Havada olması GEREKEN anlarda (zıplama, düşme) karakteri yere çekmemek
    // için düzeltme sınırlanıyor.
    const float EnFazlaDuzeltme = 0.45f;

    public void Kur(Transform model, Animator animator)
    {
        this.model = model;
        if (animator == null || !animator.isHuman) return;

        solAyak = animator.GetBoneTransform(HumanBodyBones.LeftFoot);
        sagAyak = animator.GetBoneTransform(HumanBodyBones.RightFoot);
        if (solAyak == null || sagAyak == null) return;

        // T-pose'da (Animator henüz pozu ezmemişken) bilek-taban farkını ölç
        float enAltKemik = Mathf.Min(solAyak.position.y, sagAyak.position.y);
        float modelTabani = Taban();
        tabanFarki = enAltKemik - modelTabani;
        hazir = true;
    }

    // Modelin görünen en alt noktası
    float Taban()
    {
        Renderer[] rs = model.GetComponentsInChildren<Renderer>();
        if (rs.Length == 0) return model.position.y;
        float enAlt = rs[0].bounds.min.y;
        for (int i = 1; i < rs.Length; i++) enAlt = Mathf.Min(enAlt, rs[i].bounds.min.y);
        return enAlt;
    }

    void LateUpdate()
    {
        if (!hazir) return;

        // Yerde duran ayak hangisiyse o belirler (yürürken biri havada olur)
        float ayakTabani = Mathf.Min(solAyak.position.y, sagAyak.position.y) - tabanFarki;

        // Kökün konumu ayak hizası olmalı: farkı kapat
        float duzeltme = transform.position.y - ayakTabani;
        if (Mathf.Abs(duzeltme) < 0.001f) return;

        duzeltme = Mathf.Clamp(duzeltme, -EnFazlaDuzeltme, EnFazlaDuzeltme);
        model.position += Vector3.up * duzeltme;
    }
}
