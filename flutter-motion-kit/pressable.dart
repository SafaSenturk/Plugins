import 'package:flutter/material.dart';

/// Shrinks its child a little while it is pressed, then calls [onTap].
/// Wrap cards, chips and custom buttons with it instead of an InkWell when the
/// design has no ripple. Screen readers see it as a button.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.scale = .96});

  final Widget child;
  final VoidCallback? onTap;

  /// Size while pressed (0.96 = 4 % smaller).
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap != null && _down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => Semantics(
        button: widget.onTap != null,
        container: widget.onTap != null,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => _set(true),
          onTapUp: (_) => _set(false),
          onTapCancel: () => _set(false),
          onTap: widget.onTap,
          child: AnimatedScale(
            scale: _down ? widget.scale : 1,
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOut,
            child: widget.child,
          ),
        ),
      );
}
