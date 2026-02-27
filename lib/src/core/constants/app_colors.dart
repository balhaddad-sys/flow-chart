import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Core brand palette: deep teal + clinical blue for a cleaner, more
  // professional visual system across mobile.
  static const Color primary = Color(0xFF0F766E);
  static const Color primaryLight = Color(0xFF14B8A6);
  static const Color primaryDark = Color(0xFF115E59);
  static const Color primarySubtle = Color(0xFFE8F7F5);

  static const Color secondary = Color(0xFF2563EB);
  static const Color secondaryLight = Color(0xFF60A5FA);
  static const Color secondarySubtle = Color(0xFFEFF6FF);

  static const Color accent = Color(0xFF0891B2);
  static const Color accentLight = Color(0xFF67E8F9);
  static const Color accentSubtle = Color(0xFFECFEFF);

  static const Color success = Color(0xFF059669);
  static const Color successLight = Color(0xFFD1FAE5);
  static const Color warning = Color(0xFFB45309);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF0284C7);
  static const Color infoLight = Color(0xFFE0F2FE);

  // Light surfaces: cool neutrals instead of warm stone.
  static const Color background = Color(0xFFF3F7F8);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFEAF0F2);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textTertiary = Color(0xFF94A3B8);
  static const Color textOnPrimary = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFD8E4E8);
  static const Color borderLight = Color(0xFFEAF0F2);
  static const Color divider = Color(0xFFD8E4E8);

  // Dark surfaces: desaturated navy for better contrast and less visual noise.
  static const Color darkBackground = Color(0xFF08131D);
  static const Color darkSurface = Color(0xFF0F1E2A);
  static const Color darkSurfaceVariant = Color(0xFF142838);
  static const Color darkSurfaceElevated = Color(0xFF183243);
  static const Color darkTextPrimary = Color(0xFFF8FAFC);
  static const Color darkTextSecondary = Color(0xFFB6C6D2);
  static const Color darkTextTertiary = Color(0xFF7A91A6);
  static const Color darkBorder = Color(0xFF203546);
  static const Color darkDivider = Color(0xFF1B2C3A);

  static const Color taskTodo = Color(0xFF94A3B8);
  static const Color taskInProgress = primary;
  static const Color taskDone = success;
  static const Color taskSkipped = warning;

  static const Color difficultyEasy = success;
  static const Color difficultyMedium = warning;
  static const Color difficultyHard = error;

  static const Color primarySurface = primarySubtle;
  static const Color secondarySurface = secondarySubtle;
  static const Color accentSurface = accentSubtle;
  static const Color successSurface = successLight;
  static const Color warningSurface = warningLight;
  static const Color errorSurface = errorLight;
  static const Color infoSurface = infoLight;

  static const Color navBarBackground = surface;
  static const Color navBarDarkBackground = darkSurface;
  static const Color navBarInactive = textSecondary;

  static const Color teal50 = Color(0xFFF0FDFA);
  static const Color teal100 = Color(0xFFCCFBF1);
  static const Color teal200 = Color(0xFF99F6E4);
  static const Color teal300 = Color(0xFF5EEAD4);
  static const Color teal400 = Color(0xFF2DD4BF);
  static const Color teal500 = Color(0xFF14B8A6);
  static const Color teal600 = Color(0xFF0F766E);
  static const Color teal700 = Color(0xFF115E59);
  static const Color teal800 = Color(0xFF134E4A);
  static const Color teal900 = Color(0xFF042F2E);

  // Legacy aliases preserved for compatibility with existing widgets.
  static const Color purple = secondary;
  static const Color purpleBg = Color(0x142563EB);
  static const Color successBg = Color(0x14059669);
  static const Color errorBg = Color(0x14DC2626);
  static const Color warningBg = Color(0x14B45309);
  static const Color infoBg = Color(0x140284C7);

  static const primaryGradientShadow = [
    BoxShadow(color: Color(0x3314B8A6), blurRadius: 20, offset: Offset(0, 8)),
    BoxShadow(color: Color(0x1F2563EB), blurRadius: 36, offset: Offset(0, 16)),
  ];

  static LinearGradient headerGradient(bool isDark) => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors:
        isDark
            ? [const Color(0xFF112736), const Color(0xFF0D1D29), darkBackground]
            : [const Color(0xFFE9F8F6), const Color(0xFFEFF6FF), background],
  );

  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0F766E), Color(0xFF0284C7)],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2563EB), Color(0xFF0891B2)],
  );

  static const LinearGradient urgentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFF59E0B)],
  );

  static const LinearGradient darkHeroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF163041), Color(0xFF08131D)],
  );

  static const LinearGradient authGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF7FBFC), Color(0xFFE8F7F5), Color(0xFFEFF6FF)],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0F766E), Color(0xFF14B8A6), Color(0xFF0284C7)],
    stops: [0.0, 0.45, 1.0],
  );

  static const LinearGradient subtleGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFF9FCFD), Color(0xFFF3F7F8)],
  );
}
