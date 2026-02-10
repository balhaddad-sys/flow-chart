import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class FixPlanCard extends StatelessWidget {
  final Map<String, dynamic> fixPlan;

  const FixPlanCard({super.key, required this.fixPlan});

  @override
  Widget build(BuildContext context) {
    final plan = fixPlan['fix_plan'] as Map<String, dynamic>?;
    if (plan == null) return const SizedBox.shrink();

    final summary = plan['summary'] as String? ?? '';
    final tasks = (plan['tasks'] as List<dynamic>?) ?? [];

    return Container(
      padding: AppSpacing.cardPaddingLarge,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
        boxShadow: AppSpacing.shadowMd,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: AppColors.secondarySurface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.auto_fix_high_rounded,
                    color: AppColors.secondary, size: 18),
              ),
              AppSpacing.hGapSm,
              Text(
                'Fix Plan',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
          AppSpacing.gapMd,
          Text(
            summary,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
          ),
          if (tasks.isNotEmpty) ...[
            AppSpacing.gapMd,
            ...tasks.map((task) {
              final t = task as Map<String, dynamic>;
              final isReview = t['type'] == 'REVIEW';
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isReview
                      ? AppColors.primarySurface
                      : AppColors.secondarySurface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: isReview
                            ? AppColors.primary.withValues(alpha: 0.15)
                            : AppColors.secondary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        isReview
                            ? Icons.refresh_rounded
                            : Icons.quiz_rounded,
                        color: isReview
                            ? AppColors.primary
                            : AppColors.secondary,
                        size: 16,
                      ),
                    ),
                    AppSpacing.hGapMd,
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t['title'] as String? ?? '',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          Text(
                            'Day ${t['dayOffset'] ?? 0} | ${t['estMinutes'] ?? 0} min',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
