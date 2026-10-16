import 'package:flutter_test/flutter_test.dart';
import '../card_validators.dart';

void main() {
  group('luhn', () {
    test('accepts well-known test numbers', () {
      expect(CardValidators.luhn('4242 4242 4242 4242'), isTrue);
      expect(CardValidators.luhn('5555555555554444'), isTrue);
      expect(CardValidators.luhn('378282246310005'), isTrue);
    });

    test('rejects a single wrong digit and short input', () {
      expect(CardValidators.luhn('4242 4242 4242 4241'), isFalse);
      expect(CardValidators.luhn('4242'), isFalse);
    });
  });

  test('detects brands', () {
    expect(CardValidators.brandOf('4242'), CardBrand.visa);
    expect(CardValidators.brandOf('5555'), CardBrand.mastercard);
    expect(CardValidators.brandOf('2221'), CardBrand.mastercard);
    expect(CardValidators.brandOf('3782'), CardBrand.amex);
    expect(CardValidators.brandOf('9792'), CardBrand.troy);
    expect(CardValidators.brandOf('1234'), CardBrand.unknown);
  });

  group('expiry', () {
    final now = DateTime(2026, 10, 15);

    test('a card is valid until the end of its month', () {
      expect(CardValidators.expiry('10/26', now: now), isTrue);
      expect(CardValidators.expiry('09/26', now: now), isFalse);
    });

    test('rejects malformed input', () {
      expect(CardValidators.expiry('13/27', now: now), isFalse);
      expect(CardValidators.expiry('1/27', now: now), isFalse);
      expect(CardValidators.expiry('', now: now), isFalse);
    });
  });

  test('cvv length depends on the brand', () {
    expect(CardValidators.cvv('123', CardBrand.visa), isTrue);
    expect(CardValidators.cvv('1234', CardBrand.visa), isFalse);
    expect(CardValidators.cvv('1234', CardBrand.amex), isTrue);
  });

  test('formats numbers in groups of four', () {
    expect(CardValidators.formatNumber('4242424242424242'), '4242 4242 4242 4242');
    expect(CardValidators.formatNumber('42-42 42'), '4242 42');
  });
}
