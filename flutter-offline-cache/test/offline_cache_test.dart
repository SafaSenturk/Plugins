import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../offline_cache.dart';

void main() {
  late DateTime now;
  late SharedPreferences prefs;

  OfflineCache<int> makeCache() => OfflineCache<int>(
        prefs: prefs,
        namespace: 'temp.v1',
        decode: (j) => j['t'] as int,
        clock: () => now,
      );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    now = DateTime(2026, 10, 16, 12);
  });

  test('fresh values come from memory without a request', () async {
    final cache = makeCache();
    var calls = 0;
    Future<Map<String, dynamic>> fetch() async => {'t': ++calls};

    expect((await cache.load('ist', fetch)).value, 1);
    now = now.add(const Duration(minutes: 5));
    expect((await cache.load('ist', fetch)).value, 1);
    expect(calls, 1);

    now = now.add(const Duration(minutes: 6));
    expect((await cache.load('ist', fetch)).value, 2);
  });

  test('a failed request returns the saved copy marked as stale', () async {
    await makeCache().load('ist', () async => {'t': 21});

    // A new cache instance = the app was restarted.
    final cache = makeCache();
    expect(cache.peek('ist')?.value, 21);
    final result = await cache.load('ist', () async => throw StateError('offline'));
    expect(result.value, 21);
    expect(result.isStale, isTrue);
    expect(result.error, isA<StateError>());
  });

  test('the error is rethrown when nothing was ever saved', () async {
    expect(makeCache().load('ank', () async => throw StateError('offline')), throwsStateError);
  });

  test('copies that no longer decode are ignored', () async {
    await prefs.setString('temp.v1.ist', '{"json":{"t":"not a number"},"savedAt":"2026-10-16T10:00:00"}');
    expect(makeCache().peek('ist'), isNull);
  });
}
