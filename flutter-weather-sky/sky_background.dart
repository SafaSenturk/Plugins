import 'dart:math';

import 'package:flutter/material.dart';

import 'weather_condition.dart';

/// Gradient colours for every sky, day and night.
List<Color> skyGradient(Sky sky, bool isDay) => switch ((sky, isDay)) {
      (Sky.clear, true) => const [Color(0xFF1F6FE0), Color(0xFF4FA8F0), Color(0xFF8FD3FF)],
      (Sky.clear, false) => const [Color(0xFF070B1F), Color(0xFF16204A), Color(0xFF2E3A73)],
      (Sky.partlyCloudy, true) => const [Color(0xFF2D6CC4), Color(0xFF5C9BE0), Color(0xFFA9CFF2)],
      (Sky.partlyCloudy, false) => const [Color(0xFF0D1428), Color(0xFF1C2A48), Color(0xFF34476B)],
      (Sky.cloudy, true) => const [Color(0xFF4F6A86), Color(0xFF7890A8), Color(0xFFAFBFCF)],
      (Sky.cloudy, false) => const [Color(0xFF151C24), Color(0xFF26323E), Color(0xFF3E4C59)],
      (Sky.fog, true) => const [Color(0xFF7D8D9B), Color(0xFFA3B0BC), Color(0xFFD0D8DF)],
      (Sky.fog, false) => const [Color(0xFF1E2A35), Color(0xFF34424F), Color(0xFF55616D)],
      (Sky.drizzle || Sky.rain, true) => const [Color(0xFF2F4357), Color(0xFF4D657C), Color(0xFF7891A8)],
      (Sky.drizzle || Sky.rain, false) => const [Color(0xFF0C141D), Color(0xFF1A2734), Color(0xFF2E3D4D)],
      (Sky.snow, true) => const [Color(0xFF5F8AB3), Color(0xFF94B6D3), Color(0xFFDCE8F2)],
      (Sky.snow, false) => const [Color(0xFF17263A), Color(0xFF2C4058), Color(0xFF50657D)],
      (Sky.thunder, _) => const [Color(0xFF120F1F), Color(0xFF26203D), Color(0xFF453B63)],
    };

/// Full-screen animated sky: gradient, sun glow or stars, drifting clouds,
/// rain, snow, fog and lightning depending on the weather.
class SkyBackground extends StatefulWidget {
  const SkyBackground({super.key, required this.sky, required this.isDay});

  final Sky sky;
  final bool isDay;

  @override
  State<SkyBackground> createState() => _SkyBackgroundState();
}

class _SkyBackgroundState extends State<SkyBackground> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(seconds: 60))
    ..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = skyGradient(widget.sky, widget.isDay);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: colors,
        ),
      ),
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size.infinite,
          painter: _SkyPainter(widget.sky, widget.isDay, _controller),
        ),
      ),
    );
  }
}

class _SkyPainter extends CustomPainter {
  _SkyPainter(this.sky, this.isDay, this.time) : super(repaint: time);

  final Sky sky;
  final bool isDay;
  final Animation<double> time;

  static final _rng = Random(7);
  static final _stars = List.generate(70, (_) => (_rng.nextDouble(), _rng.nextDouble() * .6, _rng.nextDouble()));
  static final _drops = List.generate(120, (_) => (_rng.nextDouble(), _rng.nextDouble(), .6 + _rng.nextDouble() * .4));
  static final _flakes = List.generate(70, (_) => (_rng.nextDouble(), _rng.nextDouble(), 1.5 + _rng.nextDouble() * 2.5));

  /// Seconds since the animation started, looping every minute.
  double get _t => time.value * 60;

  @override
  void paint(Canvas canvas, Size size) {
    if (!isDay) _paintStars(canvas, size);
    if (isDay && (sky == Sky.clear || sky == Sky.partlyCloudy)) _paintSun(canvas, size);
    if (!isDay && (sky == Sky.clear || sky == Sky.partlyCloudy)) _paintMoonGlow(canvas, size);
    if (sky != Sky.clear) _paintClouds(canvas, size);
    if (sky == Sky.fog) _paintFog(canvas, size);
    if (sky == Sky.rain || sky == Sky.drizzle || sky == Sky.thunder) {
      _paintRain(canvas, size, heavy: sky != Sky.drizzle);
    }
    if (sky == Sky.snow) _paintSnow(canvas, size);
    if (sky == Sky.thunder) _paintLightning(canvas, size);
  }

  void _paintStars(Canvas canvas, Size size) {
    final visible = switch (sky) {
      Sky.clear => 1.0,
      Sky.partlyCloudy => .6,
      _ => .15,
    };
    final p = Paint();
    for (final (x, y, phase) in _stars) {
      final twinkle = .5 + .5 * sin(_t * 1.6 + phase * 20);
      p.color = Colors.white.withValues(alpha: (.25 + .6 * twinkle) * visible);
      canvas.drawCircle(Offset(x * size.width, y * size.height), .6 + phase * 1.2, p);
    }
  }

  void _paintSun(Canvas canvas, Size size) {
    final c = Offset(size.width * .82, size.height * .1);
    final pulse = 1 + .04 * sin(_t * .8);
    canvas.drawCircle(
      c,
      size.width * .7 * pulse,
      Paint()
        ..shader = RadialGradient(colors: [
          const Color(0xFFFFF1B8).withValues(alpha: .55),
          const Color(0xFFFFE08A).withValues(alpha: .18),
          Colors.transparent,
        ], stops: const [0, .35, 1])
            .createShader(Rect.fromCircle(center: c, radius: size.width * .7 * pulse)),
    );
    // Slowly turning light rays.
    final rays = Paint()..color = Colors.white.withValues(alpha: .07);
    for (var i = 0; i < 10; i++) {
      final a = i * pi / 5 + _t * .03;
      final path = Path()
        ..moveTo(c.dx, c.dy)
        ..lineTo(c.dx + cos(a - .05) * size.height, c.dy + sin(a - .05) * size.height)
        ..lineTo(c.dx + cos(a + .05) * size.height, c.dy + sin(a + .05) * size.height)
        ..close();
      canvas.drawPath(path, rays);
    }
  }

  void _paintMoonGlow(Canvas canvas, Size size) {
    final c = Offset(size.width * .8, size.height * .1);
    canvas.drawCircle(
      c,
      size.width * .45,
      Paint()
        ..shader = RadialGradient(colors: [
          const Color(0xFFDDE4FF).withValues(alpha: .22),
          Colors.transparent,
        ]).createShader(Rect.fromCircle(center: c, radius: size.width * .45)),
    );
  }

  void _paintClouds(Canvas canvas, Size size) {
    final dense = switch (sky) {
      Sky.partlyCloudy => 3,
      Sky.fog => 4,
      _ => 6,
    };
    final dark = sky == Sky.thunder || sky == Sky.rain || !isDay;
    final paint = Paint()
      ..color = (dark ? const Color(0xFF9AA6B8) : Colors.white).withValues(alpha: dark ? .10 : .22)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30);
    for (var i = 0; i < dense; i++) {
      final speed = 4 + i * 1.7;
      final w = size.width * (.7 + (i % 3) * .2);
      final x = ((_t * speed + i * 173) % (size.width + w * 2)) - w;
      final y = size.height * (.06 + (i * .11) % .45);
      canvas.drawOval(Rect.fromLTWH(x, y, w, w * .32), paint);
      canvas.drawOval(Rect.fromLTWH(x + w * .25, y - w * .1, w * .55, w * .3), paint);
    }
  }

  void _paintFog(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: .12)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40);
    for (var i = 0; i < 5; i++) {
      final dx = sin(_t * .15 + i) * 60;
      canvas.drawRect(
        Rect.fromLTWH(-80 + dx, size.height * (.3 + i * .14), size.width + 160, 70),
        paint,
      );
    }
  }

  void _paintRain(Canvas canvas, Size size, {required bool heavy}) {
    final count = heavy ? _drops.length : _drops.length ~/ 3;
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: heavy ? .28 : .2)
      ..strokeWidth = 1.3
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < count; i++) {
      final (x, y, speed) = _drops[i];
      final fall = (y + _t * speed * 1.1) % 1.0;
      final p = Offset(x * size.width + fall * 40, fall * size.height);
      canvas.drawLine(p, p + const Offset(-4, 18), paint);
    }
  }

  void _paintSnow(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: .8);
    for (final (x, y, r) in _flakes) {
      final fall = (y + _t * .045 * r) % 1.0;
      final sway = sin(_t * .9 + x * 10) * 14;
      canvas.drawCircle(Offset(x * size.width + sway, fall * size.height), r, paint);
    }
  }

  void _paintLightning(Canvas canvas, Size size) {
    // A short double flash roughly every seven seconds.
    final phase = _t % 7;
    final flash = phase < .12 || (phase > .25 && phase < .33);
    if (flash) {
      canvas.drawRect(Offset.zero & size, Paint()..color = Colors.white.withValues(alpha: .18));
    }
  }

  @override
  bool shouldRepaint(_SkyPainter old) => old.sky != sky || old.isDay != isDay;
}
