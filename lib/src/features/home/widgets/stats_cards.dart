import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
import '../providers/home_provider.dart';

class StatsCards extends ConsumerWidget {
  final String courseId;

  const StatsCards({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(courseStatsProvider(courseId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return statsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) {
        if (stats == null) return const SizedBox.shrink();

        return Row(
          children: [
            _StatCard(
              label: 'Completion',
              isDark: isDark,
              child: CircularPercentIndicator(
                radius: 26,
                lineWidth: 4,
                percent: stats.completionPercent.clamp(0, 1),
                center: Text(
                  '${(stats.completionPercent * 100).round()}%',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                ),
                progressColor: AppColors.primary,
                backgroundColor: isDark ? AppColors.darkBorder : AppColors.border,
                circularStrokeCap: CircularStrokeCap.round,
              ),
            ),
            AppSpacing.hGapSm,
            _StatCard(
              label: 'Accuracy',
              isDark: isDark,
              child: Text(
                '${(stats.overallAccuracy * 100).round()}%',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: stats.overallAccuracy >= 0.7
                          ? AppColors.success
                          : AppColors.warning,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            AppSpacing.hGapSm,
            _StatCard(
              label: 'Streak',
              isDark: isDark,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '${stats.streakDays}',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  Text(
                    'd',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            AppSpacing.hGapSm,
            _StatCard(
              label: 'This week',
              isDark: isDark,
              child: Text(
                AppDateUtils.formatDuration(stats.weeklyStudyMinutes),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final Widget child;
  final bool isDark;

  const _StatCard({
    required this.label,
    required this.child,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isDark
                ? AppColors.darkBorder.withValues(alpha: 0.5)
                : AppColors.border.withValues(alpha: 0.5),
          ),
          boxShadow: isDark ? null : AppSpacing.shadowSm,
        ),
        child: Column(
          children: [
            child,
            const SizedBox(height: 6),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
