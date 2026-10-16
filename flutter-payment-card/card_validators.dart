import 'package:flutter/services.dart';

enum CardBrand { visa, mastercard, amex, troy, unknown }

/// Pure helpers for the demo payment form. No card data ever leaves the device.
abstract final class CardValidators {
  static String digitsOnly(String input) => input.replaceAll(RegExp(r'\D'), '');

  static CardBrand brandOf(String number) {
    final d = digitsOnly(number);
    if (d.startsWith('4')) return CardBrand.visa;
    if (RegExp(r'^(5[1-5]|2[2-7])').hasMatch(d)) return CardBrand.mastercard;
    if (RegExp(r'^3[47]').hasMatch(d)) return CardBrand.amex;
    if (d.startsWith('9792')) return CardBrand.troy;
    return CardBrand.unknown;
  }

  /// Luhn checksum, the same check real payment forms run before submitting.
  static bool luhn(String number) {
    final d = digitsOnly(number);
    if (d.length < 13 || d.length > 19) return false;
    var sum = 0;
    var doubleIt = false;
    for (var i = d.length - 1; i >= 0; i--) {
      var n = d.codeUnitAt(i) - 48;
      if (doubleIt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      doubleIt = !doubleIt;
    }
    return sum % 10 == 0;
  }

  /// Accepts "MM/YY". A card is valid through the last day of its month.
  static bool expiry(String input, {DateTime? now}) {
    final m = RegExp(r'^(\d{2})/(\d{2})$').firstMatch(input.trim());
    if (m == null) return false;
    final month = int.parse(m.group(1)!);
    final year = 2000 + int.parse(m.group(2)!);
    if (month < 1 || month > 12) return false;
    final today = now ?? DateTime.now();
    final firstDayAfter = DateTime(year, month + 1);
    return today.isBefore(firstDayAfter) && year <= today.year + 20;
  }

  static bool cvv(String input, CardBrand brand) {
    final d = digitsOnly(input);
    return brand == CardBrand.amex ? d.length == 4 : d.length == 3;
  }

  /// "4242424242424242" -> "4242 4242 4242 4242"
  static String formatNumber(String input) {
    final d = digitsOnly(input);
    final buf = StringBuffer();
    for (var i = 0; i < d.length && i < 19; i++) {
      if (i > 0 && i % 4 == 0) buf.write(' ');
      buf.write(d[i]);
    }
    return buf.toString();
  }

  /// Stripe-style test number that always gets declined in this demo.
  static const declinedTestCard = '4000000000000002';
  static const successTestCard = '4242424242424242';
}

/// Groups the digits in fours while typing: "4242424242" -> "4242 4242 42".
class CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = CardValidators.digitsOnly(newValue.text);
    final text = CardValidators.formatNumber(digits.length > 19 ? digits.substring(0, 19) : digits);
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

/// Inserts the slash in "MM/YY" automatically.
class ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = CardValidators.digitsOnly(newValue.text);
    if (digits.length > 4) digits = digits.substring(0, 4);
    final deleting = newValue.text.length < oldValue.text.length;
    final String text;
    if (digits.length > 2) {
      text = '${digits.substring(0, 2)}/${digits.substring(2)}';
    } else if (digits.length == 2 && !deleting) {
      text = '$digits/';
    } else {
      text = digits;
    }
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
