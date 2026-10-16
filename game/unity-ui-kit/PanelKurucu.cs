using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

// Panel üretim aracı: koyu arka planlı, otomatik dizilimli menü panelleri,
// satırlar ve tıklanabilir butonlar. ArayuzStili'ni kullanır.
//
//   GameObject p = PanelKurucu.Panel("Ayarlar", "AYARLAR", 460);
//   Transform satir = PanelKurucu.Satir(p, "Ses");
//   PanelKurucu.Buton(satir, "Aç", 90, () => SesYonetici.AnaSes = 1f);
//   PanelKurucu.MenuButonu(p, "Kapat", () => Object.Destroy(p));
public static class PanelKurucu
{
    // Yumuşak kenarlı daire sprite (yetenek ağacı düğümleri için)
    static Sprite daire;
    public static Sprite Daire()
    {
        if (daire != null) return daire;
        int boyut = 64;
        Texture2D doku = new Texture2D(boyut, boyut, TextureFormat.ARGB32, false);
        Vector2 merkez = Vector2.one * (boyut / 2f - 0.5f);
        for (int y = 0; y < boyut; y++)
            for (int x = 0; x < boyut; x++)
            {
                float uzaklik = Vector2.Distance(new Vector2(x, y), merkez);
                doku.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(30f - uzaklik)));
            }
        doku.Apply();
        daire = Sprite.Create(doku, new Rect(0, 0, boyut, boyut), Vector2.one * 0.5f);
        return daire;
    }

    // Ekranın ortasında başlıklı bir panel oluşturur
    // (ArayuzStili: yuvarlak köşe, altın çerçeve, altın başlık + ayraç çizgi)
    public static GameObject Panel(string ad, string baslik, float genislik)
    {
        GameObject panel = new GameObject(ad);
        panel.transform.SetParent(ArayuzStili.Kanvas, false);

        Image cerceve = panel.AddComponent<Image>();
        cerceve.sprite = ArayuzStili.YuvarlakSprite();
        cerceve.type = Image.Type.Sliced;
        cerceve.color = ArayuzStili.Cerceve;
        ArayuzStili.IcDolgu(panel.transform, true); // opak koyu iç dolgu

        RectTransform rt = panel.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(genislik, 100);

        VerticalLayoutGroup dizilim = panel.AddComponent<VerticalLayoutGroup>();
        dizilim.padding = new RectOffset(24, 24, 20, 20);
        dizilim.spacing = 8;
        dizilim.childControlWidth = true;
        dizilim.childControlHeight = true;
        dizilim.childForceExpandWidth = true;
        dizilim.childForceExpandHeight = false;

        ContentSizeFitter sigdirici = panel.AddComponent<ContentSizeFitter>();
        sigdirici.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        Text baslikYazisi = Yazi(panel.transform, baslik, 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        baslikYazisi.color = ArayuzStili.Altin;

        // Başlık altı ince ayraç
        GameObject cizgi = new GameObject("Ayrac");
        cizgi.transform.SetParent(panel.transform, false);
        Image cizgiGorsel = cizgi.AddComponent<Image>();
        cizgiGorsel.color = ArayuzStili.Cerceve;
        cizgiGorsel.raycastTarget = false;
        LayoutElement cizgiOlcu = cizgi.AddComponent<LayoutElement>();
        cizgiOlcu.minHeight = 2;
        cizgiOlcu.preferredHeight = 2;

        return panel;
    }

    public static Text Yazi(Transform ebeveyn, string metin, int boyut, FontStyle stil, TextAnchor hiza)
    {
        Text yazi = ArayuzStili.YaziTemel(ebeveyn, metin, boyut, stil, Color.white, hiza);
        yazi.gameObject.AddComponent<LayoutElement>().minHeight = boyut + 12;
        return yazi;
    }

    // Satır: solda etiket, sağa butonlar eklenir
    public static Transform Satir(GameObject panel, string etiket)
    {
        GameObject satir = new GameObject("Satir");
        satir.transform.SetParent(panel.transform, false);

        HorizontalLayoutGroup dizilim = satir.AddComponent<HorizontalLayoutGroup>();
        dizilim.spacing = 8;
        dizilim.childControlWidth = true;
        dizilim.childControlHeight = true;
        dizilim.childForceExpandWidth = false;
        dizilim.childForceExpandHeight = false;
        dizilim.childAlignment = TextAnchor.MiddleLeft;
        satir.AddComponent<LayoutElement>().minHeight = 42;

        Text etiketYazisi = Yazi(satir.transform, etiket, 23, FontStyle.Normal, TextAnchor.MiddleLeft);
        etiketYazisi.GetComponent<LayoutElement>().flexibleWidth = 1;
        return satir.transform;
    }

    public static Button Buton(Transform satir, string etiket, float genislik, UnityAction tiklama)
    {
        Button buton = ButonTemel(satir, etiket, 21, tiklama);
        LayoutElement olcu = buton.gameObject.AddComponent<LayoutElement>();
        olcu.preferredWidth = genislik;
        olcu.preferredHeight = 36;
        return buton;
    }

    // Sekme çubuğu: eşit genişlikte yatay butonlar; aktif olan altın rengi
    public static void SekmeSatiri(GameObject panel, string[] etiketler, int aktif, System.Action<int> sec)
    {
        GameObject satir = new GameObject("SekmeSatiri");
        satir.transform.SetParent(panel.transform, false);

        HorizontalLayoutGroup dizilim = satir.AddComponent<HorizontalLayoutGroup>();
        dizilim.spacing = 6;
        dizilim.childControlWidth = true;
        dizilim.childControlHeight = true;
        dizilim.childForceExpandWidth = true;
        dizilim.childForceExpandHeight = false;
        dizilim.childAlignment = TextAnchor.MiddleCenter;
        satir.AddComponent<LayoutElement>().minHeight = 50;

        for (int i = 0; i < etiketler.Length; i++)
        {
            int indeks = i;
            Button buton = ButonTemel(satir.transform, etiketler[i], 22, () => sec(indeks));
            LayoutElement olcu = buton.gameObject.AddComponent<LayoutElement>();
            olcu.flexibleWidth = 1;
            olcu.minHeight = 46;

            if (i == aktif)
            {
                buton.GetComponent<Image>().color = ArayuzStili.Altin;
                buton.GetComponentInChildren<Text>().color = new Color(0.1f, 0.1f, 0.12f);
            }
        }
    }

    // Tam genişlik menü butonu (duraklatma menüsü gibi dikey listeler için)
    public static Button MenuButonu(GameObject panel, string etiket, UnityAction tiklama)
    {
        Button buton = ButonTemel(panel.transform, etiket, 24, tiklama);
        LayoutElement olcu = buton.gameObject.AddComponent<LayoutElement>();
        olcu.minHeight = 48;
        olcu.preferredHeight = 48;
        return buton;
    }

    // Ekranı karartan, tıklamaları arkaya geçirmeyen tam ekran perde
    public static GameObject Karartma(float opaklik = 0.55f)
    {
        GameObject karartma = new GameObject("Karartma");
        karartma.transform.SetParent(ArayuzStili.Kanvas, false);
        Image golge = karartma.AddComponent<Image>();
        golge.color = new Color(0f, 0f, 0f, opaklik);
        RectTransform rt = golge.rectTransform;
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        return karartma;
    }

    // Ortak buton görseli: yuvarlak köşe, çelik mavisi, fare üstünde parlar
    static Button ButonTemel(Transform ebeveyn, string etiket, int yaziBoyu, UnityAction tiklama)
    {
        GameObject nesne = new GameObject("Buton_" + etiket);
        nesne.transform.SetParent(ebeveyn, false);

        Image gorsel = nesne.AddComponent<Image>();
        gorsel.sprite = ArayuzStili.YuvarlakSprite();
        gorsel.type = Image.Type.Sliced;
        gorsel.color = ArayuzStili.ButonMavi;

        Button buton = nesne.AddComponent<Button>();
        buton.targetGraphic = gorsel;
        buton.onClick.AddListener(tiklama);

        ColorBlock renkler = buton.colors;
        renkler.normalColor = Color.white;
        renkler.highlightedColor = new Color(1.35f, 1.35f, 1.4f); // fare üstünde parlama
        renkler.pressedColor = new Color(0.65f, 0.65f, 0.7f);
        renkler.selectedColor = Color.white;
        renkler.fadeDuration = 0.08f;
        buton.colors = renkler;

        Text yazi = Yazi(nesne.transform, etiket, yaziBoyu, FontStyle.Bold, TextAnchor.MiddleCenter);
        Object.Destroy(yazi.GetComponent<LayoutElement>()); // buton içinde serbest yerleşim
        RectTransform yaziRt = yazi.GetComponent<RectTransform>();
        yaziRt.anchorMin = Vector2.zero;
        yaziRt.anchorMax = Vector2.one;
        yaziRt.offsetMin = Vector2.zero;
        yaziRt.offsetMax = Vector2.zero;

        return buton;
    }
}
