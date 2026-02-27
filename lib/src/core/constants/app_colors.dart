import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Primary palette — teal #0D9488 (exact match from web app globals.css) ──
  static const Color primary = Color(0xFF0D9488);
  static const Color primaryLight = Color(0xFF14B8A6);
  static const Color primaryDark = Color(0xFF0F766E);
  static const Color primarySubtle = Color(0xFFF0FDFA); // accent bg in web

  // ── Secondary palette ───────────────────────────────────────────────────────
  static const Color secondary = Color(0xFF7C3AED);
  static const Color secondaryLight = Color(0xFFA78BFA);
  static const Color secondarySubtle = Color(0xFFF5F3FF);

  // ── Accent ──────────────────────────────────────────────────────────────────
  static const Color accent = Color(0xFF0891B2); // info color in web
  static const Color accentLight = Color(0xFF67E8F9);
  static const Color accentSubtle = Color(0xFFECFEFF);

  // ── Semantic ─────────────────────────────────────────────────────────────────
  static const Color success = Color(0xFF059669);
  static const Color successLight = Color(0xFFD1FAE5);
  static const Color warning = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF0891B2);
  static const Color infoLight = Color(0xFFECFEFF);

  // ── Light neutral palette — warm stone, exact match from web app ─────────────
  static const Color background = Color(0xFFFAFAF9);  // stone-50
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF5F5F4); // stone-100
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFF1C1917);   // stone-900
  static const Color textSecondary = Color(0xFF78716C); // stone-500
  static const Color textTertiary = Color(0xFFA8A29E);  // stone-400
  static const Color textOnPrimary = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE7E5E4);        // stone-200
  static const Color borderLight = Color(0xFFF5F5F4);
  static const Color divider = Color(0xFFE7E5E4);

  // ── Dark neutral palette — exact match from web app ──────────────────────────
  static const Color darkBackground = Color(0xFF0C0A09);  // stone-950
  static const Color darkSurface = Color(0xFF1C1917);     // stone-900
  static const Color darkSurfaceVariant = Color(0xFF292524); // stone-800
  static const Color darkSurfaceElevated = Color(0xFF292524);
  static const Color darkTextPrimary = Color(0xFFFAFAF9);
  static const Color darkTextSecondary = Color(0xFFA8A29E);
  static const Color darkTextTertiary = Color(0xFF78716C);
  static const Color darkBorder = Color(0xFF292524);
  static const Color darkDivider = Color(0xFF292524);

  // ── Task status ──────────────────────────────────────────────────────────────
  static const Color taskTodo = Color(0xFF94A3B8);
  static const Color taskInProgress = Color(0xFF0D9488);
  static const Color taskDone = Color(0xFF059669);
  static const Color taskSkipped = Color(0xFFD97706);

  // ── Difficulty ───────────────────────────────────────────────────────────────
  static const Color difficultyEasy = Color(0xFF059669);
  static const Color difficultyMedium = Color(0xFFD97706);
  static const Color difficultyHard = Color(0xFFDC2626);

  // ── Surface aliases ───────────────────────────────────────────────────────────
  static const Color primarySurface = primarySubtle;
  static const Color secondarySurface = secondarySubtle;
  static const Color accentSurface = accentSubtle;
  static const Color successSurface = successLight;
  static const Color warningSurface = warningLight;
  static const Color errorSurface = errorLight;
  static const Color infoSurface = infoLight;

  // ── Nav bar ───────────────────────────────────────────────────────────────────
  static const Color navBarBackground = Color(0xFFFFFFFF);
  static const Color navBarDarkBackground = Color(0xFF1C1917);
  static const Color navBarInactive = Color(0xFF94A3B8);

  // ── Gradients ─────────────────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0D9488), Color(0xFF0891B2)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0D9488), Color(0xFF059669)],
  );

  static const LinearGradient urgentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFD97706)],
  );

  static const LinearGradient darkHeroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF292524), Color(0xFF0C0A09)],
  );

  static const LinearGradient authGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFFFFFF), Color(0xFFF0FDFA)],
    stops: [0.0, 1.0],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0F766E), Color(0xFF0D9488), Color(0xFF0891B2)],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient subtleGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFF8FAFC), Color(0xFFF0FDFA)],
  );
}
