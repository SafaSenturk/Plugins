# flutter-payment-card

Ödeme formları için kart doğrulama ve yazarken canlı güncellenen, CVV'de arkasını dönen animasyonlu kredi kartı. [NovaShop](https://github.com/SafaSenturk/flutter-ecommerce-app) uygulamasından çıkarıldı.

**Gereken:** sadece Flutter. Ek paket yok.

| Dosya | İçerik |
|---|---|
| `card_validators.dart` | Marka tespiti, Luhn kontrolü, son kullanma tarihi, CVV uzunluğu, numara biçimleme, `CardNumberFormatter` ve `ExpiryFormatter` |
| `credit_card_view.dart` | Markaya göre renk değiştiren, CVV alanında 3B dönen kart önizlemesi |
| `test/` | Doğrulama testleri |

```dart
TextField(
  controller: number,
  keyboardType: TextInputType.number,
  inputFormatters: [CardNumberFormatter()],     // "4242 4242 4242 4242"
  validator: (v) => CardValidators.luhn(v ?? '') ? null : 'Geçersiz kart',
);
TextField(controller: expiry, inputFormatters: [ExpiryFormatter()]); // "MM/YY"

CreditCardView(
  number: number.text,
  holder: name.text,
  expiry: expiry.text,
  cvv: cvv.text,
  showBack: cvvFocus.hasFocus,        // CVV yazılırken kart döner
  holderPlaceholder: 'AD SOYAD',
);
```

| Fonksiyon | Ne yapar |
|---|---|
| `CardValidators.brandOf(n)` | Visa, Mastercard, Amex, Troy ya da bilinmiyor |
| `CardValidators.luhn(n)` | Gerçek ödeme formlarının kullandığı Luhn sağlama toplamı |
| `CardValidators.expiry("MM/YY")` | Kart, ayın son gününe kadar geçerli sayılır |
| `CardValidators.cvv(s, brand)` | Amex için 4, diğerleri için 3 hane |
| `CardValidators.formatNumber(n)` | Rakamları dörtlü gruplar |
| `successTestCard` / `declinedTestCard` | Demo için başarılı (`4242…`) ve reddedilen (`4000…0002`) test kartları |

Kart verisi cihazdan çıkmaz. Gerçek ödeme için bunu bir ödeme sağlayıcısının (iyzico, Stripe…) SDK'sıyla birlikte kullan.

---

## English

Card validation and an animated credit card that updates while you type and flips for the CVV. Taken from the [NovaShop](https://github.com/SafaSenturk/flutter-ecommerce-app) app. Needs only Flutter.

It includes:
- Brand detection (Visa, Mastercard, Amex, Troy).
- Luhn check.
- Expiry and CVV rules.
- Number grouping.
- Input formatters for the number and the "MM/YY" date.
- `CreditCardView`, whose gradient follows the brand and which turns around in 3D when `showBack` is true.

Pair it with a payment provider's SDK for real payments. The card data never leaves the device.
