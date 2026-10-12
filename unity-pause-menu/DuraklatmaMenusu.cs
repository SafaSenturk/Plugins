using System;
using System.Collections.Generic;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

// DURAKLATMA MENÜSÜ — Escape ile oyun donar, karartılmış ekranda tıklanabilir
// menü açılır (Devam / Kaydet / Yükle / Ayarlar / Çık). SupermarketOyunu'ndan
// çıkarıldı; oyuna özel hiçbir sınıfa bağlı değil. unity-ui-kit gerekir.
//
// Kendiliğinden kurulur. Oyununuza bağlamak için (ör. bir Awake içinde):
//   DuraklatmaMenusu.Kaydet = () => kayit.Kaydet();
//   DuraklatmaMenusu.Yukle  = () => kayit.Yukle();
//   DuraklatmaMenusu.Engel  = () => envanterAcik;          // açıkken Esc menüyü açmasın
//   DuraklatmaMenusu.EkButon("⚙   Ayarlar", AyarlarAc);
//   DuraklatmaMenusu.Degisti += durdu => muzik.Pause(durdu);
// Başka yerde: if (DuraklatmaMenusu.Duraklatildi) return;
public class DuraklatmaMenusu : MonoBehaviour
{
    public static bool Duraklatildi { get; private set; }

    /// <summary>Menü başlığı.</summary>
    public static string Baslik = "OYUN DURAKLATILDI";
    /// <summary>Doluysa Kaydet butonu ve F5 kısayolu çıkar.</summary>
    public static Action Kaydet;
    /// <summary>Doluysa Yükle butonu ve F9 kısayolu çıkar.</summary>
    public static Action Yukle;
    /// <summary>true döndürdüğü sürece Esc menüyü açmaz (başka bir ekran açıkken).</summary>
    public static Func<bool> Engel;
    /// <summary>Oyun devam ederken fare imleci kilitli ve gizli mi olsun (FPS oyunları için true).</summary>
    public static bool OyundaImlecKilitli = true;
    /// <summary>Duraklatıldı (true) / devam etti (false).</summary>
    public static event Action<bool> Degisti;

    static readonly List<KeyValuePair<string, Action>> ekButonlar = new List<KeyValuePair<string, Action>>();
    /// <summary>Devam ile Çık arasına buton ekler.</summary>
    public static void EkButon(string etiket, Action tikla) => ekButonlar.Add(new KeyValuePair<string, Action>(etiket, tikla));

    static DuraklatmaMenusu ornek;
    GameObject panel, karartma;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void OtomatikKur()
    {
        Duraklatildi = false; // önceki oturumdan kalmasın
        Time.timeScale = 1f;
        if (ornek != null) return;
        GameObject go = new GameObject("DuraklatmaMenusu");
        DontDestroyOnLoad(go);
        ornek = go.AddComponent<DuraklatmaMenusu>();
    }

    void Update()
    {
        if (!Duraklatildi && Engel != null && Engel()) return;

        if (Basildi("esc")) Degistir();
        if (Kaydet != null && Basildi("f5")) Kaydet();
        if (Yukle != null && Basildi("f9")) { if (Duraklatildi) Degistir(); Yukle(); }
        if (Duraklatildi && Basildi("q")) KaydetVeCik();
    }

    static bool Basildi(string tus)
    {
#if ENABLE_INPUT_SYSTEM
        Keyboard k = Keyboard.current;
        if (k == null) return false;
        switch (tus)
        {
            case "esc": return k.escapeKey.wasPressedThisFrame;
            case "f5": return k.f5Key.wasPressedThisFrame;
            case "f9": return k.f9Key.wasPressedThisFrame;
            case "q": return k.qKey.wasPressedThisFrame;
        }
        return false;
#else
        switch (tus)
        {
            case "esc": return Input.GetKeyDown(KeyCode.Escape);
            case "f5": return Input.GetKeyDown(KeyCode.F5);
            case "f9": return Input.GetKeyDown(KeyCode.F9);
            case "q": return Input.GetKeyDown(KeyCode.Q);
        }
        return false;
#endif
    }

    /// <summary>Kodla aç/kapat (ör. mobilde ekrandaki duraklat düğmesi).</summary>
    public static void Ac() { if (ornek != null && !Duraklatildi) ornek.Degistir(); }
    public static void Kapat() { if (ornek != null && Duraklatildi) ornek.Degistir(); }

    void Degistir()
    {
        Duraklatildi = !Duraklatildi;
        Time.timeScale = Duraklatildi ? 0f : 1f; // oyunu dondur/çöz
        bool kilit = !Duraklatildi && OyundaImlecKilitli;
        Cursor.lockState = kilit ? CursorLockMode.Locked : CursorLockMode.None;
        Cursor.visible = !kilit;

        if (Duraklatildi) MenuKur();
        else
        {
            if (panel != null) Destroy(panel);
            if (karartma != null) Destroy(karartma);
        }
        Degisti?.Invoke(Duraklatildi);
    }

    void MenuKur()
    {
        karartma = PanelKurucu.Karartma();                 // önce perde, panel üstte kalsın
        panel = PanelKurucu.Panel("DuraklatmaPaneli", Baslik, 420);
        PanelKurucu.MenuButonu(panel, "▶   Devam Et   (Esc)", Degistir);
        if (Kaydet != null)
            PanelKurucu.MenuButonu(panel, "💾   Kaydet   (F5)", () => Kaydet());
        if (Yukle != null)
            PanelKurucu.MenuButonu(panel, "📂   Yükle   (F9)", () => { Degistir(); Yukle(); });
        foreach (var b in ekButonlar)
        {
            Action tikla = b.Value;
            PanelKurucu.MenuButonu(panel, b.Key, () => tikla());
        }
        PanelKurucu.MenuButonu(panel, Kaydet != null ? "🚪   Kaydet ve Çık   (Q)" : "🚪   Çık   (Q)", KaydetVeCik);
    }

    void KaydetVeCik()
    {
        Kaydet?.Invoke();
        Time.timeScale = 1f;
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
}
