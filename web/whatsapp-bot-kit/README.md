# whatsapp-bot-kit

WhatsApp'tan müşterilere yapay zekâyla cevap veren bir botun yeniden kullanılabilir
parçaları. whatsapp-ai-asistan'dan çıkarıldı. Veritabanına ve çatıya (Next.js
vb.) bağlı değil.

| Dosya | Ne yapar |
|---|---|
| `evolution.ts` | Evolution API istemcisi: mesaj gönder, bağlantı durumu, QR, webhook kur |
| `webhook.ts` | Gelen isteği doğrula (`verifySecret`), mesaja çevir (`parseEvolutionWebhook`), anahtar kelime ve deneme modu süzgeci |
| `ai-reply.ts` | Gemini ile işletme adına cevap; uyduramaz, gerekirse `handoff: true` ile insana devreder, yoğunlukta yedek modele geçer |
| `example-next-route.ts` | Hepsini birleştiren örnek Next.js webhook'u |

Gerekli paket: `@google/genai` (yalnızca `ai-reply.ts` için).

## Kurulum özeti
1. Evolution API sunucunuzda bir instance açın, telefonu `connectQr()`'dan gelen QR ile bağlayın.
2. `wa.setWebhook("https://siteniz/api/webhook", WEBHOOK_SECRET)` ile gelen mesajları sitenize yönlendirin.
3. Webhook'ta `verifySecret` → `parseEvolutionWebhook` → `generateReply` → `sendText`.

Notlar:
- Aynı mesaj Evolution'dan iki kez gelebilir. `waMessageId`'yi veritabanında benzersiz tutun, ikinciyi işlemeyin.
- `fromMe` mesajlar sizin telefondan yazdıklarınızdır; bunlara bot cevap vermemeli.
- Gizli anahtar adreste değil başlıkta gider, sunucu kayıtlarına düşmez.
