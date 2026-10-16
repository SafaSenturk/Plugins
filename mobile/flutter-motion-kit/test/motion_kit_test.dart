import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../message_view.dart';
import '../pressable.dart';
import '../reveal.dart';
import '../slide_to_confirm.dart';

Widget host(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  testWidgets('SlideToConfirm: tap the knob or drag it to the end', (tester) async {
    var taps = 0, slides = 0;
    await tester.pumpWidget(host(SizedBox(
      width: 350,
      child: SlideToConfirm(label: 'Continue', hint: 'Slide', onTap: () => taps++, onSlid: () => slides++),
    )));

    await tester.tap(find.text('Continue'));
    expect(taps, 1);

    // A short drag springs back without confirming.
    await tester.drag(find.text('Continue'), const Offset(60, 0));
    await tester.pump(const Duration(milliseconds: 500));
    expect(slides, 0);

    await tester.drag(find.text('Continue'), const Offset(300, 0));
    await tester.pump();
    expect(slides, 1);
  });

  testWidgets('Pressable calls onTap and is a button for screen readers', (tester) async {
    var taps = 0;
    await tester.pumpWidget(host(Pressable(onTap: () => taps++, child: const Text('Card'))));
    await tester.tap(find.text('Card'));
    expect(taps, 1);
    expect(tester.getSemantics(find.byType(Pressable)), matchesSemantics(isButton: true, hasTapAction: true, label: 'Card'));
  });

  testWidgets('Reveal ends fully visible', (tester) async {
    await tester.pumpWidget(host(const Reveal(index: 3, child: Text('Item'))));
    await tester.pumpAndSettle();
    expect(tester.widget<Opacity>(find.byType(Opacity)).opacity, 1);
  });

  testWidgets('MessageView shows the action', (tester) async {
    var retried = false;
    await tester.pumpWidget(host(MessageView(
      icon: Icons.wifi_off_rounded,
      title: 'You are offline',
      body: 'Check your connection.',
      actionLabel: 'Try again',
      onAction: () => retried = true,
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Try again'));
    expect(retried, isTrue);
  });
}
