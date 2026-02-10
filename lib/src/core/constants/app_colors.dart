import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ─── Primary palette ───────────────────────────────────────────
  static const Color primary = Color(0xFF1A56DB);
  static const Color primaryLight = Color(0xFF3B82F6);
  static const Color primaryDark = Color(0xFF1E40AF);
  static const Color primarySurface = Color(0xFFEFF6FF);

  // ─── Secondary palette ─────────────────────────────────────────
  static const Color secondary = Color(0xFF7C3AED);
  static const Color secondaryLight = Color(0xFFA78BFA);
  static const Color secondarySurface = Color(0xFFF5F3FF);

  // ─── Accent / Brand ────────────────────────────────────────────
  static const Color accent = Color(0xFF0EA5E9);
  static const Color accentSurface = Color(0xFFF0F9FF);

  // ─── Semantic colors ───────────────────────────────────────────
  static const Color success = Color(0xFF059669);
  static const Color successLight = Color(0xFF34D399);
  static const Color successSurface = Color(0xFFECFDF5);

  static const Color warning = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFBBF24);
  static const Color warningSurface = Color(0xFFFFFBEB);

  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFF87171);
  static const Color errorSurface = Color(0xFFFEF2F2);

  static const Color info = Color(0xFF2563EB);
  static const Color infoSurface = Color(0xFFEFF6FF);

  // ─── Neutral palette ───────────────────────────────────────────
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
  static const Color divider = Color(0xFFF1F5F9);

  // ─── Gradient definitions ──────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1A56DB), Color(0xFF7C3AED)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0EA5E9), Color(0xFF3B82F6)],
  );

  static const LinearGradient warmGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFD97706)],
  );

  static const LinearGradient surfaceGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFFFFFF), Color(0xFFF8FAFC)],
  );

  // ─── Shadow colors ─────────────────────────────────────────────
  static const Color shadowLight = Color(0x0A000000);
  static const Color shadowMedium = Color(0x14000000);
  static const Color shadowHeavy = Color(0x1F000000);

  // ─── Task status colors ────────────────────────────────────────
  static const Color taskTodo = Color(0xFF94A3B8);
  static const Color taskInProgress = Color(0xFF3B82F6);
  static const Color taskDone = Color(0xFF059669);
  static const Color taskSkipped = Color(0xFFD97706);

  // ─── Difficulty colors ─────────────────────────────────────────
  static const Color difficultyEasy = Color(0xFF059669);
  static const Color difficultyMedium = Color(0xFFD97706);
  static const Color difficultyHard = Color(0xFFDC2626);
}
