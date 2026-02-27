import 'dart:math' as math;
import 'package:flutter/material.dart';

// ─── MedQ Icon Widget ────────────────────────────────────────────────────────
// Renders stroke-based vector icons using CustomPaint.
// All icons are drawn in a 24×24 coordinate space with 1.8px stroke by default.

class MedQIcon extends StatelessWidget {
  final MedQIconData icon;
  final double size;
  final Color? color;

  const MedQIcon(
    this.icon, {
    super.key,
    this.size = 20,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final iconColor = color ??
        (Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFFA8A29E)
            : const Color(0xFF57534E));
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _MedQIconPainter(icon: icon, color: iconColor),
      ),
    );
  }
}

// ─── Icon Data ───────────────────────────────────────────────────────────────

typedef MedQIconData = void Function(Canvas canvas, double s, Paint paint);

class MedQIcons {
  MedQIcons._();

  // ── Medical ──

  static void stethoscope(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Left tube
    final path1 = Path()
      ..moveTo(4.8 * sc, 2.5 * sc)
      ..cubicTo(3.8 * sc, 2.5 * sc, 3 * sc, 3.4 * sc, 3 * sc, 4.5 * sc)
      ..lineTo(3 * sc, 9.5 * sc);
    c.drawPath(path1, p);
    // Right tube
    final path2 = Path()
      ..moveTo(8 * sc, 2.5 * sc)
      ..cubicTo(9 * sc, 2.5 * sc, 10 * sc, 3.4 * sc, 10 * sc, 4.5 * sc)
      ..lineTo(10 * sc, 9.5 * sc);
    c.drawPath(path2, p);
    // Bottom arc (chest piece connection)
    final path3 = Path()
      ..moveTo(3 * sc, 9.5 * sc)
      ..arcToPoint(
        Offset(10 * sc, 9.5 * sc),
        radius: Radius.circular(3.5 * sc),
        clockwise: false,
      );
    c.drawPath(path3, p);
    // Tube going down to earpiece
    final path4 = Path()
      ..moveTo(10 * sc, 12 * sc)
      ..lineTo(10 * sc, 14 * sc)
      ..cubicTo(10 * sc, 17 * sc, 13 * sc, 19 * sc, 15 * sc, 19 * sc)
      ..cubicTo(17 * sc, 19 * sc, 19 * sc, 17 * sc, 19 * sc, 14 * sc)
      ..lineTo(19 * sc, 9.5 * sc);
    c.drawPath(path4, p);
    // Earpiece circle
    c.drawCircle(Offset(19 * sc, 7 * sc), 2.5 * sc, p);
  }

  static void brain(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Left hemisphere
    final left = Path()
      ..moveTo(12 * sc, 4 * sc)
      ..cubicTo(10 * sc, 2 * sc, 7 * sc, 2 * sc, 6 * sc, 4 * sc)
      ..cubicTo(4.5 * sc, 4 * sc, 3 * sc, 6 * sc, 3.5 * sc, 8 * sc)
      ..cubicTo(2.5 * sc, 9 * sc, 2 * sc, 11 * sc, 3.5 * sc, 13 * sc)
      ..cubicTo(3 * sc, 15 * sc, 4 * sc, 17 * sc, 6 * sc, 18 * sc)
      ..cubicTo(8 * sc, 19.5 * sc, 10 * sc, 20 * sc, 12 * sc, 20 * sc);
    c.drawPath(left, p);
    // Right hemisphere
    final right = Path()
      ..moveTo(12 * sc, 4 * sc)
      ..cubicTo(14 * sc, 2 * sc, 17 * sc, 2 * sc, 18 * sc, 4 * sc)
      ..cubicTo(19.5 * sc, 4 * sc, 21 * sc, 6 * sc, 20.5 * sc, 8 * sc)
      ..cubicTo(21.5 * sc, 9 * sc, 22 * sc, 11 * sc, 20.5 * sc, 13 * sc)
      ..cubicTo(21 * sc, 15 * sc, 20 * sc, 17 * sc, 18 * sc, 18 * sc)
      ..cubicTo(16 * sc, 19.5 * sc, 14 * sc, 20 * sc, 12 * sc, 20 * sc);
    c.drawPath(right, p);
    // Center line
    c.drawLine(Offset(12 * sc, 4 * sc), Offset(12 * sc, 20 * sc), p);
    // Folds
    final fold1 = Path()
      ..moveTo(5 * sc, 8 * sc)
      ..cubicTo(7 * sc, 8.5 * sc, 9 * sc, 7.5 * sc, 12 * sc, 8 * sc);
    c.drawPath(fold1, p..strokeWidth = 1.2 * sc);
    final fold2 = Path()
      ..moveTo(12 * sc, 12 * sc)
      ..cubicTo(15 * sc, 11.5 * sc, 17 * sc, 12.5 * sc, 19 * sc, 12 * sc);
    c.drawPath(fold2, p);
    p.strokeWidth = 1.8 * sc;
  }

  static void pulse(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 2 * sc;
    final path = Path()
      ..moveTo(2 * sc, 12 * sc)
      ..lineTo(6 * sc, 12 * sc)
      ..lineTo(9 * sc, 3 * sc)
      ..lineTo(15 * sc, 21 * sc)
      ..lineTo(18 * sc, 12 * sc)
      ..lineTo(22 * sc, 12 * sc);
    c.drawPath(path, p);
  }

  // ── Navigation ──

  static void home(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Roof
    final roof = Path()
      ..moveTo(3 * sc, 12 * sc)
      ..lineTo(12 * sc, 3 * sc)
      ..lineTo(21 * sc, 12 * sc);
    c.drawPath(roof, p);
    // House body
    final body = Path()
      ..moveTo(5 * sc, 10 * sc)
      ..lineTo(5 * sc, 20 * sc)
      ..cubicTo(5 * sc, 20.5 * sc, 5.5 * sc, 21 * sc, 6 * sc, 21 * sc)
      ..lineTo(9 * sc, 21 * sc)
      ..lineTo(9 * sc, 15 * sc)
      ..cubicTo(9 * sc, 14.5 * sc, 9.5 * sc, 14 * sc, 10 * sc, 14 * sc)
      ..lineTo(14 * sc, 14 * sc)
      ..cubicTo(14.5 * sc, 14 * sc, 15 * sc, 14.5 * sc, 15 * sc, 15 * sc)
      ..lineTo(15 * sc, 21 * sc)
      ..lineTo(18 * sc, 21 * sc)
      ..cubicTo(18.5 * sc, 21 * sc, 19 * sc, 20.5 * sc, 19 * sc, 20 * sc)
      ..lineTo(19 * sc, 10 * sc);
    c.drawPath(body, p);
  }

  static void library(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Book shape
    final book = Path()
      ..moveTo(4 * sc, 19.5 * sc)
      ..lineTo(4 * sc, 4.5 * sc)
      ..cubicTo(4 * sc, 3.1 * sc, 5.1 * sc, 2 * sc, 6.5 * sc, 2 * sc)
      ..lineTo(20 * sc, 2 * sc)
      ..lineTo(20 * sc, 22 * sc)
      ..lineTo(6.5 * sc, 22 * sc)
      ..cubicTo(5.1 * sc, 22 * sc, 4 * sc, 20.9 * sc, 4 * sc, 19.5 * sc)
      ..close();
    c.drawPath(book, p);
    // Spine highlight
    c.drawLine(Offset(4 * sc, 19.5 * sc), Offset(20 * sc, 19.5 * sc),
        p..strokeWidth = 1 * sc);
    p.strokeWidth = 1.8 * sc;
  }

  static void quiz(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Checkmark
    final check = Path()
      ..moveTo(9 * sc, 11 * sc)
      ..lineTo(12 * sc, 14 * sc)
      ..lineTo(22 * sc, 4 * sc);
    c.drawPath(check, p);
    // Box
    final box = Path()
      ..moveTo(21 * sc, 12 * sc)
      ..lineTo(21 * sc, 19 * sc)
      ..cubicTo(21 * sc, 20.1 * sc, 20.1 * sc, 21 * sc, 19 * sc, 21 * sc)
      ..lineTo(5 * sc, 21 * sc)
      ..cubicTo(3.9 * sc, 21 * sc, 3 * sc, 20.1 * sc, 3 * sc, 19 * sc)
      ..lineTo(3 * sc, 5 * sc)
      ..cubicTo(3 * sc, 3.9 * sc, 3.9 * sc, 3 * sc, 5 * sc, 3 * sc)
      ..lineTo(16 * sc, 3 * sc);
    c.drawPath(box, p);
  }

  static void ai(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Star shape
    final star = Path()
      ..moveTo(12 * sc, 2 * sc)
      ..lineTo(14.4 * sc, 9.2 * sc)
      ..lineTo(22 * sc, 9.2 * sc)
      ..lineTo(16 * sc, 14 * sc)
      ..lineTo(18.4 * sc, 21.2 * sc)
      ..lineTo(12 * sc, 16.4 * sc)
      ..lineTo(5.6 * sc, 21.2 * sc)
      ..lineTo(8 * sc, 14 * sc)
      ..lineTo(2 * sc, 9.2 * sc)
      ..lineTo(9.6 * sc, 9.2 * sc)
      ..close();
    c.drawPath(star, p);
  }

  static void plan(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // 4 rounded squares
    final r = 1 * sc;
    c.drawRRect(
        RRect.fromLTRBR(3 * sc, 3 * sc, 10 * sc, 10 * sc, Radius.circular(r)), p);
    c.drawRRect(
        RRect.fromLTRBR(14 * sc, 3 * sc, 21 * sc, 10 * sc, Radius.circular(r)), p);
    c.drawRRect(
        RRect.fromLTRBR(3 * sc, 14 * sc, 10 * sc, 21 * sc, Radius.circular(r)), p);
    c.drawRRect(
        RRect.fromLTRBR(14 * sc, 14 * sc, 21 * sc, 21 * sc, Radius.circular(r)), p);
  }

  // ── Actions ──

  static void sparkles(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Large sparkle
    final big = Path()
      ..moveTo(12 * sc, 3 * sc)
      ..lineTo(13.5 * sc, 7.5 * sc)
      ..lineTo(18 * sc, 9 * sc)
      ..lineTo(13.5 * sc, 10.5 * sc)
      ..lineTo(12 * sc, 15 * sc)
      ..lineTo(10.5 * sc, 10.5 * sc)
      ..lineTo(6 * sc, 9 * sc)
      ..lineTo(10.5 * sc, 7.5 * sc)
      ..close();
    c.drawPath(big, p);
    // Small sparkle
    final small = Path()
      ..moveTo(18 * sc, 14 * sc)
      ..lineTo(18.75 * sc, 16.25 * sc)
      ..lineTo(21 * sc, 17 * sc)
      ..lineTo(18.75 * sc, 17.75 * sc)
      ..lineTo(18 * sc, 20 * sc)
      ..lineTo(17.25 * sc, 17.75 * sc)
      ..lineTo(15 * sc, 17 * sc)
      ..lineTo(17.25 * sc, 16.25 * sc)
      ..close();
    c.drawPath(small, p);
  }

  static void check(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 2.5 * sc;
    final path = Path()
      ..moveTo(5 * sc, 12 * sc)
      ..lineTo(10 * sc, 17 * sc)
      ..lineTo(20 * sc, 7 * sc);
    c.drawPath(path, p);
  }

  static void x(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 2.5 * sc;
    c.drawLine(Offset(18 * sc, 6 * sc), Offset(6 * sc, 18 * sc), p);
    c.drawLine(Offset(6 * sc, 6 * sc), Offset(18 * sc, 18 * sc), p);
  }

  static void checkCircle(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    c.drawCircle(Offset(12 * sc, 12 * sc), 10 * sc, p);
    p.strokeWidth = 2 * sc;
    final check = Path()
      ..moveTo(8 * sc, 12 * sc)
      ..lineTo(11 * sc, 15 * sc)
      ..lineTo(16 * sc, 10 * sc);
    c.drawPath(check, p);
  }

  static void xCircle(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    c.drawCircle(Offset(12 * sc, 12 * sc), 10 * sc, p);
    p.strokeWidth = 2 * sc;
    c.drawLine(Offset(15 * sc, 9 * sc), Offset(9 * sc, 15 * sc), p);
    c.drawLine(Offset(9 * sc, 9 * sc), Offset(15 * sc, 15 * sc), p);
  }

  static void upload(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Base
    final base = Path()
      ..moveTo(21 * sc, 15 * sc)
      ..lineTo(21 * sc, 19 * sc)
      ..cubicTo(21 * sc, 20.1 * sc, 20.1 * sc, 21 * sc, 19 * sc, 21 * sc)
      ..lineTo(5 * sc, 21 * sc)
      ..cubicTo(3.9 * sc, 21 * sc, 3 * sc, 20.1 * sc, 3 * sc, 19 * sc)
      ..lineTo(3 * sc, 15 * sc);
    c.drawPath(base, p);
    // Arrow
    final arrow = Path()
      ..moveTo(17 * sc, 8 * sc)
      ..lineTo(12 * sc, 3 * sc)
      ..lineTo(7 * sc, 8 * sc);
    c.drawPath(arrow, p);
    c.drawLine(Offset(12 * sc, 3 * sc), Offset(12 * sc, 15 * sc), p);
  }

  static void file(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    final outline = Path()
      ..moveTo(14 * sc, 2 * sc)
      ..lineTo(6 * sc, 2 * sc)
      ..cubicTo(4.9 * sc, 2 * sc, 4 * sc, 2.9 * sc, 4 * sc, 4 * sc)
      ..lineTo(4 * sc, 20 * sc)
      ..cubicTo(4 * sc, 21.1 * sc, 4.9 * sc, 22 * sc, 6 * sc, 22 * sc)
      ..lineTo(18 * sc, 22 * sc)
      ..cubicTo(19.1 * sc, 22 * sc, 20 * sc, 21.1 * sc, 20 * sc, 20 * sc)
      ..lineTo(20 * sc, 8 * sc)
      ..close();
    c.drawPath(outline, p);
    // Fold corner
    final fold = Path()
      ..moveTo(14 * sc, 2 * sc)
      ..lineTo(14 * sc, 8 * sc)
      ..lineTo(20 * sc, 8 * sc);
    c.drawPath(fold, p);
    // Lines
    c.drawLine(Offset(8 * sc, 13 * sc), Offset(16 * sc, 13 * sc), p..strokeWidth = 1.4 * sc);
    c.drawLine(Offset(8 * sc, 17 * sc), Offset(16 * sc, 17 * sc), p);
    p.strokeWidth = 1.8 * sc;
  }

  static void search(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    c.drawCircle(Offset(11 * sc, 11 * sc), 8 * sc, p);
    p.strokeWidth = 2.2 * sc;
    c.drawLine(Offset(16.65 * sc, 16.65 * sc), Offset(21 * sc, 21 * sc), p);
  }

  static void swap(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Top arrow
    final top = Path()
      ..moveTo(16 * sc, 3 * sc)
      ..lineTo(20 * sc, 7 * sc)
      ..lineTo(16 * sc, 11 * sc);
    c.drawPath(top, p);
    c.drawLine(Offset(4 * sc, 7 * sc), Offset(20 * sc, 7 * sc), p);
    // Bottom arrow
    final bot = Path()
      ..moveTo(8 * sc, 13 * sc)
      ..lineTo(4 * sc, 17 * sc)
      ..lineTo(8 * sc, 21 * sc);
    c.drawPath(bot, p);
    c.drawLine(Offset(4 * sc, 17 * sc), Offset(20 * sc, 17 * sc), p);
  }

  static void refresh(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Arrow
    final arrow = Path()
      ..moveTo(1 * sc, 4 * sc)
      ..lineTo(1 * sc, 10 * sc)
      ..lineTo(7 * sc, 10 * sc);
    c.drawPath(arrow, p);
    // Draw a circular arc representing refresh
    c.drawArc(
      Rect.fromCircle(center: Offset(12 * sc, 12 * sc), radius: 9 * sc),
      math.pi * 0.75,
      -math.pi * 1.75,
      false,
      p,
    );
  }

  // ── Status ──

  static void trophy(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Cup
    final cup = Path()
      ..moveTo(6 * sc, 2 * sc)
      ..lineTo(18 * sc, 2 * sc)
      ..lineTo(18 * sc, 9 * sc)
      ..cubicTo(18 * sc, 12.3 * sc, 15.3 * sc, 15 * sc, 12 * sc, 15 * sc)
      ..cubicTo(8.7 * sc, 15 * sc, 6 * sc, 12.3 * sc, 6 * sc, 9 * sc)
      ..close();
    c.drawPath(cup, p);
    // Left handle
    final lh = Path()
      ..moveTo(6 * sc, 4 * sc)
      ..lineTo(4.5 * sc, 4 * sc)
      ..cubicTo(3.1 * sc, 4 * sc, 2 * sc, 5.1 * sc, 2 * sc, 6.5 * sc)
      ..cubicTo(2 * sc, 7.9 * sc, 3.1 * sc, 9 * sc, 4.5 * sc, 9 * sc)
      ..lineTo(6 * sc, 9 * sc);
    c.drawPath(lh, p);
    // Right handle
    final rh = Path()
      ..moveTo(18 * sc, 4 * sc)
      ..lineTo(19.5 * sc, 4 * sc)
      ..cubicTo(20.9 * sc, 4 * sc, 22 * sc, 5.1 * sc, 22 * sc, 6.5 * sc)
      ..cubicTo(22 * sc, 7.9 * sc, 20.9 * sc, 9 * sc, 19.5 * sc, 9 * sc)
      ..lineTo(18 * sc, 9 * sc);
    c.drawPath(rh, p);
    // Stem + base
    c.drawLine(Offset(12 * sc, 15 * sc), Offset(12 * sc, 18 * sc), p);
    c.drawLine(Offset(7 * sc, 22 * sc), Offset(17 * sc, 22 * sc), p);
    c.drawLine(Offset(9 * sc, 18 * sc), Offset(15 * sc, 18 * sc), p);
    c.drawLine(Offset(9 * sc, 18 * sc), Offset(7 * sc, 22 * sc), p);
    c.drawLine(Offset(15 * sc, 18 * sc), Offset(17 * sc, 22 * sc), p);
  }

  static void lightning(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    final bolt = Path()
      ..moveTo(13 * sc, 2 * sc)
      ..lineTo(3 * sc, 14 * sc)
      ..lineTo(12 * sc, 14 * sc)
      ..lineTo(11 * sc, 22 * sc)
      ..lineTo(21 * sc, 10 * sc)
      ..lineTo(12 * sc, 10 * sc)
      ..close();
    c.drawPath(bolt, p);
  }

  static void flame(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    final fire = Path()
      ..moveTo(12 * sc, 2 * sc)
      ..cubicTo(12.5 * sc, 4.5 * sc, 14 * sc, 6.9 * sc, 16 * sc, 8.5 * sc)
      ..cubicTo(18 * sc, 10.1 * sc, 19 * sc, 12 * sc, 19 * sc, 14 * sc)
      ..cubicTo(19 * sc, 17.9 * sc, 15.9 * sc, 21 * sc, 12 * sc, 21 * sc)
      ..cubicTo(8.1 * sc, 21 * sc, 5 * sc, 17.9 * sc, 5 * sc, 14 * sc)
      ..cubicTo(5 * sc, 12.8 * sc, 5.5 * sc, 11.5 * sc, 6.5 * sc, 10.5 * sc)
      ..lineTo(7.5 * sc, 11.5 * sc)
      ..cubicTo(8.5 * sc, 12.5 * sc, 8.5 * sc, 14 * sc, 8.5 * sc, 14.5 * sc)
      ..cubicTo(8.5 * sc, 15.9 * sc, 9.6 * sc, 17 * sc, 11 * sc, 17 * sc)
      ..cubicTo(11 * sc, 15 * sc, 11.5 * sc, 14 * sc, 12 * sc, 12 * sc)
      ..cubicTo(10.9 * sc, 9.9 * sc, 12 * sc, 4.5 * sc, 12 * sc, 2 * sc)
      ..close();
    c.drawPath(fire, p);
  }

  static void target(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    c.drawCircle(Offset(12 * sc, 12 * sc), 10 * sc, p);
    c.drawCircle(Offset(12 * sc, 12 * sc), 6 * sc, p);
    c.drawCircle(Offset(12 * sc, 12 * sc), 2 * sc, p);
  }

  static void alert(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Triangle
    final tri = Path()
      ..moveTo(12 * sc, 3 * sc)
      ..lineTo(2 * sc, 19 * sc)
      ..cubicTo(1.5 * sc, 19.9 * sc, 2.2 * sc, 21 * sc, 3.3 * sc, 21 * sc)
      ..lineTo(20.7 * sc, 21 * sc)
      ..cubicTo(21.8 * sc, 21 * sc, 22.5 * sc, 19.9 * sc, 22 * sc, 19 * sc)
      ..close();
    c.drawPath(tri, p);
    // Exclamation
    c.drawLine(Offset(12 * sc, 9 * sc), Offset(12 * sc, 13 * sc), p..strokeWidth = 2 * sc);
    c.drawCircle(Offset(12 * sc, 16.5 * sc), 0.8 * sc, p..style = PaintingStyle.fill);
    p
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8 * sc;
  }

  static void lightbulb(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Bulb
    final bulb = Path()
      ..moveTo(15.09 * sc, 14 * sc)
      ..cubicTo(15.27 * sc, 13 * sc, 15.74 * sc, 12.26 * sc, 16.5 * sc, 11.5 * sc)
      ..cubicTo(17.74 * sc, 10.26 * sc, 18 * sc, 9 * sc, 18 * sc, 8 * sc)
      ..cubicTo(18 * sc, 4.7 * sc, 15.3 * sc, 2 * sc, 12 * sc, 2 * sc)
      ..cubicTo(8.7 * sc, 2 * sc, 6 * sc, 4.7 * sc, 6 * sc, 8 * sc)
      ..cubicTo(6 * sc, 9 * sc, 6.23 * sc, 10.23 * sc, 7.5 * sc, 11.5 * sc)
      ..cubicTo(8.26 * sc, 12.26 * sc, 8.73 * sc, 13 * sc, 8.91 * sc, 14 * sc);
    c.drawPath(bulb, p);
    // Base lines
    c.drawLine(Offset(9 * sc, 18 * sc), Offset(15 * sc, 18 * sc), p);
    c.drawLine(Offset(10 * sc, 22 * sc), Offset(14 * sc, 22 * sc), p);
  }

  static void star(Canvas c, double s, Paint p) {
    final sc = s / 24;
    // Filled star
    final prevStyle = p.style;
    p.style = PaintingStyle.fill;
    final star = Path()
      ..moveTo(12 * sc, 2 * sc)
      ..lineTo(15.09 * sc, 8.26 * sc)
      ..lineTo(22 * sc, 9.27 * sc)
      ..lineTo(17 * sc, 14.14 * sc)
      ..lineTo(18.18 * sc, 21.02 * sc)
      ..lineTo(12 * sc, 17.77 * sc)
      ..lineTo(5.82 * sc, 21.02 * sc)
      ..lineTo(7 * sc, 14.14 * sc)
      ..lineTo(2 * sc, 9.27 * sc)
      ..lineTo(8.91 * sc, 8.26 * sc)
      ..close();
    c.drawPath(star, p);
    p.style = prevStyle;
  }

  static void clock(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    c.drawCircle(Offset(12 * sc, 12 * sc), 10 * sc, p);
    // Hands
    c.drawLine(Offset(12 * sc, 6 * sc), Offset(12 * sc, 12 * sc), p..strokeWidth = 2 * sc);
    c.drawLine(Offset(12 * sc, 12 * sc), Offset(16 * sc, 14 * sc), p);
    p.strokeWidth = 1.8 * sc;
  }

  static void chevronRight(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 2.2 * sc;
    final path = Path()
      ..moveTo(9 * sc, 6 * sc)
      ..lineTo(15 * sc, 12 * sc)
      ..lineTo(9 * sc, 18 * sc);
    c.drawPath(path, p);
  }

  static void book(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    final outline = Path()
      ..moveTo(4 * sc, 19.5 * sc)
      ..lineTo(4 * sc, 4.5 * sc)
      ..cubicTo(4 * sc, 3.1 * sc, 5.1 * sc, 2 * sc, 6.5 * sc, 2 * sc)
      ..lineTo(20 * sc, 2 * sc)
      ..lineTo(20 * sc, 22 * sc)
      ..lineTo(6.5 * sc, 22 * sc)
      ..cubicTo(5.1 * sc, 22 * sc, 4 * sc, 20.9 * sc, 4 * sc, 19.5 * sc);
    c.drawPath(outline, p);
    c.drawLine(Offset(4 * sc, 19.5 * sc), Offset(20 * sc, 19.5 * sc), p..strokeWidth = 1 * sc);
    p.strokeWidth = 1.4 * sc;
    c.drawLine(Offset(8 * sc, 7 * sc), Offset(14 * sc, 7 * sc), p);
    c.drawLine(Offset(8 * sc, 11 * sc), Offset(12 * sc, 11 * sc), p);
    p.strokeWidth = 1.8 * sc;
  }

  static void calendar(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    // Box
    c.drawRRect(
      RRect.fromLTRBR(3 * sc, 4 * sc, 21 * sc, 22 * sc, Radius.circular(2 * sc)),
      p,
    );
    // Top pegs
    c.drawLine(Offset(8 * sc, 2 * sc), Offset(8 * sc, 6 * sc), p..strokeWidth = 2 * sc);
    c.drawLine(Offset(16 * sc, 2 * sc), Offset(16 * sc, 6 * sc), p);
    p.strokeWidth = 1.8 * sc;
    // Divider
    c.drawLine(Offset(3 * sc, 10 * sc), Offset(21 * sc, 10 * sc), p);
    // Dots
    final dotP = Paint()
      ..color = p.color
      ..style = PaintingStyle.fill;
    for (final pos in [
      [8.0, 14.0], [12.0, 14.0], [16.0, 14.0],
      [8.0, 18.0], [12.0, 18.0],
    ]) {
      c.drawCircle(Offset(pos[0] * sc, pos[1] * sc), 1.2 * sc, dotP);
    }
  }

  // ── Theme ──

  static void sun(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    c.drawCircle(Offset(12 * sc, 12 * sc), 5 * sc, p);
    // Rays
    for (final ray in [
      [12.0, 1.0, 12.0, 3.0], [12.0, 21.0, 12.0, 23.0],
      [4.22, 4.22, 5.64, 5.64], [18.36, 18.36, 19.78, 19.78],
      [1.0, 12.0, 3.0, 12.0], [21.0, 12.0, 23.0, 12.0],
      [4.22, 19.78, 5.64, 18.36], [18.36, 5.64, 19.78, 4.22],
    ]) {
      c.drawLine(
        Offset(ray[0] * sc, ray[1] * sc),
        Offset(ray[2] * sc, ray[3] * sc),
        p,
      );
    }
  }

  static void moon(Canvas c, double s, Paint p) {
    final sc = s / 24;
    p.strokeWidth = 1.8 * sc;
    final moon = Path()
      ..moveTo(21 * sc, 12.79 * sc)
      ..cubicTo(20 * sc, 13.26 * sc, 18.9 * sc, 13.5 * sc, 17.73 * sc, 13.5 * sc)
      ..cubicTo(13.03 * sc, 13.5 * sc, 9.2 * sc, 9.67 * sc, 9.2 * sc, 4.97 * sc)
      ..cubicTo(9.2 * sc, 3.8 * sc, 9.44 * sc, 2.7 * sc, 9.91 * sc, 1.7 * sc)
      ..cubicTo(5.44 * sc, 2.7 * sc, 2 * sc, 6.7 * sc, 2 * sc, 11.5 * sc)
      ..cubicTo(2 * sc, 17.3 * sc, 6.7 * sc, 22 * sc, 12.5 * sc, 22 * sc)
      ..cubicTo(17.3 * sc, 22 * sc, 21.3 * sc, 18.56 * sc, 22.3 * sc, 14.09 * sc)
      ..cubicTo(21.89 * sc, 13.71 * sc, 21.46 * sc, 13.28 * sc, 21 * sc, 12.79 * sc)
      ..close();
    c.drawPath(moon, p);
  }
}

// ─── Painter Implementation ──────────────────────────────────────────────────

class _MedQIconPainter extends CustomPainter {
  final MedQIconData icon;
  final Color color;

  _MedQIconPainter({required this.icon, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    icon(canvas, size.width, paint);
  }

  @override
  bool shouldRepaint(_MedQIconPainter old) =>
      old.color != color || old.icon != icon;
}
