using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

// Ortak arayüz stili: yuvarlak köşeli koyu paneller, altın çerçeve, gölgeli
// yazılar ve dolum barları. HUD'lar ve menüler aynı görsel dili buradan alır —
// tek yerden değişir. SupermarketOyunu'ndan çıkarıldı. Hiçbir sprite, font ya
// da prefab gerektirmez; her şey kodla üretilir.
public static class ArayuzStili
{
    // ---------- kanvas ----------
    static Canvas kanvas;

    /// <summary>Tüm panellerin ebeveyni. Yoksa 1920x1080'e göre ölçeklenen bir kanvas ve EventSystem kurar.
    /// Kendi kanvasınızı kullanmak için önce ArayuzStili.KanvasAta(benimKanvas) çağırın.</summary>
    public static Transform Kanvas
    {
        get
        {
            if (kanvas == null) KanvasKur();
            return kanvas.transform;
        }
    }

    public static void KanvasAta(Canvas c) { kanvas = c; OlaySistemiKur(); }

    static void KanvasKur()
    {
        GameObject go = new GameObject("ArayuzKanvasi");
        kanvas = go.AddComponent<Canvas>();
        kanvas.renderMode = RenderMode.ScreenSpaceOverlay;
        kanvas.sortingOrder = 100;
        CanvasScaler olcek = go.AddComponent<CanvasScaler>();
        olcek.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        olcek.referenceResolution = new Vector2(1920, 1080);
        olcek.matchWidthOrHeight = 0.5f;
        go.AddComponent<GraphicRaycaster>(); // buton tıklamaları
        OlaySistemiKur();
    }

    // Butonların tıklanabilmesi için sahnede bir EventSystem olmalı
    static void OlaySistemiKur()
    {
        if (EventSystem.current != null || Object.FindFirstObjectByType<EventSystem>() != null) return;
        GameObject olay = new GameObject("EventSystem");
        olay.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
        olay.AddComponent<InputSystemUIInputModule>();
#else
        olay.AddComponent<StandaloneInputModule>();
#endif
    }

    // Ortak renk paleti
    public static readonly Color PanelIci     = new Color(0.06f, 0.07f, 0.11f, 0.78f);
    public static readonly Color PanelIciKoyu = new Color(0.05f, 0.06f, 0.1f, 0.94f);   // menüler (arkası okunmasın)
    public static readonly Color Cerceve      = new Color(0.95f, 0.78f, 0.3f, 0.35f);   // altın
    public static readonly Color BarZemin     = new Color(0f, 0f, 0f, 0.55f);
    public static readonly Color YaziBeyaz    = new Color(0.96f, 0.96f, 0.98f);
    public static readonly Color YaziGri      = new Color(0.75f, 0.76f, 0.8f);
    public static readonly Color Altin        = new Color(0.95f, 0.78f, 0.3f);
    public static readonly Color ParaYesili   = new Color(0.55f, 0.9f, 0.4f);
    public static readonly Color UyariSarisi  = new Color(1f, 0.85f, 0.3f);
    public static readonly Color ButonMavi    = new Color(0.2f, 0.32f, 0.52f);

    // Altın çerçeveli koyu panel; dış RectTransform döner.
    // koyu=true menüler için opak iç dolgu kullanır.
    public static RectTransform Panel(Transform ebeveyn, Vector2 kose, Vector2 konum, Vector2 boyut, bool koyu = false)
    {
        GameObject dis = new GameObject("Panel");
        dis.transform.SetParent(ebeveyn, false);
        Image cerceve = dis.AddComponent<Image>();
        cerceve.sprite = YuvarlakSprite();
        cerceve.type = Image.Type.Sliced;
        cerceve.color = Cerceve;
        cerceve.raycastTarget = false;
        RectTransform rt = cerceve.rectTransform;
        rt.anchorMin = kose;
        rt.anchorMax = kose;
        rt.pivot = new Vector2(0, 1);
        rt.anchoredPosition = konum;
        rt.sizeDelta = boyut;
        IcDolgu(dis.transform, koyu);
        return rt;
    }

    // Panelin iç dolgusunu ekler (çerçeveden 2px içeride)
    public static Image IcDolgu(Transform panel, bool koyu)
    {
        GameObject ic = new GameObject("Ic");
        ic.transform.SetParent(panel, false);
        Image dolgu = ic.AddComponent<Image>();
        dolgu.sprite = YuvarlakSprite();
        dolgu.type = Image.Type.Sliced;
        dolgu.color = koyu ? PanelIciKoyu : PanelIci;
        dolgu.raycastTarget = false;
        RectTransform icRt = dolgu.rectTransform;
        icRt.anchorMin = Vector2.zero;
        icRt.anchorMax = Vector2.one;
        icRt.offsetMin = new Vector2(2, 2);
        icRt.offsetMax = new Vector2(-2, -2);
        // Otomatik dizilimli panellerde çerçeve hesaba katılmasın
        ic.AddComponent<LayoutElement>().ignoreLayout = true;
        return dolgu;
    }

    // Yuvarlak köşeli düz renk bloğu (başlık çubuğu, kart zemini vb.)
    public static Image Kutu(Transform ebeveyn, Vector2 kose, Vector2 konum, Vector2 boyut, Color renk)
    {
        GameObject go = new GameObject("Kutu");
        go.transform.SetParent(ebeveyn, false);
        Image img = go.AddComponent<Image>();
        img.sprite = YuvarlakSprite();
        img.type = Image.Type.Sliced;
        img.color = renk;
        img.raycastTarget = false;
        RectTransform rt = img.rectTransform;
        rt.anchorMin = kose; rt.anchorMax = kose; rt.pivot = new Vector2(0, 1);
        rt.anchoredPosition = konum; rt.sizeDelta = boyut;
        return img;
    }

    // Mutlak konumlu tıklanabilir buton (masaüstü arayüzü için)
    public static Button Buton(Transform ebeveyn, string etiket, Vector2 kose, Vector2 konum,
        Vector2 boyut, Color renk, System.Action tikla, int yaziBoyu = 20)
    {
        GameObject go = new GameObject("Buton_" + etiket);
        go.transform.SetParent(ebeveyn, false);
        Image img = go.AddComponent<Image>();
        img.sprite = YuvarlakSprite();
        img.type = Image.Type.Sliced;
        img.color = renk;
        Button buton = go.AddComponent<Button>();
        buton.targetGraphic = img;
        if (tikla != null) buton.onClick.AddListener(() => tikla());
        ColorBlock cb = buton.colors;
        cb.normalColor = Color.white;
        cb.highlightedColor = new Color(1.22f, 1.22f, 1.28f);
        cb.pressedColor = new Color(0.7f, 0.7f, 0.75f);
        cb.selectedColor = Color.white;
        cb.fadeDuration = 0.08f;
        buton.colors = cb;
        RectTransform rt = img.rectTransform;
        rt.anchorMin = kose; rt.anchorMax = kose; rt.pivot = new Vector2(0, 1);
        rt.anchoredPosition = konum; rt.sizeDelta = boyut;

        Text t = YaziTemel(go.transform, etiket, yaziBoyu, FontStyle.Bold, YaziBeyaz, TextAnchor.MiddleCenter);
        RectTransform trt = t.rectTransform;
        trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
        trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;
        return buton;
    }

    // Gölgeli yazı (köşe çapası + konum + alan ile serbest yerleşim)
    public static Text Yazi(Transform ebeveyn, string metin, int boyut, FontStyle stil, Color renk,
        TextAnchor hiza, Vector2 kose, Vector2 konum, Vector2 alan)
    {
        Text yazi = YaziTemel(ebeveyn, metin, boyut, stil, renk, hiza);
        RectTransform rt = yazi.rectTransform;
        rt.anchorMin = kose;
        rt.anchorMax = kose;
        rt.pivot = new Vector2(0, 1);
        rt.anchoredPosition = konum;
        rt.sizeDelta = alan;
        return yazi;
    }

    // Gölgeli yazı (yerleşimi çağıran ayarlar)
    public static Text YaziTemel(Transform ebeveyn, string metin, int boyut, FontStyle stil, Color renk, TextAnchor hiza)
    {
        GameObject nesne = new GameObject("Yazi");
        nesne.transform.SetParent(ebeveyn, false);
        Text yazi = nesne.AddComponent<Text>();
        yazi.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        yazi.fontSize = boyut;
        yazi.fontStyle = stil;
        yazi.color = renk;
        yazi.alignment = hiza;
        yazi.text = metin;
        yazi.raycastTarget = false;
        Shadow golge = nesne.AddComponent<Shadow>();
        golge.effectColor = new Color(0f, 0f, 0f, 0.8f);
        golge.effectDistance = new Vector2(1.5f, -1.5f);
        return yazi;
    }

    // Zemin + renkli dolum barı; oran Doldur() ile ayarlanır
    public static Image Bar(RectTransform panel, Vector2 konum, Vector2 boyut, Color renk, out RectTransform dolumRt)
    {
        GameObject zemin = new GameObject("BarZemin");
        zemin.transform.SetParent(panel, false);
        Image zeminG = zemin.AddComponent<Image>();
        zeminG.sprite = YuvarlakSprite();
        zeminG.type = Image.Type.Sliced;
        zeminG.color = BarZemin;
        zeminG.raycastTarget = false;
        RectTransform zeminRt = zeminG.rectTransform;
        zeminRt.anchorMin = new Vector2(0, 1);
        zeminRt.anchorMax = new Vector2(0, 1);
        zeminRt.pivot = new Vector2(0, 1);
        zeminRt.anchoredPosition = konum;
        zeminRt.sizeDelta = boyut;

        GameObject dolum = new GameObject("BarDolum");
        dolum.transform.SetParent(zemin.transform, false);
        Image dolumG = dolum.AddComponent<Image>();
        dolumG.sprite = YuvarlakSprite();
        dolumG.type = Image.Type.Sliced;
        dolumG.color = renk;
        dolumG.raycastTarget = false;
        dolumRt = dolumG.rectTransform;
        dolumRt.anchorMin = new Vector2(0, 0);
        dolumRt.anchorMax = new Vector2(1, 1);
        dolumRt.offsetMin = new Vector2(3, 3);
        dolumRt.offsetMax = new Vector2(-3, -3);
        return dolumG;
    }

    // Dolum oranını uygular; çok düşükte bar gizlenir
    public static void Doldur(RectTransform dolumRt, GameObject dolumNesne, float oran)
    {
        oran = Mathf.Clamp01(oran);
        dolumNesne.SetActive(oran > 0.02f);
        dolumRt.anchorMax = new Vector2(oran, 1f);
    }

    // Yuvarlak köşeli 9 dilimli beyaz sprite (bir kez üretilir, renkle tonlanır)
    static Sprite yuvarlak;
    public static Sprite YuvarlakSprite()
    {
        if (yuvarlak != null) return yuvarlak;
        const int boyut = 40, yaricap = 12;
        Texture2D doku = new Texture2D(boyut, boyut, TextureFormat.RGBA32, false);
        for (int y = 0; y < boyut; y++)
            for (int x = 0; x < boyut; x++)
            {
                float dx = Mathf.Max(0, Mathf.Max(yaricap - x, x - (boyut - 1 - yaricap)));
                float dy = Mathf.Max(0, Mathf.Max(yaricap - y, y - (boyut - 1 - yaricap)));
                float uzaklik = Mathf.Sqrt(dx * dx + dy * dy);
                float alfa = Mathf.Clamp01(yaricap - uzaklik + 0.5f);
                doku.SetPixel(x, y, new Color(1f, 1f, 1f, alfa));
            }
        doku.filterMode = FilterMode.Bilinear;
        doku.Apply();
        yuvarlak = Sprite.Create(doku, new Rect(0, 0, boyut, boyut), new Vector2(0.5f, 0.5f),
            100f, 0, SpriteMeshType.FullRect, new Vector4(16, 16, 16, 16));
        return yuvarlak;
    }
}
