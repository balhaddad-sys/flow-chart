// FILE: lib/src/features/auth/widgets/auth_layout.dart
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// Full-screen auth layout wrapper.
///
/// Mobile: single panel with gradient background, centred scroll view,
/// MedQ logo at the top, max width 440.
///
/// Desktop (≥ 1024 px): left marketing panel + right form panel.
class AuthLayout extends StatelessWidget {
  final Widget child;

  const AuthLayout({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 1024;

        if (!isDesktop) {
          return _MobilePanel(child: child);
        }

        final leftWidth = math.min(constraints.maxWidth * 0.46, 560.0);

        return Row(
          children: [
            SizedBox(width: leftWidth, child: const _DesktopLeftPanel()),
            Expanded(child: _DesktopRightPanel(child: child)),
          ],
        );
      },
    );
  }
}

// ─── Mobile panel ────────────────────────────────────────────────────────────

class _MobilePanel extends StatelessWidget {
  final Widget child;
  const _MobilePanel({required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Stack(
      children: [
        Positioned.fill(child: _DecorativeBackground(isDark: isDark)),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: AppSpacing.maxAuthWidth,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _BrandWordmark(centered: true),
                    const SizedBox(height: 16),
                    Text(
                      'Focused medical study, without the clutter.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color:
                            isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    _SurfaceCard(child: child),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Desktop right panel ─────────────────────────────────────────────────────

class _DesktopRightPanel extends StatelessWidget {
  final Widget child;
  const _DesktopRightPanel({required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Stack(
      children: [
        Positioned.fill(child: _DecorativeBackground(isDark: isDark)),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(32, 24, 32, 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: AppSpacing.maxAuthWidth,
                ),
                child: _SurfaceCard(child: child),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Desktop left panel ──────────────────────────────────────────────────────

class _DesktopLeftPanel extends StatelessWidget {
  const _DesktopLeftPanel();

  static const _highlights = [
    (
      icon: Icons.menu_book_rounded,
      text: 'Upload and analyze study materials in seconds',
    ),
    (
      icon: Icons.psychology_alt_rounded,
      text: 'AI-generated quizzes calibrated to your level',
    ),
    (
      icon: Icons.track_changes_rounded,
      text: 'Adaptive assessment to find your weak spots',
    ),
    (
      icon: Icons.auto_awesome_rounded,
      text: 'Smart study plans built around your schedule',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Stack(
      children: [
        Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              gradient:
                  isDark
                      ? AppColors.darkHeroGradient
                      : AppColors.headerGradient(false),
            ),
          ),
        ),
        Positioned(
          top: -90,
          right: -40,
          child: _GlowOrb(
            size: 240,
            color: AppColors.accent.withValues(alpha: isDark ? 0.18 : 0.14),
          ),
        ),
        Positioned(
          bottom: 80,
          left: -60,
          child: _GlowOrb(
            size: 220,
            color: AppColors.primary.withValues(alpha: isDark ? 0.18 : 0.12),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(40, 36, 40, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _BrandWordmark(centered: false),
                const Spacer(),
                Text(
                  'A calmer, sharper workflow for high-stakes medical revision.',
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color:
                        isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Keep your materials, plan, quizzes, analytics, and AI help in one focused study system.',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color:
                        isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 28),
                ..._highlights.map(
                  (h) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color:
                            isDark
                                ? AppColors.darkSurface.withValues(alpha: 0.62)
                                : Colors.white.withValues(alpha: 0.72),
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusLg,
                        ),
                        border: Border.all(
                          color:
                              isDark ? AppColors.darkBorder : AppColors.border,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              gradient: AppColors.primaryGradient,
                              borderRadius: BorderRadius.circular(
                                AppSpacing.radiusMd,
                              ),
                            ),
                            child: Icon(h.icon, size: 20, color: Colors.white),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              h.text,
                              style: Theme.of(
                                context,
                              ).textTheme.bodyMedium?.copyWith(
                                color:
                                    isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  '© ${DateTime.now().year} MedQ. All rights reserved.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color:
                        isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  final Widget child;

  const _SurfaceCard({required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors:
              isDark
                  ? [
                    AppColors.darkSurfaceElevated.withValues(alpha: 0.96),
                    AppColors.darkSurface.withValues(alpha: 0.92),
                  ]
                  : [
                    Colors.white.withValues(alpha: 0.96),
                    const Color(0xFFFDFEFF),
                  ],
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(
          color:
              isDark
                  ? AppColors.darkBorder.withValues(alpha: 0.95)
                  : AppColors.border.withValues(alpha: 0.85),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowXl,
      ),
      child: child,
    );
  }
}

class _DecorativeBackground extends StatelessWidget {
  final bool isDark;

  const _DecorativeBackground({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: isDark ? AppColors.darkHeroGradient : AppColors.authGradient,
      ),
      child: Stack(
        children: [
          Positioned(
            top: -90,
            right: -20,
            child: _GlowOrb(
              size: 220,
              color: AppColors.accent.withValues(alpha: isDark ? 0.16 : 0.10),
            ),
          ),
          Positioned(
            top: 180,
            left: -70,
            child: _GlowOrb(
              size: 200,
              color: AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.08),
            ),
          ),
          Positioned(
            bottom: -80,
            right: 30,
            child: _GlowOrb(
              size: 240,
              color: AppColors.secondary.withValues(
                alpha: isDark ? 0.12 : 0.07,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  final double size;
  final Color color;

  const _GlowOrb({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}

// ─── Brand wordmark ──────────────────────────────────────────────────────────

class _BrandWordmark extends StatelessWidget {
  final bool centered;
  const _BrandWordmark({required this.centered});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment:
          centered ? MainAxisAlignment.center : MainAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: AppColors.primaryGradientShadow,
          ),
          child: const Icon(
            Icons.school_rounded,
            color: Colors.white,
            size: 26,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          'MedQ',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 24,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }
}
