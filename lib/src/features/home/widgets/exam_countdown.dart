import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';

class ExamCountdown extends StatelessWidget {
  final DateTime examDate;

  const ExamCountdown({super.key, required this.examDate});

  @override
  Widget build(BuildContext context) {
    final daysLeft = AppDateUtils.daysUntil(examDate);

    return Container(
      width: double.infinity,
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: daysLeft <= 7
              ? [AppColors.error, AppColors.warning]
              : [AppColors.primary, AppColors.secondary],
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      ),
      child: Column(
        children: [
          Text(
            '$daysLeft',
            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
          ),
          Text(
            'days until exam',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.white70,
                ),
          ),
          AppSpacing.gapXs,
          Text(
            AppDateUtils.formatFull(examDate),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white60,
                ),
          ),
        ],
      ),
    );
  }
}
