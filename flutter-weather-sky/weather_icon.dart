import 'dart:math';

import 'package:flutter/material.dart';

import 'weather_condition.dart';

/// Hand-drawn weather icon: sun/moon, clouds and precipitation composed on a canvas.
class WeatherIcon extends StatelessWidget {
  const WeatherIcon({super.key, required this.condition, this.isDay = true, this.size = 32});

  final WeatherCondition condition;
  final bool isDay;
  final double size;

  @override
  Widget build(BuildContext context) => RepaintBoundary(
        child: CustomPaint(
          size: Size.square(size),
          painter: _IconPainter(condition.sky, isDay),
        ),
      );
}

class _IconPainter extends CustomPainter {
  _IconPainter(this.sky, this.isDay);

  final Sky sky;
  final bool isDay;

  static const _sun = Color(0xFFFFC94A);
  static const _sunCore = Color(0xFFFFB020);
  static const _moon = Color(0xFFE9ECFF);
  static const _cloud = Color(0xFFF4F7FB);
  static const _darkCloud = Color(0xFFB7C1D3);
  static const _rain = Color(0xFF6EC1FF);
  static const _bolt = Color(0xFFFFD84D);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    switch (sky) {
      case Sky.clear:
        isDay ? _drawSun(canvas, Offset(s * .5, s * .5), s * .24, s) : _drawMoon(canvas, Offset(s * .5, s * .5), s * .3);
      case Sky.partlyCloudy:
        isDay ? _drawSun(canvas, Offset(s * .36, s * .36), s * .17, s * .7) : _drawMoon(canvas, Offset(s * .36, s * .34), s * .2);
        _drawCloud(canvas, Offset(s * .56, s * .62), s * .8, _cloud);
      case Sky.cloudy:
        _drawCloud(canvas, Offset(s * .62, s * .44), s * .62, _darkCloud);
        _drawCloud(canvas, Offset(s * .46, s * .6), s * .86, _cloud);
      case Sky.fog:
        _drawCloud(canvas, Offset(s * .5, s * .42), s * .8, _cloud);
        final p = Paint()
          ..color = _darkCloud
          ..strokeWidth = s * .06
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(Offset(s * .18, s * .74), Offset(s * .82, s * .74), p);
        canvas.drawLine(Offset(s * .28, s * .87), Offset(s * .72, s * .87), p);
      case Sky.drizzle || Sky.rain:
        _drawCloud(canvas, Offset(s * .5, s * .42), s * .86, _cloud);
        final heavy = sky == Sky.rain;
        final p = Paint()
          ..color = _rain
          ..strokeWidth = s * (heavy ? .07 : .055)
          ..strokeCap = StrokeCap.round;
        for (final x in heavy ? [.3, .5, .7] : [.36, .64]) {
          canvas.drawLine(Offset(s * x, s * .7), Offset(s * (x - .06), s * .88), p);
        }
      case Sky.snow:
        _drawCloud(canvas, Offset(s * .5, s * .42), s * .86, _cloud);
        for (final x in [.3, .5, .7]) {
          _drawFlake(canvas, Offset(s * x, s * (x == .5 ? .86 : .78)), s * .07);
        }
      case Sky.thunder:
        _drawCloud(canvas, Offset(s * .5, s * .4), s * .9, _darkCloud);
        final bolt = Path()
          ..moveTo(s * .54, s * .5)
          ..lineTo(s * .38, s * .74)
          ..lineTo(s * .5, s * .74)
          ..lineTo(s * .42, s * .96)
          ..lineTo(s * .66, s * .66)
          ..lineTo(s * .53, s * .66)
          ..lineTo(s * .62, s * .5)
          ..close();
        canvas.drawPath(bolt, Paint()..color = _bolt);
    }
  }

  void _drawSun(Canvas c, Offset center, double r, double s) {
    final rays = Paint()
      ..color = _sun
      ..strokeWidth = s * .055
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 8; i++) {
      final a = i * pi / 4;
      final dir = Offset(cos(a), sin(a));
      c.drawLine(center + dir * (r * 1.4), center + dir * (r * 1.85), rays);
    }
    c.drawCircle(
      center,
      r,
      Paint()
        ..shader = const RadialGradient(colors: [_sun, _sunCore])
            .createShader(Rect.fromCircle(center: center, radius: r)),
    );
  }

  void _drawMoon(Canvas c, Offset center, double r) {
    final moon = Path()..addOval(Rect.fromCircle(center: center, radius: r));
    final bite = Path()..addOval(Rect.fromCircle(center: center + Offset(r * .55, -r * .35), radius: r * .85));
    c.drawPath(Path.combine(PathOperation.difference, moon, bite), Paint()..color = _moon);
  }

  void _drawCloud(Canvas c, Offset center, double w, Color color) {
    final h = w * .5;
    final base = Rect.fromCenter(center: center + Offset(0, h * .18), width: w, height: h * .55);
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(base, Radius.circular(h * .3)))
      ..addOval(Rect.fromCircle(center: center + Offset(-w * .16, -h * .02), radius: h * .38))
      ..addOval(Rect.fromCircle(center: center + Offset(w * .1, -h * .16), radius: h * .5));
    c.drawPath(path.shift(Offset(0, w * .03)), Paint()..color = Colors.black.withValues(alpha: .08));
    c.drawPath(path, Paint()..color = color);
  }

  void _drawFlake(Canvas c, Offset center, double r) {
    final p = Paint()
      ..color = Colors.white
      ..strokeWidth = r * .4
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 3; i++) {
      final a = i * pi / 3;
      final d = Offset(cos(a), sin(a)) * r;
      c.drawLine(center - d, center + d, p);
    }
  }

  @override
  bool shouldRepaint(_IconPainter old) => old.sky != sky || old.isDay != isDay;
}
