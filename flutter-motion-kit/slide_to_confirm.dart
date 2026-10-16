import 'package:flutter/material.dart';

import 'glass.dart';

/// A "Continue ··· Slide →" control: tap the knob for [onTap], or drag it to
/// the end for [onSlid]. Released early, the knob springs back.
class SlideToConfirm extends StatefulWidget {
  const SlideToConfirm({
    super.key,
    required this.label,
    required this.hint,
    required this.onSlid,
    this.onTap,
    this.height = 58,
    this.knobWidth = 117,
    this.knobColor = const Color(0xFF0C0B0C),
    this.textStyle = const TextStyle(fontSize: 17.5, fontWeight: FontWeight.w500, color: Colors.white),
    this.arrow = Icons.arrow_forward_rounded,
    this.threshold = .72,
  });

  /// Text on the knob, for example "Continue".
  final String label;

  /// Text at the end of the track, for example "Slide".
  final String hint;
  final VoidCallback onSlid;
  final VoidCallback? onTap;
  final double height;
  final double knobWidth;
  final Color knobColor;
  final TextStyle textStyle;
  final IconData arrow;

  /// How far (0–1) the knob must be dragged to count as a slide.
  final double threshold;

  @override
  State<SlideToConfirm> createState() => _SlideToConfirmState();
}

class _SlideToConfirmState extends State<SlideToConfirm> with TickerProviderStateMixin {
  static const _inset = 4.0;

  double _dx = 0;
  double _max = 1;
  double _from = 0;
  late final AnimationController _back = AnimationController(vsync: this, duration: const Duration(milliseconds: 380))
    ..addListener(() => setState(() => _dx = _from * (1 - Curves.easeOutBack.transform(_back.value))));
  late final AnimationController _nudge =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _back.dispose();
    _nudge.dispose();
    super.dispose();
  }

  void _end() {
    if (_dx > _max * widget.threshold) {
      setState(() => _dx = _max);
      widget.onSlid();
      return;
    }
    _from = _dx;
    _back.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          _max = box.maxWidth - widget.knobWidth - _inset * 2;
          final progress = (_dx / _max).clamp(0.0, 1.0);
          final radius = widget.height / 2;
          return Semantics(
            button: true,
            label: widget.label,
            hint: widget.hint,
            onTap: widget.onTap ?? widget.onSlid,
            child: Glass(
              radius: radius,
              opacity: .16,
              blur: 14,
              child: Container(
                height: widget.height,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(radius),
                  border: Border.all(color: Colors.white.withValues(alpha: .28)),
                  gradient: LinearGradient(
                    colors: [Colors.white.withValues(alpha: .10), Colors.black.withValues(alpha: .10)],
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: 16,
                      top: 0,
                      bottom: 0,
                      child: Opacity(
                        opacity: 1 - progress,
                        child: Row(
                          children: [
                            Text(widget.hint, style: widget.textStyle),
                            const SizedBox(width: 6),
                            AnimatedBuilder(
                              animation: _nudge,
                              builder: (context, child) {
                                final t = Curves.easeInOut.transform((_nudge.value * 2).clamp(0.0, 1.0));
                                return Transform.translate(
                                  offset: Offset(4 * (t < .5 ? t * 2 : 2 - t * 2), 0),
                                  child: child,
                                );
                              },
                              child: Icon(widget.arrow, color: widget.textStyle.color, size: 24),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: _inset + _dx,
                      top: _inset,
                      bottom: _inset,
                      child: GestureDetector(
                        onTap: widget.onTap,
                        onHorizontalDragStart: (_) => _back.stop(),
                        onHorizontalDragUpdate: (d) => setState(() => _dx = (_dx + d.delta.dx).clamp(0, _max)),
                        onHorizontalDragEnd: (_) => _end(),
                        child: Container(
                          width: widget.knobWidth,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: widget.knobColor, borderRadius: BorderRadius.circular(radius)),
                          child: Text(widget.label, style: widget.textStyle),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
}
