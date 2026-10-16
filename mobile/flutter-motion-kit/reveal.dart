import 'package:flutter/material.dart';

/// Fades and slides its child in, delayed by [index], so list items appear one
/// after another. Give it a new key (for example the filter + item id) to play
/// the animation again when the list changes.
class Reveal extends StatelessWidget {
  const Reveal({super.key, required this.index, required this.child, this.offset = 24, this.step = 70});

  final int index;
  final Widget child;

  /// How far (logical pixels) the child travels upwards.
  final double offset;

  /// Delay between two items in milliseconds. Capped after the 8th item.
  final int step;

  @override
  Widget build(BuildContext context) {
    final delay = step * index.clamp(0, 8);
    final total = 460 + delay;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total),
      curve: Interval(delay / total, 1, curve: Curves.easeOutCubic),
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, offset * (1 - t)), child: child),
      ),
      child: child,
    );
  }
}
