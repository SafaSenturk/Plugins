import 'dart:ui';

import 'package:flutter/material.dart';

/// Frosted glass shape for buttons and badges on top of photos.
class Glass extends StatelessWidget {
  const Glass({
    super.key,
    required this.child,
    this.radius = 100,
    this.opacity = .24,
    this.blur = 12,
    this.tint = Colors.white,
  });

  final Widget child;
  final double radius;

  /// Opacity of the [tint] layer above the blurred background.
  final double opacity;
  final double blur;
  final Color tint;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: ColoredBox(color: tint.withValues(alpha: opacity), child: child),
        ),
      );
}
