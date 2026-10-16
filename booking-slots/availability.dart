import 'package:flutter/foundation.dart';

/// Opening hours and booking rules of the business.
class BusinessHours {
  const BusinessHours({
    this.openHour = 9,
    this.closeHour = 19,
    this.slotMinutes = 30,
    this.closedWeekdays = const {DateTime.sunday},
    this.minLeadTime = const Duration(minutes: 60),
    this.bookingWindowDays = 30,
  });

  final int openHour;
  final int closeHour;
  final int slotMinutes;
  final Set<int> closedWeekdays;

  /// How far ahead a booking must be made.
  final Duration minLeadTime;
  final int bookingWindowDays;

  bool isOpen(DateTime day) => !closedWeekdays.contains(day.weekday);
}

@immutable
class TimeSlot {
  const TimeSlot({required this.start, required this.available, this.staffIds = const []});

  final DateTime start;
  final bool available;

  /// Staff members free for the whole service at this time.
  final List<String> staffIds;

  @override
  bool operator ==(Object other) =>
      other is TimeSlot && other.start == start && other.available == available && listEquals(other.staffIds, staffIds);

  @override
  int get hashCode => Object.hash(start, available, Object.hashAll(staffIds));
}

/// Pure booking logic: slot ids, availability and the time grid.
abstract final class Availability {
  static String dayKey(DateTime d) =>
      '${d.year}${d.month.toString().padLeft(2, '0')}${d.day.toString().padLeft(2, '0')}';

  static String timeKey(DateTime t) =>
      '${t.hour.toString().padLeft(2, '0')}${t.minute.toString().padLeft(2, '0')}';

  /// Every 30-minute block a booking occupies, as slot document ids.
  static List<String> slotIds({
    required String staffId,
    required DateTime start,
    required int durationMin,
    int slotMinutes = 30,
  }) {
    final count = (durationMin / slotMinutes).ceil();
    return [
      for (var i = 0; i < count; i++)
        '${staffId}_${dayKey(start)}_${timeKey(start.add(Duration(minutes: i * slotMinutes)))}',
    ];
  }

  /// The bookable start times on [day] for a service of [durationMin] minutes.
  ///
  /// [taken] maps a staff id to the time keys ("0930") already booked that day.
  /// A start time is available when at least one of [staffIds] is free for
  /// every block of the service, the service ends before closing time and the
  /// start is far enough in the future.
  static List<TimeSlot> forDay({
    required DateTime day,
    required DateTime now,
    required int durationMin,
    required List<String> staffIds,
    required Map<String, Set<String>> taken,
    BusinessHours hours = const BusinessHours(),
  }) {
    if (!hours.isOpen(day)) return const [];
    final open = DateTime(day.year, day.month, day.day, hours.openHour);
    final close = DateTime(day.year, day.month, day.day, hours.closeHour);
    final blocks = (durationMin / hours.slotMinutes).ceil();
    final result = <TimeSlot>[];

    for (var t = open;
        !t.add(Duration(minutes: durationMin)).isAfter(close);
        t = t.add(Duration(minutes: hours.slotMinutes))) {
      final tooSoon = t.isBefore(now.add(hours.minLeadTime));
      final free = tooSoon
          ? const <String>[]
          : [
              for (final staff in staffIds)
                if (List.generate(blocks, (i) => timeKey(t.add(Duration(minutes: i * hours.slotMinutes))))
                    .every((k) => !(taken[staff]?.contains(k) ?? false)))
                  staff,
            ];
      result.add(TimeSlot(start: t, available: free.isNotEmpty, staffIds: free));
    }
    return result;
  }

  /// Days shown in the date picker, starting today.
  static List<DateTime> bookableDays(DateTime now, {BusinessHours hours = const BusinessHours()}) => [
        for (var i = 0; i < hours.bookingWindowDays; i++) DateTime(now.year, now.month, now.day + i),
      ];
}
