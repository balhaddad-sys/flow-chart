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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final allDone = completedCount == totalCount && totalCount > 0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Spacer(),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: allDone
                  ? AppColors.success.withValues(alpha: 0.1)
                  : isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant,
              borderRadius:
                  BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Text(
              '$completedCount/$totalCount',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: allDone
                        ? AppColors.success
                        : isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          AppSpacing.hGapSm,
          Text(
            AppDateUtils.formatDuration(totalMinutes),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
          ),
        ],
      ),
    );
  }
}
