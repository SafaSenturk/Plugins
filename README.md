<div align="center">

<img src="docs/banner.png" alt="Plugins – uygulamalarımdan çıkardığım yeniden kullanılabilir parçalar" width="100%" />

# Plugins

Projelerimden çıkardığım, bağımsız ve yeniden kullanılabilir eklentiler ve şablonlar. Her klasörün kendi README'si var: ne işe yaradığı, nasıl eklendiği ve örnek kod.

[![Flutter](https://img.shields.io/badge/Flutter-8%20eklenti-02569B?logo=flutter&logoColor=white)](#-flutter--dart)
[![Web](https://img.shields.io/badge/Web-7%20eklenti-F7DF1E?logo=javascript&logoColor=black)](#-web-javascript--typescript)
[![Unity](https://img.shields.io/badge/Unity-5%20eklenti-222222?logo=unity&logoColor=white)](#-unity-c)

🇬🇧 [English](#-english)

</div>

---

## 📱 Flutter / Dart

Altı Flutter uygulamamdan çıkarıldı. Dart dosyalarının hepsi `flutter analyze` ile temiz ve testli; kopyalayıp projene ekleyebilirsin.

| Eklenti | Ne işe yarar | Kaynak uygulama |
|---|---|---|
| [flutter-motion-kit](flutter-motion-kit/) | **Kaydırarak onayla** düğmesi, basınca küçülen kartlar, sırayla beliren listeler, buzlu cam, yükleniyor iskeleti, boş/hata ekranı | [GlobeGo](https://github.com/SafaSenturk/flutter-travel-app-ui), [NovaShop](https://github.com/SafaSenturk/flutter-ecommerce-app) |
| [flutter-payment-card](flutter-payment-card/) | Luhn, marka tespiti, son kullanma ve CVV doğrulama, yazarken biçimleme, CVV'de dönen animasyonlu kart | [NovaShop](https://github.com/SafaSenturk/flutter-ecommerce-app) |
| [booking-slots](booking-slots/) | Çift rezervasyonu imkânsız kılan müsaitlik hesabı + Firestore transaction'ı + güvenlik kuralları | [Glow Studio](https://github.com/SafaSenturk/flutter-booking-app) |
| [firestore-chat-kit](firestore-chat-kit/) | Gerçek zamanlı sohbetin veri katmanı: okundu, yazıyor, tepki, düzenle/sil, güvenlik kuralları, bildirim fonksiyonu | [Pulse](https://github.com/SafaSenturk/flutter-firebase-chat) |
| [flutter-offline-cache](flutter-offline-cache/) | API yanıtları için önce çevrimdışı önbellek: internet yokken son veriyi "çevrimdışı" işaretiyle verir | [Atmos](https://github.com/SafaSenturk/flutter-weather-app) |
| [flutter-weather-sky](flutter-weather-sky/) | Havaya ve gece/gündüze göre hareketli gökyüzü, elle çizilmiş hava ikonları, WMO kodları | [Atmos](https://github.com/SafaSenturk/flutter-weather-app) |
| [flutter-image-filters](flutter-image-filters/) | Saf Dart ile Otsu, uyarlamalı eşik, Sobel, histogram eşitleme, konvolüsyon (OCR öncesi belge temizleme) | [Vision Lab](https://github.com/SafaSenturk/flutter-ai-vision-app) |
| [flutter-dev-tools](flutter-dev-tools/) | Python araçları: tasarımla piksel karşılaştırma, emülatör otomasyonu, README banner'ı, uygulama simgesi | altısının da vitrini |

## 🌐 Web (JavaScript / TypeScript)

| Eklenti | Açıklama | Kaynak proje |
|---|---|---|
| [page-editor](page-editor/) | Blok tabanlı görsel sayfa düzenleyici; sürükle-bırak, yerinde yazma, tema, TR/EN, yayınla + geçmiş | delamour |
| [orb3d](orb3d/) | Hareketli 3B tel kafes nesneler ve kıtalı dünya küresi; sürükle, şehir işaretleri, yaylar, kaydırma efekti | portföy |
| [web-utils](web-utils/) | `esc`, `slugify`, `money`/`parseNum` (TR), görsel küçültme, toast, güvenli localStorage | delamour |
| [persistent-store](persistent-store/) | localStorage'a kaydedilen dinlenebilir depo + hazır sepet/favoriler + React kancası | ecommerce-saas |
| [guess-game-engine](guess-game-engine/) | Loldle/Wordle tarzı tahmin oyunu motoru (JS + Kotlin), günlük mod, paylaşım metni | gamedle |
| [whatsapp-bot-kit](whatsapp-bot-kit/) | Evolution API istemcisi, webhook ayrıştırıcı, Gemini ile işletme adına cevap | whatsapp-ai-asistan |
| [nestjs-jwt-auth](nestjs-jwt-auth/) | NestJS kayıt/giriş, JWT, rol koruması, şifre değiştirme | ecommerce-backend |

## 🎮 Unity (C#)

| Eklenti | Açıklama |
|---|---|
| [unity-ui-kit](unity-ui-kit/) | Kodla kurulan arayüz: paneller, butonlar, sekmeler, barlar. Sprite/prefab gerekmez |
| [unity-pause-menu](unity-pause-menu/) | Esc ile duraklatma menüsü; kaydet/yükle/ek buton bağlanır (ui-kit gerekir) |
| [unity-fps-controller](unity-fps-controller/) | Birinci şahıs yürüme, koşma, zıplama, fareyle bakış |
| [unity-procedural-audio](unity-procedural-audio/) | Ses dosyası olmadan kodla üretilen efektler ve kalabalık alkışı |
| [unity-foot-grounder](unity-foot-grounder/) | Humanoid karakterlerin yere gömülmesini/havada süzülmesini engeller |

Unity eklentilerinin hepsi SupermarketOyunu'ndan çıkarıldı. Input System ile de eski Input Manager ile de çalışırlar.

## 🤖 Android (Kotlin)

`guess-game-engine/DleEngine.kt` ve `DailyTracker.kt` (gamedle).

---

## 🇬🇧 English

Standalone, reusable plugins and templates taken from my projects. Every folder has its own README with what it does, how to add it and example code (Turkish first, English below).

### Flutter / Dart

Taken from my six Flutter apps. The Dart files pass `flutter analyze` and come with tests.

| Plugin | What it does | Source app |
|---|---|---|
| [flutter-motion-kit](flutter-motion-kit/) | Slide-to-confirm control, press-to-shrink cards, staggered list entrance, frosted glass, loading skeletons, empty/error views | GlobeGo, NovaShop |
| [flutter-payment-card](flutter-payment-card/) | Luhn, brand detection, expiry and CVV checks, input formatters, an animated card that flips for the CVV | NovaShop |
| [booking-slots](booking-slots/) | Availability logic + Firestore transaction + security rules that make double bookings impossible | Glow Studio |
| [firestore-chat-kit](firestore-chat-kit/) | Real-time chat data layer: read receipts, typing, reactions, edit/delete, security rules, push function | Pulse |
| [flutter-offline-cache](flutter-offline-cache/) | Offline-first cache for API responses: returns the last saved data marked as stale when there is no connection | Atmos |
| [flutter-weather-sky](flutter-weather-sky/) | Animated sky for every weather and time of day, hand-drawn weather icons, WMO codes | Atmos |
| [flutter-image-filters](flutter-image-filters/) | Otsu, adaptive threshold, Sobel, histogram equalization and convolution in pure Dart | Vision Lab |
| [flutter-dev-tools](flutter-dev-tools/) | Python tools: pixel comparison with a design, emulator automation, README banners, launcher icons | all six apps |

### Web, Unity and Android

The web plugins cover:
- A page editor.
- A 3D globe.
- Browser utilities.
- A persistent store.
- A guess-game engine.
- A WhatsApp bot kit.
- NestJS JWT auth.

The Unity scripts cover a code-built UI kit, a pause menu, an FPS controller, procedural audio and a foot grounder. Details are in the tables above and in each folder's README.
