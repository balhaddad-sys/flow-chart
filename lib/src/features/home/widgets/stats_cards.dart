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

    return statsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) {
        if (stats == null) return const SizedBox.shrink();

        return Row(
          children: [
            _StatCard(
              label: 'Completion',
              child: CircularPercentIndicator(
                radius: 26,
                lineWidth: 5,
                percent: stats.completionPercent.clamp(0, 1),
                center: Text(
                  '${(stats.completionPercent * 100).round()}%',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                ),
                progressColor: AppColors.primary,
                backgroundColor: AppColors.primarySurface,
                circularStrokeCap: CircularStrokeCap.round,
              ),
            ),
            AppSpacing.hGapSm,
            _StatCard(
              label: 'Accuracy',
              child: Text(
                '${(stats.overallAccuracy * 100).round()}%',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
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
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '${stats.streakDays}',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  Text(
                    'd',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textTertiary,
                        ),
                  ),
                ],
              ),
            ),
            AppSpacing.hGapSm,
            _StatCard(
              label: 'This week',
              child: Text(
                AppDateUtils.formatDuration(stats.weeklyStudyMinutes),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
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

  const _StatCard({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
          boxShadow: AppSpacing.shadowSm,
        ),
        child: Column(
          children: [
            child,
            AppSpacing.gapXs,
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
