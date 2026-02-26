import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// 7-day streak visualization matching the web app's streak-graph component.
class StreakGraph extends StatelessWidget {
  final int streakDays;
  final bool isDark;

  const StreakGraph({super.key, required this.streakDays, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    final todayIndex = now.weekday - 1; // 0=Monday

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_fire_department_rounded, size: 18,
                  color: streakDays > 0 ? AppColors.warning : AppColors.textTertiary),
              const SizedBox(width: 6),
              Text(
                '$streakDays day streak',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (i) {
              // Days up to today that are within the streak
              final isActive = i <= todayIndex && (todayIndex - i) < streakDays;
              final isToday = i == todayIndex;
              return Column(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isActive
                          ? AppColors.warning.withValues(alpha: 0.15)
                          : (isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant),
                      border: isToday
                          ? Border.all(color: AppColors.primary, width: 2)
                          : null,
                    ),
                    child: Icon(
                      isActive ? Icons.local_fire_department_rounded : Icons.circle_outlined,
                      size: isActive ? 16 : 12,
                      color: isActive
                          ? AppColors.warning
                          : (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(weekdays[i],
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                        color: isToday
                            ? AppColors.primary
                            : (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
                      )),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}
