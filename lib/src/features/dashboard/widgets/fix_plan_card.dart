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

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final summary = plan['summary'] as String? ?? '';
    final tasks = (plan['tasks'] as List<dynamic>?) ?? [];

    return Container(
      padding: AppSpacing.cardPaddingLg,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.secondary.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: const Icon(Icons.auto_fix_high,
                    color: AppColors.secondary, size: 18),
              ),
              AppSpacing.hGapSm,
              Text(
                'Fix Plan',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
          AppSpacing.gapMd,
          Text(
            summary,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
          ),
          if (tasks.isNotEmpty) ...[
            AppSpacing.gapMd,
            ...tasks.map((task) {
              final t = task as Map<String, dynamic>;
              final isReview = t['type'] == 'REVIEW';
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkSurfaceVariant.withValues(alpha: 0.5)
                      : AppColors.surfaceVariant.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Row(
                  children: [
                    Icon(
                      isReview ? Icons.refresh : Icons.quiz,
                      color: isReview ? AppColors.warning : AppColors.primary,
                      size: 18,
                    ),
                    AppSpacing.hGapSm,
                    Expanded(
                      child: Text(
                        t['title'] as String? ?? '',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    Text(
                      'Day ${t['dayOffset'] ?? 0} · ${t['estMinutes'] ?? 0}m',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
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
