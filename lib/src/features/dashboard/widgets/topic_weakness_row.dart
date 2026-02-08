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
    final weaknessPercent = (topic.weaknessScore * 100).round();

    final color = topic.accuracy < 0.4
        ? AppColors.error
        : topic.accuracy < 0.7
            ? AppColors.warning
            : AppColors.success;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Padding(
        padding: AppSpacing.cardPadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    topic.tag,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(
                  '$accuracyPercent% accuracy',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: color,
                        fontWeight: FontWeight.w600,
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
              backgroundColor: AppColors.border,
              barRadius: const Radius.circular(3),
            ),
            AppSpacing.gapXs,
            Text(
              'Weakness score: $weaknessPercent%',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
