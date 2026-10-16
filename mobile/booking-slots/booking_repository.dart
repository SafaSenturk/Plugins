import 'package:cloud_firestore/cloud_firestore.dart';

import 'availability.dart';

/// Thrown when one of the requested time blocks was taken in the meantime.
class SlotTakenException implements Exception {
  const SlotTakenException();
}

/// Books and releases time slots so that the same block can never be taken
/// twice. Each occupied block is its own document `slots/{staff}_{yyyyMMdd}_{HHmm}`;
/// the booking and its slots are written in one transaction, and the security
/// rules in `firestore.rules` only allow *creating* a slot, never overwriting it.
class BookingRepository {
  BookingRepository(this._db, {this.bookings = 'appointments', this.slots = 'slots'});

  final FirebaseFirestore _db;
  final String bookings;
  final String slots;

  CollectionReference<Map<String, dynamic>> get _bookings => _db.collection(bookings);
  CollectionReference<Map<String, dynamic>> get _slots => _db.collection(slots);

  /// Creates a pending booking for [uid] and claims every block it covers.
  /// [data] is stored on the booking document (service name, price, note…).
  Future<String> book({
    required String uid,
    required String staffId,
    required DateTime start,
    required int durationMin,
    Map<String, Object?> data = const {},
    int slotMinutes = 30,
  }) async {
    final slotIds = Availability.slotIds(
      staffId: staffId,
      start: start,
      durationMin: durationMin,
      slotMinutes: slotMinutes,
    );
    final booking = _bookings.doc();
    await _db.runTransaction((tx) async {
      // All reads must happen before the first write in a transaction.
      for (final id in slotIds) {
        if ((await tx.get(_slots.doc(id))).exists) throw const SlotTakenException();
      }
      tx.set(booking, {
        ...data,
        'uid': uid,
        'staffId': staffId,
        'start': Timestamp.fromDate(start),
        'durationMin': durationMin,
        'status': 'pending',
        'slotIds': slotIds,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      for (final id in slotIds) {
        final parts = id.split('_');
        tx.set(_slots.doc(id), {
          'staffId': staffId,
          'day': parts[parts.length - 2],
          'time': parts.last,
          'uid': uid,
          'appointmentId': booking.id,
        });
      }
    });
    return booking.id;
  }

  /// Changes the status; `cancelled` and `declined` also free the slots.
  Future<void> setStatus(String bookingId, List<String> slotIds, String status) {
    final batch = _db.batch()
      ..update(_bookings.doc(bookingId), {'status': status, 'updatedAt': FieldValue.serverTimestamp()});
    if (status == 'cancelled' || status == 'declined') {
      for (final id in slotIds) {
        batch.delete(_slots.doc(id));
      }
    }
    return batch.commit();
  }

  /// Time keys ("0930") already taken on [day], per staff member – the input
  /// [Availability.forDay] needs. Updates live while the screen is open.
  /// Queries by day only, so no composite index is needed.
  Stream<Map<String, Set<String>>> watchTaken(DateTime day) => _slots
      .where('day', isEqualTo: Availability.dayKey(day))
      .snapshots()
      .map((s) {
        final taken = <String, Set<String>>{};
        for (final d in s.docs) {
          taken.putIfAbsent(d['staffId'] as String, () => <String>{}).add(d['time'] as String);
        }
        return taken;
      });
}
