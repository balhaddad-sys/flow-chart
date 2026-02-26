import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class AuthLayout extends StatelessWidget {
  final Widget child;

  const AuthLayout({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 1024;

        if (!isDesktop) {
          return _AuthRightPanel(showMobileLogo: true, child: child);
        }

        final leftPanelWidth = math.min(constraints.maxWidth * 0.45, 520.0);

        return Row(
          children: [
            SizedBox(width: leftPanelWidth, child: const _AuthLeftPanel()),
            Expanded(
              child: _AuthRightPanel(showMobileLogo: false, child: child),
            ),
          ],
        );
      },
    );
  }
}

class _AuthRightPanel extends StatelessWidget {
  final Widget child;
  final bool showMobileLogo;

  const _AuthRightPanel({required this.child, required this.showMobileLogo});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      color: isDark ? AppColors.darkBackground : AppColors.background,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: AppSpacing.maxAuthWidth,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (showMobileLogo) ...[
                    const _BrandWordmark(centered: true),
                    const SizedBox(height: 28),
                  ],
                  child,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthLeftPanel extends StatelessWidget {
  const _AuthLeftPanel();

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

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors:
              isDark
                  ? [
                    AppColors.primary.withValues(alpha: 0.24),
                    AppColors.primary.withValues(alpha: 0.12),
                    Colors.transparent,
                  ]
                  : [
                    AppColors.primary.withValues(alpha: 0.12),
                    AppColors.primary.withValues(alpha: 0.06),
                    Colors.transparent,
                  ],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _BrandWordmark(centered: false),
              const Spacer(),
              Text.rich(
                const TextSpan(
                  text: 'Study smarter with ',
                  children: [
                    TextSpan(
                      text: 'AI-powered',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    TextSpan(text: ' medical learning'),
                  ],
                ),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 24),
              ..._highlights.map(
                (highlight) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          highlight.icon,
                          size: 18,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          highlight.text,
                          style: Theme.of(
                            context,
                          ).textTheme.bodyMedium?.copyWith(
                            color:
                                isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
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
    );
  }
}

class _BrandWordmark extends StatelessWidget {
  final bool centered;

  const _BrandWordmark({required this.centered});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment:
          centered ? MainAxisAlignment.center : MainAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            Icons.school_rounded,
            color: AppColors.primary,
            size: 20,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'MedQ',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }
}
