# flutter-dev-tools

Flutter uygulamalarını **tasarımla karşılaştırmak, emülatörde otomatik kullanmak ve GitHub'da vitrine koymak** için yazdığım Python araçları. Bu hesaptaki altı Flutter projesinin README görselleri, simgeleri ve tasarım karşılaştırmaları bunlarla üretildi.

**Gereken:** Python 3 + Pillow (`pip install pillow`). `adb.py` için Android SDK.

| Araç | Ne yapar |
|---|---|
| `compare.py` | Emülatör görüntüsünü tasarım görseliyle aynı pt ızgarasına ölçekler; tasarım \| uygulama \| %50 bindirme yan yana |
| `measure.py` | Verilen kutulardaki yazının sınırlarını iki görüntüde de bulur; boşluk ve boyut farkını pt olarak yazar |
| `design_compare.py` | README için "Tasarım ↔ Flutter" görseli ve geçişli GIF üretir (`--credit "Tasarım: …"`) |
| `readme_assets.py` | Gradyan zeminli, üç telefonlu README banner'ı ve küçültülmüş ekran görüntüleri |
| `make_icon.py` | Pillow ile uygulama simgesi: Android (eski + adaptive) ve web ikonları; bag, sun, scan, chat, calendar, flower, leaf, globe |
| `adb.py` | Emülatörü sürer: ekran görüntüsü, dokun, kaydır, yaz, tuş, yazıya göre dokun (`find`); komutlar ` ; ` ile zincirlenir |
| `gfont.sh` | Google Fonts'tan istenen ağırlıklarda TTF indirir (uygulamaya gömmek için) |

```bash
# Birebir tasarım kontrolü (393×852 pt'lik ekran)
python compare.py design_pt.png screenshot.png out.jpg
python measure.py design_pt.png screenshot.png "baslik:15,120,200,175:dark" "buton:30,765,135,795:light"

# Emülatörde bir akışı otomatik oynat ve görüntü al
python adb.py "tap 540 1200 ; wait 1.5 ; find Sepete_ekle ; wait 1 ; shot shots/02_cart.png"

# README görselleri
python readme_assets.py assets.json
python make_icon.py ./my_app globe '#0283D3'
```

**Emülatörü tasarım boyutuna ayarlamak için:** `adb shell wm size 1080x2343` ve `adb shell wm density 440` komutları ekranı tam olarak 393 × 852 dp yapar. Geri almak için `wm size reset` ve `wm density reset`.

---

## English

Python tools I use to **compare a Flutter app with its design, drive the emulator and present apps on GitHub**. The README images, launcher icons and design comparisons of the six Flutter projects on this account were made with them. Needs Python 3 + Pillow (and the Android SDK for `adb.py`).

| Tool | What it does |
|---|---|
| `compare.py` | Design \| app \| 50 % overlay on the same pt grid |
| `measure.py` | Finds where text sits in both images and prints the pt difference |
| `design_compare.py` | Builds a "Design vs Flutter" sheet and a cross-fade GIF for a README |
| `readme_assets.py` | Builds a README banner with three phones and resized screenshots |
| `make_icon.py` | Draws the launcher icons (legacy + adaptive) and web icons |
| `adb.py` | Drives the emulator: screenshots, taps, swipes, typing, tap-by-text |
| `gfont.sh` | Downloads Google Fonts TTFs to bundle in an app |
