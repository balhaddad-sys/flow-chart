import 'package:flutter/material.dart';

class AppSpacing {
  AppSpacing._();

  // ── Base spacing scale ────────────────────────────────────────────────────
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;

  // ── Screen padding ────────────────────────────────────────────────────────
  static const EdgeInsets screenPadding =
      EdgeInsets.symmetric(horizontal: 20, vertical: sm);

  static const EdgeInsets screenHorizontal =
      EdgeInsets.symmetric(horizontal: 20);

  // ── Card padding ──────────────────────────────────────────────────────────
  static const EdgeInsets cardPadding = EdgeInsets.all(md);

  static const EdgeInsets cardPaddingLg = EdgeInsets.all(lg);

  // ── Border radius ─────────────────────────────────────────────────────────
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusXl = 24.0;
  static const double radiusFull = 999.0;

  // ── Vertical gaps ─────────────────────────────────────────────────────────
  static const SizedBox gapXs = SizedBox(height: xs);
  static const SizedBox gapSm = SizedBox(height: sm);
  static const SizedBox gapMd = SizedBox(height: md);
  static const SizedBox gapLg = SizedBox(height: lg);
  static const SizedBox gapXl = SizedBox(height: xl);
  static const SizedBox gapXxl = SizedBox(height: xxl);

  // ── Horizontal gaps ───────────────────────────────────────────────────────
  static const SizedBox hGapXs = SizedBox(width: xs);
  static const SizedBox hGapSm = SizedBox(width: sm);
  static const SizedBox hGapMd = SizedBox(width: md);
  static const SizedBox hGapLg = SizedBox(width: lg);
}
