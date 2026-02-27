// FILE: lib/src/features/home/widgets/streak_graph.dart

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// Streak display card with week grid visualisation.
class StreakGraph extends StatelessWidget {
  final int streakDays;
  final bool isDark;

  const StreakGraph({
    super.key,
    required this.streakDays,
    required this.isDark,
  });

  // Warm orange flame color
  static const Color _flameColor = Color(0xFFF97316);
  static const Color _flameBgLight = Color(0xFFFFF7ED);
  static const Color _flameBgDark = Color(0xFF431407);

  String get _motivationalText {
    if (streakDays >= 7) return 'Amazing consistency! Keep it up';
    if (streakDays >= 3) return 'Great momentum! Keep going';
    return 'Build your streak — study every day';
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    final todayIndex = now.weekday - 1; // 0=Monday, 6=Sunday

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? _flameBgDark.withValues(alpha: 0.50) : _flameBgLight,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark
              ? _flameColor.withValues(alpha: 0.20)
              : _flameColor.withValues(alpha: 0.15),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _flameColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: const Icon(
                  Icons.local_fire_department_rounded,
                  color: _flameColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$streakDays day streak',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? const Color(0xFFFED7AA)
                                : const Color(0xFF9A3412),
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _motivationalText,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? const Color(0xFFFDBA74).withValues(alpha: 0.80)
                                : const Color(0xFFC2410C),
                            fontSize: 11,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // 7-day grid
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (i) {
              // A day is "active" if it falls within the streak
              // (counting back from today)
              final isActive =
                  i <= todayIndex && (todayIndex - i) < streakDays;
              final isToday = i == todayIndex;
              final isFuture = i > todayIndex;

              return _DayDot(
                label: weekdays[i],
                isActive: isActive,
                isToday: isToday,
                isFuture: isFuture,
                isDark: isDark,
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _DayDot extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isToday;
  final bool isFuture;
  final bool isDark;

  static const Color _flameColor = Color(0xFFF97316);

  const _DayDot({
    required this.label,
    required this.isActive,
    required this.isToday,
    required this.isFuture,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive
                ? _flameColor.withValues(alpha: 0.15)
                : isFuture
                    ? (isDark
                        ? AppColors.darkSurfaceVariant.withValues(alpha: 0.4)
                        : Colors.white.withValues(alpha: 0.5))
                    : (isDark
                        ? AppColors.darkSurfaceVariant
                        : Colors.white.withValues(alpha: 0.7)),
            border: isToday
                ? Border.all(color: _flameColor, width: 1.75)
                : null,
          ),
          child: Center(
            child: isActive
                ? const Icon(
                    Icons.local_fire_department_rounded,
                    size: 16,
                    color: _flameColor,
                  )
                : Icon(
                    Icons.circle,
                    size: 6,
                    color: isFuture
                        ? (isDark
                            ? AppColors.darkBorder
                            : AppColors.border)
                        : (isDark
                            ? AppColors.darkTextTertiary.withValues(alpha: 0.5)
                            : AppColors.textTertiary.withValues(alpha: 0.4)),
                  ),
          ),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
            color: isToday
                ? _flameColor
                : isActive
                    ? (isDark
                        ? const Color(0xFFFDBA74)
                        : const Color(0xFFC2410C))
                    : (isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary),
          ),
        ),
      ],
    );
  }
}
