# firestore-chat-kit

Flutter + Cloud Firestore ile **birebir gerçek zamanlı sohbetin** veri katmanı, güvenlik kuralları ve anlık bildirim fonksiyonu. [Pulse](https://github.com/SafaSenturk/flutter-firebase-chat) uygulamasından çıkarıldı.

**Gereken:** `cloud_firestore`. Bildirimler için Firebase Cloud Functions (Blaze planı).

| Dosya | İçerik |
|---|---|
| `models.dart` | `AppUser`, `Chat` (okunmamış sayacı, "yazıyor…", karşı üye), `Message` (okundu, düzenlendi, silindi, tepkiler) |
| `chat_repository.dart` | Kişi listesi ve arama, sohbet listesi, mesajlar, gönder, okundu işaretle, yazıyor, tepki, düzenle, sil, çevrimiçi durumu, FCM token kaydı |
| `firestore.rules` | Herkes yalnızca kendi profilini yazar; sohbeti iki üye görür; mesaj yalnızca kendi adına, 1–2000 karakter; alıcı yalnızca okundu/tepki yazabilir |
| `firestore.indexes.json` | Sohbet listesi için birleşik indeks |
| `functions/index.js` | Her yeni mesajı alıcının cihazlarına gönderir, geçersiz token'ları temizler |
| `rules-tests/` | Firebase Emulator üzerinde kural testleri (`npm ci && npm test`, Java gerekir) |
| `test/` | Model testleri (sohbet kimliği, okunmamış, yazıyor süresi) |

```dart
final chats = ChatRepository(FirebaseFirestore.instance);

chats.watchChats(me).listen((list) { /* son mesaja göre sıralı */ });
chats.watchMessages(Chat.idFor(me, other)).listen((messages) { /* en yenisi önce */ });

await chats.sendMessage(from: me, to: other, text: 'Merhaba!');
await chats.markRead(chatId, me);
await chats.setTyping(chatId, me, typing: true);   // birkaç saniyede bir yenile
await chats.react(chatId, message, me, '🔥');
```

**Veri modeli:**

```
users/{uid}                 name, nameLower, about, online, lastSeen, fcmTokens[]
chats/{uidA_uidB}           members[2], updatedAt, lastMessage{…}, unread{uid: n}, typing{uid: zaman}
chats/{id}/messages/{id}    senderId, text, sentAt, readAt, editedAt, deleted, reactions{uid: emoji}
```

**Neden böyle?**
- Mesaj göndermek **tek bir toplu yazma (batch)**: mesaj, son mesaj özeti, okunmamış sayacı ve temizlenen "yazıyor" birlikte yazılır.
- İlk mesaj sohbeti de aynı batch'te oluşturur; kurallar buna `getAfter()` ile izin verir.
- Sohbet kimliği iki kullanıcı kimliğinin sıralı birleşimi; kim başlatırsa başlatsın aynı sohbet açılır.

---

## English

The data layer, security rules and push function for **one-to-one real-time chat** with Flutter and Cloud Firestore, taken from the [Pulse](https://github.com/SafaSenturk/flutter-firebase-chat) app.

It covers:
- Chats with unread counters.
- Typing indicator, read receipts and presence.
- Reactions, edits and soft deletes.
- Push notifications through a Cloud Function.

Sending a message is a single batched write together with the chat summary. The rules make sure:
- Users only write their own profile.
- Only the two members can read a chat.
- Messages are sent as yourself.

Emulator tests cover the rules.
