import 'dart:math';

import 'package:flutter/material.dart';

import 'card_validators.dart';

/// A live preview of the card being typed. Flips to its back for the CVV.
class CreditCardView extends StatelessWidget {
  const CreditCardView({
    super.key,
    required this.number,
    required this.holder,
    required this.expiry,
    required this.cvv,
    required this.showBack,
    required this.holderPlaceholder,
  });

  final String number;
  final String holder;
  final String expiry;
  final String cvv;
  final bool showBack;
  final String holderPlaceholder;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(end: showBack ? pi : 0),
      duration: const Duration(milliseconds: 550),
      curve: Curves.easeInOutCubic,
      builder: (context, angle, _) {
        final back = angle > pi / 2;
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012)
            ..rotateY(angle),
          child: back
              ? Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.rotationY(pi),
                  child: _Back(cvv: cvv),
                )
              : _Front(
                  number: number,
                  holder: holder.isEmpty ? holderPlaceholder : holder.toUpperCase(),
                  expiry: expiry.isEmpty ? 'MM/YY' : expiry,
                ),
        );
      },
    );
  }
}

List<Color> _gradientFor(CardBrand brand) => switch (brand) {
      CardBrand.visa => const [Color(0xFF1A1F71), Color(0xFF3A47C9)],
      CardBrand.mastercard => const [Color(0xFF16161A), Color(0xFF43434F)],
      CardBrand.amex => const [Color(0xFF0B6E73), Color(0xFF1BA3A0)],
      CardBrand.troy => const [Color(0xFF0E6E4F), Color(0xFF26B07E)],
      CardBrand.unknown => const [Color(0xFFFF5A36), Color(0xFFFF9466)],
    };

class _Shell extends StatelessWidget {
  const _Shell({required this.colors, required this.child});

  final List<Color> colors;
  final Widget child;

  @override
  Widget build(BuildContext context) => AspectRatio(
        aspectRatio: 1.586,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 400),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              colors: colors,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: colors.first.withValues(alpha: 0.35),
                blurRadius: 28,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              const Positioned(
                right: -60,
                top: -80,
                child: _Circle(size: 220, opacity: 0.10),
              ),
              const Positioned(
                left: -40,
                bottom: -110,
                child: _Circle(size: 240, opacity: 0.07),
              ),
              child,
            ],
          ),
        ),
      );
}

class _Circle extends StatelessWidget {
  const _Circle({required this.size, required this.opacity});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: opacity),
        ),
      );
}

const _mono = TextStyle(
  color: Colors.white,
  fontFamily: 'monospace',
  fontWeight: FontWeight.w600,
  letterSpacing: 2,
);

class _Front extends StatelessWidget {
  const _Front({required this.number, required this.holder, required this.expiry});

  final String number;
  final String holder;
  final String expiry;

  @override
  Widget build(BuildContext context) {
    final brand = CardValidators.brandOf(number);
    final digits = CardValidators.digitsOnly(number);
    // Typed digits followed by bullet placeholders, grouped in fours.
    final padded = digits.padRight(16, '•');
    final shown = [
      for (var i = 0; i < padded.length; i += 4)
        padded.substring(i, i + 4 > padded.length ? padded.length : i + 4),
    ].join(' ');

    return _Shell(
      colors: _gradientFor(brand),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 32,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    gradient: const LinearGradient(
                      colors: [Color(0xFFF2D27B), Color(0xFFC9A44C)],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const Icon(Icons.contactless_rounded, color: Colors.white70),
                const Spacer(),
                _BrandMark(brand: brand),
              ],
            ),
            const Spacer(),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(shown, style: _mono.copyWith(fontSize: 22)),
            ),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    holder,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                Text(expiry, style: _mono.copyWith(fontSize: 15, letterSpacing: 1)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Back extends StatelessWidget {
  const _Back({required this.cvv});

  final String cvv;

  @override
  Widget build(BuildContext context) => _Shell(
        colors: const [Color(0xFF2B2B33), Color(0xFF4A4A57)],
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 26),
            Container(height: 44, color: Colors.black87),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    height: 38,
                    width: 70,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      cvv.isEmpty ? '•••' : cvv,
                      style: _mono.copyWith(color: Colors.black87, fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({required this.brand});

  final CardBrand brand;

  @override
  Widget build(BuildContext context) {
    switch (brand) {
      case CardBrand.mastercard:
        return SizedBox(
          width: 46,
          height: 28,
          child: Stack(
            children: [
              Positioned(left: 0, child: _dot(const Color(0xFFEB001B))),
              Positioned(right: 0, child: _dot(const Color(0xFFF79E1B).withValues(alpha: 0.9))),
            ],
          ),
        );
      case CardBrand.unknown:
        return const Icon(Icons.credit_card_rounded, color: Colors.white70);
      default:
        return Text(
          brand.name.toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontStyle: FontStyle.italic,
            fontSize: 20,
            letterSpacing: 1,
          ),
        );
    }
  }

  Widget _dot(Color c) => Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(color: c, shape: BoxShape.circle),
      );
}
