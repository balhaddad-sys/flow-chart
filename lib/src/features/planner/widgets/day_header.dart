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

    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: allDone
            ? AppColors.success.withValues(alpha: 0.05)
            : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: allDone
              ? AppColors.success.withValues(alpha: 0.2)
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (allDone)
                const Padding(
                  padding: EdgeInsets.only(right: AppSpacing.sm),
                  child: Icon(Icons.check_circle,
                      color: AppColors.success, size: 20),
                ),
              Text(
                label,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: allDone ? AppColors.success : null,
                    ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Text(
                  '$completedCount/$totalCount tasks',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: allDone
                            ? AppColors.success
                            : AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                AppDateUtils.formatDuration(totalMinutes),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textTertiary,
                    ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              color: allDone ? AppColors.success : AppColors.primary,
              backgroundColor: AppColors.border,
            ),
          ),
        ],
      ),
    );
  }
}
