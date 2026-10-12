# Plugins

Projeler arasında yeniden kullanılan, bağımsız eklentiler ve şablonlar.
Her klasörde kendi README'si var: ne işe yaradığı, nasıl eklendiği, örnek kod.

## Web (JavaScript / TypeScript)

| Eklenti | Açıklama | Kaynak proje |
|---|---|---|
| [page-editor](page-editor/) | Blok tabanlı görsel sayfa düzenleyici; sürükle-bırak, yerinde yazma, tema, TR/EN, yayınla + geçmiş | delamour |
| [orb3d](orb3d/) | Hareketli 3B tel kafes nesneler ve kıtalı dünya küresi; sürükle, şehir işaretleri, yaylar, kaydırma efekti | portföy |
| [web-utils](web-utils/) | `esc`, `slugify`, `money`/`parseNum` (TR), görsel küçültme, toast, güvenli localStorage | delamour |
| [persistent-store](persistent-store/) | localStorage'a kaydedilen dinlenebilir depo + hazır sepet/favoriler + React kancası | ecommerce-saas |
| [guess-game-engine](guess-game-engine/) | Loldle/Wordle tarzı tahmin oyunu motoru (JS + Kotlin), günlük mod, paylaşım metni | gamedle |
| [whatsapp-bot-kit](whatsapp-bot-kit/) | Evolution API istemcisi, webhook ayrıştırıcı, Gemini ile işletme adına cevap | whatsapp-ai-asistan |
| [nestjs-jwt-auth](nestjs-jwt-auth/) | NestJS kayıt/giriş, JWT, rol koruması, şifre değiştirme | ecommerce-backend |

## Unity (C#)

| Eklenti | Açıklama |
|---|---|
| [unity-ui-kit](unity-ui-kit/) | Kodla kurulan arayüz: paneller, butonlar, sekmeler, barlar. Sprite/prefab gerekmez |
| [unity-pause-menu](unity-pause-menu/) | Esc ile duraklatma menüsü; kaydet/yükle/ek buton bağlanır (ui-kit gerekir) |
| [unity-fps-controller](unity-fps-controller/) | Birinci şahıs yürüme, koşma, zıplama, fareyle bakış |
| [unity-procedural-audio](unity-procedural-audio/) | Ses dosyası olmadan kodla üretilen efektler ve kalabalık alkışı |
| [unity-foot-grounder](unity-foot-grounder/) | Humanoid karakterlerin yere gömülmesini/havada süzülmesini engeller |

Unity eklentilerinin hepsi SupermarketOyunu'ndan çıkarıldı. Input System ile de eski Input Manager ile de çalışırlar.

## Android (Kotlin)

`guess-game-engine/DleEngine.kt` ve `DailyTracker.kt` (gamedle).
