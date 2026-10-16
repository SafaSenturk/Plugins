# booking-slots

Randevu uygulamaları için **çift rezervasyonu imkânsız kılan** müsaitlik mantığı, Firestore transaction'ı ve güvenlik kuralları. [Glow Studio](https://github.com/SafaSenturk/flutter-booking-app) uygulamasından çıkarıldı. Kuaför, klinik, özel ders, danışmanlık gibi randevuyla çalışan her işe uyar.

**Gereken:**
- `availability.dart`: sadece Flutter (saf mantık, testli).
- `booking_repository.dart`: `cloud_firestore`.

| Dosya | İçerik |
|---|---|
| `availability.dart` | `BusinessHours` (açılış/kapanış, dilim süresi, kapalı günler, en az ön süre), `Availability.forDay(...)` boş saatleri hesaplar, `Availability.slotIds(...)` belge kimliklerini üretir |
| `booking_repository.dart` | `book()` randevuyu ve dilimlerini tek transaction'da yazar; `setStatus()` iptal/redde dilimleri boşaltır; `watchTaken()` dolu saatleri canlı izler |
| `firestore.rules` | Dilim yalnızca *oluşturulabilir*, üzerine yazılamaz; kimliği çalışan/gün/saatle eşleşmeli; sahibi aynı kullanıcı olmalı. Ayrıca müşteri / işletme sahibi / demo sahip rolleri |
| `rules-tests/` | Firebase Emulator üzerinde kural testleri (`npm ci && npm test`, Java gerekir) |
| `test/` | Müsaitlik mantığı testleri |

```dart
final repo = BookingRepository(FirebaseFirestore.instance);

// Ekran açıkken dolu saatler canlı güncellenir.
repo.watchTaken(day).listen((taken) {
  final slots = Availability.forDay(
    day: day,
    now: DateTime.now(),
    durationMin: 60,
    staffIds: ['ayse', 'mehmet'],
    taken: taken,
    hours: const BusinessHours(openHour: 10, closeHour: 20),
  );
  // slots: [TimeSlot(10:00, available: true, staffIds: [ayse]), ...]
});

try {
  await repo.book(uid: user.uid, staffId: 'ayse', start: slot.start, durationMin: 60,
      data: {'service': 'Saç kesimi', 'price': 450});
} on SlotTakenException {
  // Biri bu saati az önce aldı.
}
```

**Nasıl çalışıyor?**
- Her dolu 30 dakikalık blok ayrı bir belge: `slots/{çalışan}_{yyyyMMdd}_{HHmm}`.
- Transaction önce bütün blokları okur; biri doluysa durur.
- Kurallar dilimin üzerine yazmayı yasaklar. Böylece aynı anda basan iki müşteriden yalnızca biri kazanır; değiştirilmiş bir uygulama bile çift rezervasyon yapamaz.

---

## English

Availability logic, a Firestore transaction and security rules that make **double bookings impossible**, taken from the [Glow Studio](https://github.com/SafaSenturk/flutter-booking-app) booking app. Fits any appointment business.

What's inside:
- `Availability.forDay` computes the free start times from opening hours, service length, lead time and the slots already taken.
- `BookingRepository.book` writes the booking and one document per 30-minute block in a single transaction.
- The rules only allow *creating* a slot, never overwriting it, so two people tapping at the same moment cannot both win.
- Emulator tests cover the rules.
