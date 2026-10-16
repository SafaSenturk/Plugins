import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import '../filters.dart';

/// Left half dark (40), right half bright (210).
img.Image twoTone({int w = 20, int h = 10}) {
  final im = img.Image(width: w, height: h);
  for (final p in im) {
    final v = p.x < w ~/ 2 ? 40 : 210;
    p
      ..r = v
      ..g = v
      ..b = v;
  }
  return im;
}

void main() {
  test('luma follows BT.601 weights', () {
    expect(luma(255, 255, 255), 255);
    expect(luma(0, 0, 0), 0);
    expect(luma(255, 0, 0), 76);
    expect(luma(0, 255, 0), 150);
  });

  test('histogram counts every pixel', () {
    final h = histogram(twoTone());
    expect(h[40], 100);
    expect(h[210], 100);
    expect(h.reduce((a, b) => a + b), 200);
  });

  test('Otsu puts the threshold between the two classes', () {
    final t = otsuThreshold(histogram(twoTone()));
    expect(t, inInclusiveRange(40, 209));
    final bin = binarize(twoTone());
    expect(bin.getPixel(2, 2).r, 0);
    expect(bin.getPixel(17, 2).r, 255);
  });

  test('equalization stretches a narrow range to 0–255', () {
    final im = img.Image(width: 4, height: 1);
    for (final (i, v) in [100, 110, 120, 130].indexed) {
      im.setPixelRgb(i, 0, v, v, v);
    }
    final eq = equalize(im);
    expect(eq.getPixel(0, 0).r, 0);
    expect(eq.getPixel(3, 0).r, 255);
  });

  test('Sobel responds on the edge and not on flat areas', () {
    final edges = sobel(twoTone());
    expect(edges.getPixel(2, 5).r, 0);
    expect(edges.getPixel(10, 5).r, greaterThan(200));
  });

  test('blur keeps flat areas unchanged', () {
    final blurred = gaussianBlur(twoTone());
    expect(blurred.getPixel(2, 5).r, 40);
    expect(blurred.getPixel(17, 5).r, 210);
  });

  test('adaptive threshold keeps dark text under a shadow that fools Otsu', () {
    // Paper fades from 230 (left) to 90 (right); "ink" is 40 below the paper.
    final im = img.Image(width: 64, height: 16);
    for (final p in im) {
      final paper = 230 - (p.x * 140 ~/ 63);
      final v = (p.y == 8 && p.x % 8 == 4) ? paper - 60 : paper;
      p
        ..r = v
        ..g = v
        ..b = v;
    }
    final adaptive = adaptiveThreshold(im, window: 8);
    // Ink is found on both the bright and the shadowed side…
    expect(adaptive.getPixel(4, 8).r, 0);
    expect(adaptive.getPixel(60, 8).r, 0);
    // …and the shadowed paper stays white.
    expect(adaptive.getPixel(60, 2).r, 255);
    // A global threshold turns the whole shadowed side black.
    expect(binarize(im).getPixel(60, 2).r, 0);
  });

  test('invert flips every channel', () {
    expect(invert(twoTone()).getPixel(2, 2).r, 215);
  });

  test('fit only shrinks large images, keeping the aspect ratio', () {
    final big = img.Image(width: 4000, height: 3000);
    final small = fit(big);
    expect(small.width, 1280);
    expect(small.height, 960);
    expect(fit(twoTone()).width, 20);
  });

  test('runFilter round-trips through PNG and reports a histogram', () {
    final png = img.encodePng(twoTone());
    final result = runFilter(png, LabFilter.ocrReady);
    final decoded = img.decodePng(result.png)!;
    expect(decoded.width, 20);
    expect(result.histogram.reduce((a, b) => a + b), 200);
    expect(result.threshold, isNull);
    // Grayscale output is stored as RGB with equal channels.
    final p = decoded.getPixel(17, 5);
    expect({p.r, p.g, p.b}, hasLength(1));
  });
}
