import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// The value plus whether it came from the offline copy.
class CacheResult<T> {
  const CacheResult(this.value, {this.isStale = false, this.error, required this.savedAt});

  final T value;

  /// True when the network failed and the last saved copy is returned instead.
  /// Show an "offline" banner instead of an error screen.
  final bool isStale;

  /// Why fresh data could not be loaded (only set when [isStale]).
  final Object? error;

  /// When this value was downloaded.
  final DateTime savedAt;
}

/// Stale-while-revalidate cache for API responses (from the Atmos weather app).
///
/// * A value younger than [freshFor] is answered from memory, no request.
/// * Otherwise [load] calls `fetch`, keeps the raw JSON on disk and returns it.
/// * If `fetch` throws, the last saved copy is returned with `isStale: true`.
///   The error is rethrown only when nothing was ever saved.
/// * [peek] returns whatever is known right away, so a screen can paint
///   instantly and refresh in the background.
class OfflineCache<T> {
  OfflineCache({
    required this.prefs,
    required this.namespace,
    required this.decode,
    this.freshFor = const Duration(minutes: 10),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final SharedPreferences prefs;

  /// Prefix for the storage keys; bump it ("forecast.v2") when the JSON shape changes.
  final String namespace;

  /// Turns the saved JSON back into a value. If it throws, the copy is ignored.
  final T Function(Map<String, dynamic> json) decode;
  final Duration freshFor;
  final DateTime Function() _clock;

  final _memory = <String, CacheResult<T>>{};

  String _key(String id) => '$namespace.$id';

  Future<CacheResult<T>> load(
    String id,
    Future<Map<String, dynamic>> Function() fetch, {
    bool force = false,
  }) async {
    final hit = _memory[id];
    if (!force && hit != null && !hit.isStale && _clock().difference(hit.savedAt) < freshFor) {
      return hit;
    }
    try {
      final json = await fetch();
      final now = _clock();
      final result = CacheResult(decode(json), savedAt: now);
      _memory[id] = result;
      await prefs.setString(_key(id), jsonEncode({'json': json, 'savedAt': now.toIso8601String()}));
      return result;
    } catch (error) {
      final saved = _read(id);
      if (saved == null) rethrow;
      return CacheResult(saved.value, isStale: true, error: error, savedAt: saved.savedAt);
    }
  }

  /// The best value known right now, without the network.
  CacheResult<T>? peek(String id) => _memory[id] ?? _read(id);

  Future<void> remove(String id) async {
    _memory.remove(id);
    await prefs.remove(_key(id));
  }

  CacheResult<T>? _read(String id) {
    final raw = prefs.getString(_key(id));
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return CacheResult(
        decode(j['json'] as Map<String, dynamic>),
        savedAt: DateTime.parse(j['savedAt'] as String),
      );
    } catch (_) {
      return null; // A copy from an older JSON shape: ignore it.
    }
  }
}
