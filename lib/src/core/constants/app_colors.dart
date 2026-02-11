import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Primary palette ─────────────────────────────────────────────────────────
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFF60A5FA);
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color primarySubtle = Color(0xFFEFF6FF);

  // ── Secondary palette ───────────────────────────────────────────────────────
  static const Color secondary = Color(0xFF7C3AED);
  static const Color secondaryLight = Color(0xFFA78BFA);
  static const Color secondarySubtle = Color(0xFFF5F3FF);

  // ── Accent / teal (medical-grade trust color) ───────────────────────────────
  static const Color accent = Color(0xFF0D9488);
  static const Color accentLight = Color(0xFF5EEAD4);
  static const Color accentSubtle = Color(0xFFF0FDFA);

  // ── Semantic colors ─────────────────────────────────────────────────────────
  static const Color success = Color(0xFF059669);
  static const Color successLight = Color(0xFFD1FAE5);
  static const Color warning = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF2563EB);
  static const Color infoLight = Color(0xFFDBEAFE);

  // ── Light neutral palette ───────────────────────────────────────────────────
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF1F5F9);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textTertiary = Color(0xFF94A3B8);
  static const Color textOnPrimary = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE2E8F0);
  static const Color borderLight = Color(0xFFF1F5F9);
  static const Color divider = Color(0xFFE2E8F0);

  // ── Dark neutral palette ────────────────────────────────────────────────────
  static const Color darkBackground = Color(0xFF0B1120);
  static const Color darkSurface = Color(0xFF111827);
  static const Color darkSurfaceVariant = Color(0xFF1E293B);
  static const Color darkSurfaceElevated = Color(0xFF1E293B);
  static const Color darkTextPrimary = Color(0xFFF1F5F9);
  static const Color darkTextSecondary = Color(0xFF94A3B8);
  static const Color darkTextTertiary = Color(0xFF64748B);
  static const Color darkBorder = Color(0xFF334155);
  static const Color darkDivider = Color(0xFF1E293B);

  // ── Task status colors ──────────────────────────────────────────────────────
  static const Color taskTodo = Color(0xFF94A3B8);
  static const Color taskInProgress = Color(0xFF2563EB);
  static const Color taskDone = Color(0xFF059669);
  static const Color taskSkipped = Color(0xFFD97706);

  // ── Difficulty colors ───────────────────────────────────────────────────────
  static const Color difficultyEasy = Color(0xFF059669);
  static const Color difficultyMedium = Color(0xFFD97706);
  static const Color difficultyHard = Color(0xFFDC2626);

  // ── Surface aliases (used by onboarding, study session, etc.) ────────────
  static const Color primarySurface = primarySubtle;
  static const Color secondarySurface = secondarySubtle;
  static const Color accentSurface = accentSubtle;
  static const Color successSurface = successLight;
  static const Color warningSurface = warningLight;
  static const Color errorSurface = errorLight;
  static const Color infoSurface = infoLight;

  // ── Gradients ───────────────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0D9488), Color(0xFF2563EB)],
  );

  static const LinearGradient urgentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFD97706)],
  );

  static const LinearGradient darkHeroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF1E293B), Color(0xFF0B1120)],
  );
}
