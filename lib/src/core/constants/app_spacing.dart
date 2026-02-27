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
  static const EdgeInsets screenPadding = EdgeInsets.symmetric(
    horizontal: 24,
    vertical: 12,
  );

  static const EdgeInsets screenHorizontal = EdgeInsets.symmetric(
    horizontal: 24,
  );

  // ── Card padding ──────────────────────────────────────────────────────────
  static const EdgeInsets cardPadding = EdgeInsets.all(18);

  static const EdgeInsets cardPaddingLg = EdgeInsets.all(22);

  // ── Border radius ─────────────────────────────────────────────────────────
  static const double radiusSm = 10.0;
  static const double radiusMd = 14.0;
  static const double radiusLg = 20.0;
  static const double radiusXl = 28.0;
  static const double radiusFull = 999.0;

  // ── Vertical gaps ─────────────────────────────────────────────────────────
  static const SizedBox gapXs = SizedBox(height: xs);
  static const SizedBox gapSm = SizedBox(height: sm);
  static const SizedBox gapMd = SizedBox(height: md);
  static const SizedBox gapLg = SizedBox(height: lg);
  static const SizedBox gapXl = SizedBox(height: xl);
  static const SizedBox gapXxl = SizedBox(height: xxl);

  // ── Card padding aliases ──────────────────────────────────────────────────
  static const EdgeInsets cardPaddingLarge = cardPaddingLg;

  // ── Box shadows ─────────────────────────────────────────────────────────
  static const List<BoxShadow> shadowSm = [
    BoxShadow(color: Color(0x120F172A), blurRadius: 14, offset: Offset(0, 4)),
  ];

  static const List<BoxShadow> shadowLg = [
    BoxShadow(color: Color(0x140F172A), blurRadius: 28, offset: Offset(0, 14)),
    BoxShadow(color: Color(0x080F172A), blurRadius: 6, offset: Offset(0, 2)),
  ];

  // ── Horizontal gaps ───────────────────────────────────────────────────────
  static const SizedBox hGapXs = SizedBox(width: xs);
  static const SizedBox hGapSm = SizedBox(width: sm);
  static const SizedBox hGapMd = SizedBox(width: md);
  static const SizedBox hGapLg = SizedBox(width: lg);

  // ── Animation durations ─────────────────────────────────────────────────
  static const Duration animFast = Duration(milliseconds: 180);
  static const Duration animNormal = Duration(milliseconds: 280);
  static const Duration animSlow = Duration(milliseconds: 420);
  static const Duration animPageTransition = Duration(milliseconds: 320);

  // ── Elevation shadows (multi-layer for depth) ──────────────────────────
  static const List<BoxShadow> shadowMd = [
    BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x080F172A), blurRadius: 3, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> shadowXl = [
    BoxShadow(color: Color(0x140F172A), blurRadius: 20, offset: Offset(0, 10)),
    BoxShadow(color: Color(0x0A0F172A), blurRadius: 56, offset: Offset(0, 22)),
  ];

  // ── Max content width for web ──────────────────────────────────────────
  static const double maxContentWidth = 600;
  static const double maxAuthWidth = 440;
}
