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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Spacer(),
          Text(
            '$completedCount/$totalCount',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: completedCount == totalCount
                      ? AppColors.success
                      : AppColors.textSecondary,
                ),
          ),
          AppSpacing.hGapSm,
          Text(
            AppDateUtils.formatDuration(totalMinutes),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
