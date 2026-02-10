import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';

class DayHeader extends StatelessWidget {
  final String label;
  final int totalMinutes;
  final int completedCount;
  final int totalCount;

  const DayHeader({
    super.key,
    required this.label,
    required this.totalMinutes,
    required this.completedCount,
    required this.totalCount,
  });

  @override
  Widget build(BuildContext context) {
    final allDone = completedCount == totalCount && totalCount > 0;
    final progress = totalCount > 0 ? completedCount / totalCount : 0.0;

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: allDone
                      ? AppColors.successSurface
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (allDone)
                      const Icon(Icons.check_circle_rounded,
                          color: AppColors.success, size: 14),
                    if (allDone) const SizedBox(width: 4),
                    Text(
                      allDone ? 'Complete' : '$completedCount/$totalCount',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: allDone
                                ? AppColors.success
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              AppSpacing.hGapSm,
              Text(
                AppDateUtils.formatDuration(totalMinutes),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.textTertiary,
                    ),
              ),
            ],
          ),
          AppSpacing.gapXs,
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.surfaceVariant,
              color: allDone ? AppColors.success : AppColors.primary,
              minHeight: 3,
            ),
          ),
        ],
      ),
    );
  }
}
