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

    return Card(
      child: Padding(
        padding: AppSpacing.cardPadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_fix_high,
                    color: AppColors.secondary, size: 20),
                AppSpacing.hGapSm,
                Text(
                  'Fix Plan',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            AppSpacing.gapSm,
            Text(
              summary,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            AppSpacing.gapMd,
            ...tasks.map((task) {
              final t = task as Map<String, dynamic>;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  t['type'] == 'REVIEW'
                      ? Icons.refresh
                      : Icons.quiz,
                  color: AppColors.primary,
                ),
                title: Text(t['title'] as String? ?? ''),
                subtitle: Text(
                  'Day ${t['dayOffset'] ?? 0} | ${t['estMinutes'] ?? 0} min',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
