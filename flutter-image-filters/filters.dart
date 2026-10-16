import 'dart:math';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// Classic image-processing operations, implemented by hand on top of
/// `package:image` pixel access so each step is easy to read and test.
enum LabFilter {
  original,
  grayscale,
  equalize,
  blur,
  sharpen,
  sobel,
  otsu,
  adaptive,
  invert,
  ocrReady,
}

/// Luminance of an RGB pixel (ITU-R BT.601).
int luma(num r, num g, num b) => (0.299 * r + 0.587 * g + 0.114 * b).round().clamp(0, 255);

img.Image toGray(img.Image src) {
  final out = img.Image(width: src.width, height: src.height, numChannels: 1);
  for (final p in src) {
    out.setPixelR(p.x, p.y, luma(p.r, p.g, p.b));
  }
  return out;
}

/// 256-bin histogram of the luminance channel.
List<int> histogram(img.Image src) {
  final h = List<int>.filled(256, 0);
  final gray = src.numChannels == 1;
  for (final p in src) {
    h[gray ? p.r.toInt() : luma(p.r, p.g, p.b)]++;
  }
  return h;
}

/// Spreads the gray levels over the full range using the cumulative histogram.
img.Image equalize(img.Image src) {
  final gray = src.numChannels == 1 ? src : toGray(src);
  final h = histogram(gray);
  final total = gray.width * gray.height;
  final cdf = List<int>.filled(256, 0);
  var running = 0;
  for (var i = 0; i < 256; i++) {
    running += h[i];
    cdf[i] = running;
  }
  final cdfMin = cdf.firstWhere((v) => v > 0);
  final lut = List<int>.generate(
    256,
    (i) => total == cdfMin ? i : (((cdf[i] - cdfMin) / (total - cdfMin)) * 255).round().clamp(0, 255),
  );
  final out = img.Image(width: gray.width, height: gray.height, numChannels: 1);
  for (final p in gray) {
    out.setPixelR(p.x, p.y, lut[p.r.toInt()]);
  }
  return out;
}

/// Otsu's method: the threshold that maximises the variance between the
/// background and foreground classes.
int otsuThreshold(List<int> hist) {
  final total = hist.fold<int>(0, (a, b) => a + b);
  var sumAll = 0.0;
  for (var i = 0; i < 256; i++) {
    sumAll += i * hist[i];
  }
  var sumBg = 0.0, weightBg = 0, best = 0.0, threshold = 0;
  for (var t = 0; t < 256; t++) {
    weightBg += hist[t];
    if (weightBg == 0) continue;
    final weightFg = total - weightBg;
    if (weightFg == 0) break;
    sumBg += t * hist[t];
    final meanBg = sumBg / weightBg;
    final meanFg = (sumAll - sumBg) / weightFg;
    final between = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

img.Image binarize(img.Image src, {int? threshold}) {
  final gray = src.numChannels == 1 ? src : toGray(src);
  final t = threshold ?? otsuThreshold(histogram(gray));
  final out = img.Image(width: gray.width, height: gray.height, numChannels: 1);
  for (final p in gray) {
    out.setPixelR(p.x, p.y, p.r > t ? 255 : 0);
  }
  return out;
}

/// Bradley–Roth adaptive threshold: a pixel is ink when it is [percent] darker
/// than the mean of its neighbourhood. An integral image makes every local
/// mean O(1), and unlike a single global threshold it copes with shadows and
/// coloured text.
img.Image adaptiveThreshold(img.Image src, {int? window, double percent = 0.15}) {
  final gray = src.numChannels == 1 ? src : toGray(src);
  final w = gray.width, h = gray.height;
  final s = window ?? max(8, (max(w, h) / 16).round());
  final integral = List<int>.filled((w + 1) * (h + 1), 0);
  for (var y = 0; y < h; y++) {
    var row = 0;
    for (var x = 0; x < w; x++) {
      row += gray.getPixel(x, y).r.toInt();
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  final out = img.Image(width: w, height: h, numChannels: 1);
  final half = s ~/ 2;
  for (var y = 0; y < h; y++) {
    final y1 = max(0, y - half), y2 = min(h - 1, y + half);
    for (var x = 0; x < w; x++) {
      final x1 = max(0, x - half), x2 = min(w - 1, x + half);
      final count = (x2 - x1 + 1) * (y2 - y1 + 1);
      final sum = integral[(y2 + 1) * (w + 1) + x2 + 1] -
          integral[y1 * (w + 1) + x2 + 1] -
          integral[(y2 + 1) * (w + 1) + x1] +
          integral[y1 * (w + 1) + x1];
      final v = gray.getPixel(x, y).r * count;
      out.setPixelR(x, y, v <= sum * (1 - percent) ? 0 : 255);
    }
  }
  return out;
}

/// Applies a 3×3 kernel to the luminance channel.
img.Image convolve3(img.Image src, List<double> k, {double divisor = 1, double offset = 0}) {
  final gray = src.numChannels == 1 ? src : toGray(src);
  final w = gray.width, h = gray.height;
  final data = Uint8List(w * h);
  for (final p in gray) {
    data[p.y * w + p.x] = p.r.toInt();
  }
  final out = img.Image(width: w, height: h, numChannels: 1);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var acc = 0.0;
      for (var ky = -1; ky <= 1; ky++) {
        final yy = (y + ky).clamp(0, h - 1);
        for (var kx = -1; kx <= 1; kx++) {
          final xx = (x + kx).clamp(0, w - 1);
          acc += data[yy * w + xx] * k[(ky + 1) * 3 + (kx + 1)];
        }
      }
      out.setPixelR(x, y, (acc / divisor + offset).round().clamp(0, 255));
    }
  }
  return out;
}

img.Image gaussianBlur(img.Image src) => convolve3(src, const [1, 2, 1, 2, 4, 2, 1, 2, 1], divisor: 16);

img.Image sharpen(img.Image src) => convolve3(src, const [0, -1, 0, -1, 5, -1, 0, -1, 0]);

/// Edge strength from the Sobel operator: sqrt(Gx² + Gy²).
img.Image sobel(img.Image src) {
  final gray = src.numChannels == 1 ? src : toGray(src);
  final w = gray.width, h = gray.height;
  final data = Uint8List(w * h);
  for (final p in gray) {
    data[p.y * w + p.x] = p.r.toInt();
  }
  int at(int x, int y) => data[y.clamp(0, h - 1) * w + x.clamp(0, w - 1)];
  final out = img.Image(width: w, height: h, numChannels: 1);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      final gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) +
          at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      final gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
          at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      out.setPixelR(x, y, sqrt(gx * gx + gy * gy).round().clamp(0, 255));
    }
  }
  return out;
}

img.Image invert(img.Image src) {
  final out = img.Image.from(src);
  for (final p in out) {
    p
      ..r = 255 - p.r
      ..g = 255 - p.g
      ..b = 255 - p.b;
  }
  return out;
}

/// Pre-processing that helps OCR on phone photos of paper with shadows or
/// low contrast: grayscale, then a local (adaptive) threshold.
img.Image ocrReady(img.Image src) => adaptiveThreshold(toGray(src));

img.Image applyFilter(img.Image src, LabFilter f) => switch (f) {
      LabFilter.original => src,
      LabFilter.grayscale => toGray(src),
      LabFilter.equalize => equalize(src),
      LabFilter.blur => gaussianBlur(src),
      LabFilter.sharpen => sharpen(src),
      LabFilter.sobel => sobel(src),
      LabFilter.otsu => binarize(src),
      LabFilter.adaptive => adaptiveThreshold(src),
      LabFilter.invert => invert(src),
      LabFilter.ocrReady => ocrReady(src),
    };

/// Downscales so the longest side is at most [maxSide] (phone photos are huge).
img.Image fit(img.Image src, {int maxSide = 1280}) {
  final longest = max(src.width, src.height);
  if (longest <= maxSide) return src;
  return src.width >= src.height
      ? img.copyResize(src, width: maxSide, interpolation: img.Interpolation.average)
      : img.copyResize(src, height: maxSide, interpolation: img.Interpolation.average);
}

/// Result of running a filter in a background isolate.
class FilterResult {
  const FilterResult({required this.png, required this.histogram, required this.millis, this.threshold});

  final Uint8List png;
  final List<int> histogram;
  final int millis;

  /// Otsu threshold, for filters that use it.
  final int? threshold;
}

/// Decodes [bytes], applies [filter] and re-encodes; meant for `Isolate.run`.
FilterResult runFilter(Uint8List bytes, LabFilter filter) {
  final watch = Stopwatch()..start();
  final decoded = img.decodeImage(bytes);
  if (decoded == null) throw const FormatException('Unsupported image');
  final source = fit(img.bakeOrientation(decoded));
  final result = applyFilter(source, filter);
  final hist = histogram(result);
  final threshold = switch (filter) {
    LabFilter.otsu => otsuThreshold(histogram(toGray(source))),
    _ => null,
  };
  final png = img.encodePng(result.numChannels == 1 ? result.convert(numChannels: 3) : result);
  return FilterResult(png: png, histogram: hist, millis: watch.elapsedMilliseconds, threshold: threshold);
}
