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
    final isUrgent = daysLeft <= 7;

    return Container(
      width: double.infinity,
      padding: AppSpacing.cardPaddingLg,
      decoration: BoxDecoration(
        gradient: isUrgent ? AppColors.urgentGradient : AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        boxShadow: [
          BoxShadow(
            color: (isUrgent ? AppColors.error : AppColors.primary).withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isUrgent ? 'Exam approaching' : 'Exam countdown',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: Colors.white70,
                        letterSpacing: 0.5,
                      ),
                ),
                AppSpacing.gapXs,
                Text(
                  AppDateUtils.formatFull(examDate),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white60,
                      ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: Column(
              children: [
                Text(
                  '$daysLeft',
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                Text(
                  'days',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.white70,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
