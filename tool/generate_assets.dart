// Run with: dart run tool/generate_assets.dart
// Generates splash logos and app icons for flutter_native_splash & flutter_launcher_icons.

import 'dart:io';
import 'dart:typed_data';
import 'dart:math';

/// Creates a simple PNG with a solid color background and centered "M+" text-like icon.
/// Uses raw PNG encoding (no external packages needed).
void main() {
  // Generate splash logos (400x400 with MedQ "M" mark, transparent bg)
  _generateSplashLogo(
    'assets/icons/splash_logo.png',
    bgColor: [0xF3, 0xF7, 0xF8, 0xFF], // light background
    fgColor: [0x0F, 0x76, 0x6E, 0xFF], // primary teal
  );
  _generateSplashLogo(
    'assets/icons/splash_logo_dark.png',
    bgColor: [0x08, 0x13, 0x1D, 0xFF], // dark background
    fgColor: [0x14, 0xB8, 0xA6, 0xFF], // primaryLight teal
  );

  // Generate app icon (1024x1024, filled background)
  _generateAppIcon(
    'assets/icons/app_icon.png',
    bgColor: [0x0F, 0x76, 0x6E, 0xFF],
    fgColor: [0xFF, 0xFF, 0xFF, 0xFF],
    size: 1024,
  );

  // Generate foreground for adaptive icon (1024x1024, transparent bg)
  _generateAppIcon(
    'assets/icons/app_icon_foreground.png',
    bgColor: [0x00, 0x00, 0x00, 0x00], // transparent
    fgColor: [0xFF, 0xFF, 0xFF, 0xFF],
    size: 1024,
  );

  print('Assets generated successfully!');
  print('  - assets/icons/splash_logo.png');
  print('  - assets/icons/splash_logo_dark.png');
  print('  - assets/icons/app_icon.png');
  print('  - assets/icons/app_icon_foreground.png');
  print('');
  print('IMPORTANT: Replace these with your actual designed assets.');
  print('Then run:');
  print('  dart run flutter_native_splash:create');
  print('  dart run flutter_launcher_icons');
}

void _generateSplashLogo(String path, {
  required List<int> bgColor,
  required List<int> fgColor,
}) {
  const size = 400;
  _generateAppIcon(path, bgColor: bgColor, fgColor: fgColor, size: size);
}

void _generateAppIcon(String path, {
  required List<int> bgColor,
  required List<int> fgColor,
  required int size,
}) {
  // Create RGBA pixel data
  final pixels = Uint8List(size * size * 4);

  // Fill background
  for (var i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = bgColor[0];
    pixels[i * 4 + 1] = bgColor[1];
    pixels[i * 4 + 2] = bgColor[2];
    pixels[i * 4 + 3] = bgColor[3];
  }

  // Draw a stylized "M" shape representing MedQ
  final centerX = size / 2;
  final centerY = size / 2;
  final iconSize = size * 0.5; // 50% of canvas

  // Draw thick "M" strokes
  final strokeWidth = iconSize * 0.12;
  final left = centerX - iconSize / 2;
  final right = centerX + iconSize / 2;
  final top = centerY - iconSize / 2;
  final bottom = centerY + iconSize / 2;
  final midX = centerX;
  final midY = centerY + iconSize * 0.05;

  // Left vertical stroke of M
  _drawRect(pixels, size, left.round(), top.round(),
      (left + strokeWidth).round(), bottom.round(), fgColor);

  // Right vertical stroke of M
  _drawRect(pixels, size, (right - strokeWidth).round(), top.round(),
      right.round(), bottom.round(), fgColor);

  // Left diagonal of M (going down to center)
  _drawLine(pixels, size, left + strokeWidth / 2, top,
      midX, midY, strokeWidth, fgColor);

  // Right diagonal of M (going up from center)
  _drawLine(pixels, size, midX, midY,
      right - strokeWidth / 2, top, strokeWidth, fgColor);

  // Draw a small "+" cross below the M (the Q/medical symbol)
  final crossSize = iconSize * 0.12;
  final crossX = right - iconSize * 0.08;
  final crossY = bottom - iconSize * 0.08;
  final crossThick = crossSize * 0.35;

  // Horizontal bar of +
  _drawRect(pixels, size,
      (crossX - crossSize).round(), (crossY - crossThick / 2).round(),
      (crossX + crossSize).round(), (crossY + crossThick / 2).round(),
      fgColor);

  // Vertical bar of +
  _drawRect(pixels, size,
      (crossX - crossThick / 2).round(), (crossY - crossSize).round(),
      (crossX + crossThick / 2).round(), (crossY + crossSize).round(),
      fgColor);

  // Encode as PNG
  final png = _encodePng(pixels, size, size);
  File(path).writeAsBytesSync(png);
}

void _drawRect(Uint8List pixels, int canvasSize,
    int x1, int y1, int x2, int y2, List<int> color) {
  for (var y = max(0, y1); y < min(canvasSize, y2); y++) {
    for (var x = max(0, x1); x < min(canvasSize, x2); x++) {
      final i = (y * canvasSize + x) * 4;
      _blendPixel(pixels, i, color);
    }
  }
}

void _drawLine(Uint8List pixels, int canvasSize,
    double x1, double y1, double x2, double y2,
    double thickness, List<int> color) {
  final dx = x2 - x1;
  final dy = y2 - y1;
  final len = sqrt(dx * dx + dy * dy);
  final steps = (len * 2).round();

  for (var s = 0; s <= steps; s++) {
    final t = s / steps;
    final cx = x1 + dx * t;
    final cy = y1 + dy * t;
    final half = thickness / 2;

    for (var py = (cy - half).round(); py <= (cy + half).round(); py++) {
      for (var px = (cx - half).round(); px <= (cx + half).round(); px++) {
        if (px >= 0 && px < canvasSize && py >= 0 && py < canvasSize) {
          final dist = sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
          if (dist <= half) {
            final i = (py * canvasSize + px) * 4;
            _blendPixel(pixels, i, color);
          }
        }
      }
    }
  }
}

void _blendPixel(Uint8List pixels, int i, List<int> color) {
  if (color[3] == 0xFF) {
    pixels[i + 0] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  } else if (color[3] > 0) {
    final a = color[3] / 255.0;
    final ia = 1.0 - a;
    pixels[i + 0] = (color[0] * a + pixels[i + 0] * ia).round();
    pixels[i + 1] = (color[1] * a + pixels[i + 1] * ia).round();
    pixels[i + 2] = (color[2] * a + pixels[i + 2] * ia).round();
    pixels[i + 3] = min(255, pixels[i + 3] + color[3]);
  }
}

// ── Minimal PNG encoder (no external deps) ───────────────────────────────────

Uint8List _encodePng(Uint8List rgba, int width, int height) {
  final rawData = <int>[];
  for (var y = 0; y < height; y++) {
    rawData.add(0); // filter byte: None
    final offset = y * width * 4;
    rawData.addAll(rgba.sublist(offset, offset + width * 4));
  }

  final compressed = zLibEncode(Uint8List.fromList(rawData));

  final out = BytesBuilder();
  // PNG signature
  out.add([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  final ihdr = BytesBuilder();
  ihdr.add(_int32(width));
  ihdr.add(_int32(height));
  ihdr.addByte(8); // bit depth
  ihdr.addByte(6); // color type: RGBA
  ihdr.addByte(0); // compression
  ihdr.addByte(0); // filter
  ihdr.addByte(0); // interlace
  _writeChunk(out, 'IHDR', ihdr.toBytes());

  // IDAT
  _writeChunk(out, 'IDAT', compressed);

  // IEND
  _writeChunk(out, 'IEND', Uint8List(0));

  return out.toBytes();
}

void _writeChunk(BytesBuilder out, String type, Uint8List data) {
  out.add(_int32(data.length));
  final typeBytes = type.codeUnits;
  out.add(typeBytes);
  out.add(data);
  // CRC
  final crcData = <int>[...typeBytes, ...data];
  out.add(_int32(_crc32(crcData)));
}

Uint8List _int32(int value) {
  return Uint8List.fromList([
    (value >> 24) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ]);
}

// CRC32 table
late final _crcTable = _makeCrcTable();

List<int> _makeCrcTable() {
  final table = List<int>.filled(256, 0);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) {
      if (c & 1 != 0) {
        c = 0xEDB88320 ^ (c >> 1);
      } else {
        c = c >> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

int _crc32(List<int> data) {
  var crc = 0xFFFFFFFF;
  for (final byte in data) {
    crc = _crcTable[(crc ^ byte) & 0xFF] ^ (crc >> 8);
  }
  return crc ^ 0xFFFFFFFF;
}

// ── Minimal zlib/deflate encoder ─────────────────────────────────────────────

Uint8List zLibEncode(Uint8List data) {
  // Use dart:io's ZLibCodec
  return ZLibCodec().encode(data) as Uint8List;
}
