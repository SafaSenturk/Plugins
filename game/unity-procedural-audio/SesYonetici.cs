using System;
using System.Collections.Generic;
using UnityEngine;

// PROSEDÜREL SES — ses dosyası kullanmaz, efektleri matematikle (sinüs
// dalgaları ve gürültü) kendisi üretir. SupermarketOyunu'ndan çıkarıldı.
// İlk kullanımda kendini kurar; sahneye bir şey eklemeniz gerekmez.
//
//   SesYonetici.Bip();  SesYonetici.Para();  SesYonetici.Gong();
//   SesYonetici.Ton(660f, 0.2f);                         // tek ton
//   var lazer = SesYonetici.Uret("Lazer", 0.3f, t => Mathf.Sin(2f * Mathf.PI * (1200f - 3000f * t) * t));
//   SesYonetici.Cal(lazer, 0.7f);
//   SesYonetici.AlkisSeviyesi(0.8f);                     // her kare çağrılabilir
//   SesYonetici.AnaSes = 0.5f;                           // ayarlar menüsü için
public static class SesYonetici
{
    const int OrneklemeHizi = 44100;

    /// <summary>Tüm efektlerin genel ses seviyesi (0..1).</summary>
    public static float AnaSes = 1f;

    static AudioSource kaynak;
    static AudioSource alkisKaynak;   // kalabalık alkışı: ayrı kanalda döngüyle çalar
    static readonly Dictionary<string, AudioClip> klipler = new Dictionary<string, AudioClip>();

    static void Hazirla()
    {
        if (kaynak != null) return;

        GameObject nesne = new GameObject("SesYonetici");
        UnityEngine.Object.DontDestroyOnLoad(nesne); // sahne değişince kesilmesin
        kaynak = nesne.AddComponent<AudioSource>();
        kaynak.playOnAwake = false;

        // Alkış kendi kanalında döner (PlayOneShot ile üst üste bindirilemez)
        alkisKaynak = nesne.AddComponent<AudioSource>();
        alkisKaynak.loop = true;
        alkisKaynak.playOnAwake = false;
        alkisKaynak.clip = AlkisUret();
    }

    // Aynı efekt her çağrıda yeniden üretilmesin
    static AudioClip Hazir(string ad, float sure, Func<float, float> dalga)
    {
        if (!klipler.TryGetValue(ad, out AudioClip k) || k == null)
        {
            k = Uret(ad, sure, dalga);
            klipler[ad] = k;
        }
        return k;
    }

    /// <summary>Verilen dalga fonksiyonundan (t saniye → -1..1), sonu yumuşakça sönen bir ses üretir.</summary>
    public static AudioClip Uret(string ad, float sure, Func<float, float> dalga)
    {
        int adet = Mathf.Max(1, (int)(OrneklemeHizi * sure));
        float[] ornekler = new float[adet];
        for (int i = 0; i < adet; i++)
        {
            float t = (float)i / OrneklemeHizi;
            float zarf = 1f - (t / sure);           // zamanla sönme
            ornekler[i] = Mathf.Clamp(dalga(t) * zarf * zarf, -1f, 1f);
        }
        AudioClip klip = AudioClip.Create(ad, adet, 1, OrneklemeHizi, false);
        klip.SetData(ornekler, 0);
        return klip;
    }

    /// <summary>Herhangi bir klibi efekt kanalında çalar.</summary>
    public static void Cal(AudioClip klip, float seviye = 1f)
    {
        if (klip == null) return;
        Hazirla();
        kaynak.PlayOneShot(klip, seviye * AnaSes);
    }

    /// <summary>Tek frekanslı kısa ton (menü, bildirim, geri sayım…).</summary>
    public static void Ton(float frekans, float sure = 0.12f, float seviye = 0.5f)
    {
        string ad = "Ton" + Mathf.RoundToInt(frekans) + "_" + Mathf.RoundToInt(sure * 1000f);
        Cal(Hazir(ad, sure, t => Mathf.Sin(2f * Mathf.PI * frekans * t)), seviye);
    }

    // ---------- hazır efektler ----------

    // Kasa bip'i: kısa, tiz tek ton
    public static void Bip() => Cal(Hazir("Bip", 0.10f, t => Mathf.Sin(2f * Mathf.PI * 1150f * t)), 0.5f);

    // Para / ödül: iki tonlu neşeli çınlama (do-mi gibi)
    public static void Para() => Cal(Hazir("Para", 0.25f, t =>
        t < 0.12f ? Mathf.Sin(2f * Mathf.PI * 880f * t) : Mathf.Sin(2f * Mathf.PI * 1318f * t)), 0.6f);

    // Kutu / düşme: kalın, tok bir gümleme
    public static void Gumleme() => Cal(Hazir("Gumleme", 0.15f, t =>
        Mathf.Sin(2f * Mathf.PI * 95f * t) * 0.9f + Mathf.Sin(2f * Mathf.PI * 55f * t) * 0.5f), 0.8f);

    // Tık: yumuşak, kısa dokunuş (menü, eşya bırakma)
    public static void Tik() => Cal(Hazir("Tik", 0.05f, t => Mathf.Sin(2f * Mathf.PI * 520f * t)), 0.4f);

    // Darbe: sert, kısa vuruş
    public static void Darbe() => Cal(Hazir("Darbe", 0.08f, t =>
        Mathf.Sin(2f * Mathf.PI * 180f * t) * 0.9f + Mathf.Sin(2f * Mathf.PI * 320f * t) * 0.4f), 0.9f);

    // Sert darbe: derin, gümbürtülü
    public static void SertDarbe() => Cal(Hazir("SertDarbe", 0.2f, t =>
        Mathf.Sin(2f * Mathf.PI * 90f * t) + Mathf.Sin(2f * Mathf.PI * 140f * t) * 0.6f), 1f);

    // Gong: başlangıç/bitiş metalik çınlama
    public static void Gong() => Cal(Hazir("Gong", 0.9f, t =>
        Mathf.Sin(2f * Mathf.PI * 520f * t) * 0.8f + Mathf.Sin(2f * Mathf.PI * 780f * t) * 0.4f), 0.8f);

    // Hata / olmaz: alçalan iki ton
    public static void Hata() => Cal(Hazir("Hata", 0.28f, t =>
        Mathf.Sin(2f * Mathf.PI * (t < 0.13f ? 330f : 220f) * t)), 0.5f);

    // Seviye atlama: yükselen üç nota
    public static void Basari() => Cal(Hazir("Basari", 0.45f, t =>
        Mathf.Sin(2f * Mathf.PI * (t < 0.15f ? 523f : t < 0.3f ? 659f : 784f) * t)), 0.6f);

    // KALABALIK ALKIŞI: gerçek alkış geniş bantlı bir çıtırtıdır, ton değil —
    // bu yüzden gürültüden üretiliyor: alçak uğultu tabanı + üstüne yüzlerce
    // kısa gürültü patlaması. 3 saniyelik döngü; patlamalar dizinin sonundan
    // başına sarıyor ki döngü dikişi duyulmasın.
    static AudioClip AlkisUret()
    {
        const float sure = 3f;
        int adet = (int)(OrneklemeHizi * sure);
        float[] ornekler = new float[adet];
        System.Random rnd = new System.Random(20260725); // her açılışta aynı ses

        float akan = 0f;
        for (int i = 0; i < adet; i++)
        {
            float gurultu = (float)(rnd.NextDouble() * 2.0 - 1.0);
            akan = akan * 0.97f + gurultu * 0.03f;
            ornekler[i] = akan * 0.5f;
        }

        int cirpmaSayisi = (int)(sure * 34f);
        int cirpmaBoyu = OrneklemeHizi / 24; // ~42 ms
        for (int c = 0; c < cirpmaSayisi; c++)
        {
            int bas = rnd.Next(0, adet);
            float siddet = 0.3f + (float)rnd.NextDouble() * 0.55f;
            float onceki = 0f;
            for (int i = 0; i < cirpmaBoyu; i++)
            {
                float t = (float)i / cirpmaBoyu;
                float zarf = Mathf.Exp(-t * 11f);
                float gurultu = (float)(rnd.NextDouble() * 2.0 - 1.0);
                onceki = onceki * 0.45f + gurultu * 0.55f;
                ornekler[(bas + i) % adet] += onceki * zarf * siddet;
            }
        }

        for (int i = 0; i < adet; i++) ornekler[i] = Mathf.Clamp(ornekler[i], -1f, 1f);

        AudioClip klip = AudioClip.Create("Alkis", adet, 1, OrneklemeHizi, false);
        klip.SetData(ornekler, 0);
        return klip;
    }

    /// <summary>Alkış yoğunluğu 0..1 — her kare çağrılabilir. 0'a yaklaşınca durur.</summary>
    public static void AlkisSeviyesi(float seviye)
    {
        Hazirla();
        seviye = Mathf.Clamp01(seviye);
        if (seviye <= 0.01f)
        {
            if (alkisKaynak.isPlaying) alkisKaynak.Stop();
            return;
        }
        if (!alkisKaynak.isPlaying) alkisKaynak.Play();
        alkisKaynak.volume = seviye * 0.7f * AnaSes;
        alkisKaynak.pitch = 0.94f + seviye * 0.12f; // coşku arttıkça hafifçe tizleşir
    }
}
