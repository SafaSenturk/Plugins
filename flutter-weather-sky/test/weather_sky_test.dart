import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../sky_background.dart';
import '../weather_condition.dart';
import '../weather_icon.dart';

void main() {
  test('WMO codes map to conditions and skies', () {
    expect(WeatherCondition.fromCode(0), WeatherCondition.clear);
    expect(WeatherCondition.fromCode(63).sky, Sky.rain);
    expect(WeatherCondition.fromCode(75).sky, Sky.snow);
    expect(WeatherCondition.fromCode(99).sky, Sky.thunder);
    expect(WeatherCondition.fromCode(1234), WeatherCondition.unknown);
  });

  testWidgets('every sky and icon paints by day and by night', (tester) async {
    for (final sky in Sky.values) {
      for (final day in [true, false]) {
        await tester.pumpWidget(MaterialApp(home: SkyBackground(sky: sky, isDay: day)));
        await tester.pump(const Duration(seconds: 2));
      }
    }
    for (final c in WeatherCondition.values) {
      await tester.pumpWidget(MaterialApp(home: Center(child: WeatherIcon(condition: c, isDay: false, size: 64))));
    }
    expect(tester.takeException(), isNull);
  });
}
