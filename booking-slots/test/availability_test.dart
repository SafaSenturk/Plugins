import 'package:flutter_test/flutter_test.dart';
import '../availability.dart';

void main() {
  final friday = DateTime(2026, 10, 16);
  final earlyFriday = DateTime(2026, 10, 16, 7);

  test('builds slot ids for every 30-minute block of a service', () {
    final ids = Availability.slotIds(staffId: 'elena', start: DateTime(2026, 10, 16, 10), durationMin: 90);
    expect(ids, ['elena_20261016_1000', 'elena_20261016_1030', 'elena_20261016_1100']);
  });

  test('offers every half hour from opening until the service still fits', () {
    final slots = Availability.forDay(
      day: friday,
      now: earlyFriday,
      durationMin: 60,
      staffIds: const ['elena'],
      taken: const {},
    );
    expect(slots.first.start, DateTime(2026, 10, 16, 9));
    // A one-hour service must end by 19:00, so the last start is 18:00.
    expect(slots.last.start, DateTime(2026, 10, 16, 18));
    expect(slots.every((s) => s.available), isTrue);
  });

  test('a start is blocked when any block of the service overlaps a booking', () {
    final slots = Availability.forDay(
      day: friday,
      now: earlyFriday,
      durationMin: 60,
      staffIds: const ['elena'],
      taken: const {
        'elena': {'1000', '1030'},
      },
    );
    bool free(int h, int m) => slots.firstWhere((s) => s.start == DateTime(2026, 10, 16, h, m)).available;
    expect(free(9, 0), isTrue); // ends at 10:00
    expect(free(9, 30), isFalse); // runs into 10:00
    expect(free(10, 30), isFalse);
    expect(free(11, 0), isTrue);
  });

  test('"any specialist" is free when at least one of them is', () {
    final slots = Availability.forDay(
      day: friday,
      now: earlyFriday,
      durationMin: 30,
      staffIds: const ['elena', 'zeynep'],
      taken: const {
        'elena': {'1000'},
      },
    );
    final ten = slots.firstWhere((s) => s.start.hour == 10 && s.start.minute == 0);
    expect(ten.available, isTrue);
    expect(ten.staffIds, ['zeynep']);
  });

  test('times within the lead time are not bookable', () {
    final slots = Availability.forDay(
      day: friday,
      now: DateTime(2026, 10, 16, 11, 10),
      durationMin: 30,
      staffIds: const ['elena'],
      taken: const {},
    );
    expect(slots.where((s) => s.available).first.start, DateTime(2026, 10, 16, 12, 30));
  });

  test('the business is closed on Sundays', () {
    expect(
      Availability.forDay(
        day: DateTime(2026, 10, 18),
        now: earlyFriday,
        durationMin: 30,
        staffIds: const ['elena'],
        taken: const {},
      ),
      isEmpty,
    );
  });
}
