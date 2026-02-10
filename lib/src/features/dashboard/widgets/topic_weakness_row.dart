import 'package:flutter/material.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/stats_model.dart';

class TopicWeaknessRow extends StatelessWidget {
  final WeakTopic topic;

  const TopicWeaknessRow({super.key, required this.topic});

  @override
  Widget build(BuildContext context) {
    final accuracyPercent = (topic.accuracy * 100).round();

    final color = topic.accuracy < 0.4
        ? AppColors.error
        : topic.accuracy < 0.7
            ? AppColors.warning
            : AppColors.success;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
        boxShadow: AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
              AppSpacing.hGapSm,
              Expanded(
                child: Text(
                  topic.tag,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
                ),
                child: Text(
                  '$accuracyPercent%',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: color,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
          ),
          AppSpacing.gapSm,
          LinearPercentIndicator(
            padding: EdgeInsets.zero,
            lineHeight: 6,
            percent: topic.accuracy.clamp(0, 1),
            progressColor: color,
            backgroundColor: color.withValues(alpha: 0.12),
            barRadius: const Radius.circular(3),
          ),
        ],
      ),
    );
  }
}
