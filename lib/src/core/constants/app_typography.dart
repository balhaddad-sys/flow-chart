import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTypography {
  AppTypography._();

  /// Distinct mobile typography: Sora for hierarchy, Manrope for readable
  /// dense study content.
  static TextTheme get textTheme => TextTheme(
    displayLarge: GoogleFonts.sora(
      fontSize: 36,
      fontWeight: FontWeight.w800,
      letterSpacing: -1.1,
      height: 1.08,
    ),
    displayMedium: GoogleFonts.sora(
      fontSize: 30,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.9,
      height: 1.12,
    ),
    headlineLarge: GoogleFonts.sora(
      fontSize: 26,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.7,
      height: 1.18,
    ),
    headlineMedium: GoogleFonts.sora(
      fontSize: 22,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.5,
      height: 1.22,
    ),
    titleLarge: GoogleFonts.sora(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.35,
      height: 1.26,
    ),
    titleMedium: GoogleFonts.sora(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.15,
      height: 1.3,
    ),
    titleSmall: GoogleFonts.sora(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.05,
      height: 1.35,
    ),
    bodyLarge: GoogleFonts.manrope(
      fontSize: 16,
      fontWeight: FontWeight.w500,
      height: 1.55,
    ),
    bodyMedium: GoogleFonts.manrope(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      height: 1.52,
    ),
    bodySmall: GoogleFonts.manrope(
      fontSize: 12,
      fontWeight: FontWeight.w500,
      height: 1.45,
    ),
    labelLarge: GoogleFonts.manrope(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.15,
      height: 1.3,
    ),
    labelMedium: GoogleFonts.manrope(
      fontSize: 12,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.2,
      height: 1.28,
    ),
    labelSmall: GoogleFonts.manrope(
      fontSize: 11,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.35,
      height: 1.24,
    ),
  );
}
