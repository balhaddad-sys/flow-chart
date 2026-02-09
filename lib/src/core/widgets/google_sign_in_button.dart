import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';

/// A Google "G" logo painted to match official branding.
class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double s = size.width;

    // Blue quadrant (right)
    final bluePaint = Paint()..color = const Color(0xFF4285F4);
    final bluePath = Path()
      ..moveTo(s * 0.964, s * 0.480)
      ..cubicTo(s * 0.964, s * 0.442, s * 0.960, s * 0.406, s * 0.954, s * 0.370)
      ..lineTo(s * 0.500, s * 0.370)
      ..lineTo(s * 0.500, s * 0.580)
      ..lineTo(s * 0.762, s * 0.580)
      ..cubicTo(s * 0.750, s * 0.640, s * 0.714, s * 0.690, s * 0.662, s * 0.722)
      ..lineTo(s * 0.662, s * 0.850)
      ..lineTo(s * 0.820, s * 0.850)
      ..cubicTo(s * 0.914, s * 0.764, s * 0.964, s * 0.634, s * 0.964, s * 0.480)
      ..close();
    canvas.drawPath(bluePath, bluePaint);

    // Green quadrant (bottom-left)
    final greenPaint = Paint()..color = const Color(0xFF34A853);
    final greenPath = Path()
      ..moveTo(s * 0.500, s * 0.940)
      ..cubicTo(s * 0.630, s * 0.940, s * 0.742, s * 0.896, s * 0.820, s * 0.850)
      ..lineTo(s * 0.662, s * 0.722)
      ..cubicTo(s * 0.622, s * 0.748, s * 0.566, s * 0.764, s * 0.500, s * 0.764)
      ..cubicTo(s * 0.374, s * 0.764, s * 0.266, s * 0.684, s * 0.226, s * 0.574)
      ..lineTo(s * 0.064, s * 0.574)
      ..lineTo(s * 0.064, s * 0.706)
      ..cubicTo(s * 0.142, s * 0.860, s * 0.310, s * 0.940, s * 0.500, s * 0.940)
      ..close();
    canvas.drawPath(greenPath, greenPaint);

    // Yellow quadrant (bottom-right area)
    final yellowPaint = Paint()..color = const Color(0xFFFBBC05);
    final yellowPath = Path()
      ..moveTo(s * 0.226, s * 0.574)
      ..cubicTo(s * 0.214, s * 0.540, s * 0.208, s * 0.502, s * 0.208, s * 0.464)
      ..cubicTo(s * 0.208, s * 0.426, s * 0.214, s * 0.388, s * 0.226, s * 0.354)
      ..lineTo(s * 0.226, s * 0.354)
      ..lineTo(s * 0.064, s * 0.354)
      ..lineTo(s * 0.064, s * 0.222)
      ..cubicTo(s * 0.024, s * 0.302, s * 0.000, s * 0.392, s * 0.000, s * 0.480)
      ..cubicTo(s * 0.000, s * 0.568, s * 0.024, s * 0.658, s * 0.064, s * 0.706)
      ..lineTo(s * 0.226, s * 0.574)
      ..close();
    canvas.drawPath(yellowPath, yellowPaint);

    // Red quadrant (top-left)
    final redPaint = Paint()..color = const Color(0xFFEA4335);
    final redPath = Path()
      ..moveTo(s * 0.500, s * 0.196)
      ..cubicTo(s * 0.572, s * 0.196, s * 0.636, s * 0.222, s * 0.686, s * 0.270)
      ..lineTo(s * 0.822, s * 0.136)
      ..cubicTo(s * 0.742, s * 0.060, s * 0.630, s * 0.012, s * 0.500, s * 0.012)
      ..cubicTo(s * 0.310, s * 0.012, s * 0.142, s * 0.092, s * 0.064, s * 0.222)
      ..lineTo(s * 0.226, s * 0.354)
      ..cubicTo(s * 0.266, s * 0.244, s * 0.374, s * 0.196, s * 0.500, s * 0.196)
      ..close();
    canvas.drawPath(redPath, redPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Branded Google Sign-In button following Google's sign-in branding guidelines.
class GoogleSignInButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool isLoading;
  final String label;

  const GoogleSignInButton({
    super.key,
    this.onPressed,
    this.isLoading = false,
    this.label = 'Sign in with Google',
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: isDark ? const Color(0xFF131314) : Colors.white,
          foregroundColor: isDark ? const Color(0xFFE3E3E3) : const Color(0xFF1F1F1F),
          side: BorderSide(
            color: isDark ? const Color(0xFF8E918F) : const Color(0xFF747775),
            width: 1,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
          elevation: 0,
        ),
        child: isLoading
            ? SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CustomPaint(painter: _GoogleLogoPainter()),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: isDark ? const Color(0xFFE3E3E3) : const Color(0xFF1F1F1F),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
