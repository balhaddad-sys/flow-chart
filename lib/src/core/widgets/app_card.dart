import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// A polished card with consistent elevation, optional accent color border,
/// tap feedback, and dark mode support.
///
/// Replaces the pattern of Container + BoxDecoration + Border.all throughout
/// the app with a single, professional component.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? accentColor;
  final VoidCallback? onTap;
  final double borderRadius;
  final bool elevated;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.accentColor,
    this.onTap,
    this.borderRadius = AppSpacing.radiusMd,
    this.elevated = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final decoration = BoxDecoration(
      color: isDark ? AppColors.darkSurface : AppColors.surface,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: isDark
            ? AppColors.darkBorder.withValues(alpha: 0.6)
            : AppColors.border.withValues(alpha: 0.7),
        width: 0.5,
      ),
      boxShadow: elevated && !isDark
          ? [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 2,
                offset: const Offset(0, 1),
              ),
            ]
          : null,
    );

    Widget card = Container(
      decoration: decoration,
      child: accentColor != null
          ? ClipRRect(
              borderRadius: BorderRadius.circular(borderRadius),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(color: accentColor!, width: 3),
                  ),
                ),
                padding: padding ?? AppSpacing.cardPadding,
                child: child,
              ),
            )
          : Padding(
              padding: padding ?? AppSpacing.cardPadding,
              child: child,
            ),
    );

    if (onTap != null) {
      card = Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(borderRadius),
          onTap: onTap,
          child: card,
        ),
      );
    }

    return card;
  }
}

/// Gradient header banner for top of screens.
class GradientHeader extends StatelessWidget {
  final Widget child;
  final List<Color>? colors;
  final EdgeInsetsGeometry? padding;

  const GradientHeader({
    super.key,
    required this.child,
    this.colors,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final gradientColors = colors ??
        (isDark
            ? [
                const Color(0xFF0F2928),
                AppColors.darkBackground,
              ]
            : [
                const Color(0xFFE6FAF8),
                AppColors.background,
              ]);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: gradientColors,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: padding ?? const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: child,
        ),
      ),
    );
  }
}

/// Stats badge used in cards — small rounded pill with icon + text.
class StatBadge extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color? color;

  const StatBadge({
    super.key,
    required this.icon,
    required this.text,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: c),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: c,
            ),
          ),
        ],
      ),
    );
  }
}

/// Section label used throughout the app — "PERFORMANCE", "TODAY'S PLAN", etc.
class SectionLabel extends StatelessWidget {
  final String text;
  final String? actionText;
  final VoidCallback? onAction;

  const SectionLabel({
    super.key,
    required this.text,
    this.actionText,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Text(
          text.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.0,
                fontSize: 11,
              ),
        ),
        const Spacer(),
        if (actionText != null)
          GestureDetector(
            onTap: onAction,
            child: Text(
              actionText!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w500,
                    fontSize: 12,
                  ),
            ),
          ),
      ],
    );
  }
}
