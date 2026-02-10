import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../models/stats_model.dart';
import '../../home/providers/home_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/topic_weakness_row.dart';
import '../widgets/fix_plan_card.dart';

class WeaknessDashboard extends ConsumerWidget {
  const WeaknessDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeCourseId = ref.watch(activeCourseIdProvider);
    if (activeCourseId == null) {
      return const Scaffold(
        body: EmptyState(
          icon: Icons.bar_chart,
          title: 'No course selected',
        ),
      );
    }

    final statsAsync = ref.watch(courseStatsProvider(activeCourseId));
    final fixPlan = ref.watch(fixPlanProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Weakness Dashboard'),
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (stats) {
          if (stats == null || stats.weakestTopics.isEmpty) {
            return const EmptyState(
              icon: Icons.check_circle_outline,
              title: 'No weak topics yet',
              subtitle: 'Complete some questions to see your weaknesses',
            );
          }

          return ListView(
            padding: AppSpacing.screenPadding,
            children: [
              // Stats summary row
              _StatsSummary(stats: stats),
              AppSpacing.gapLg,

              // Weak topics
              Text(
                'Topics Ranked by Weakness',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              AppSpacing.gapSm,
              Text(
                'Focus on the red topics first for maximum improvement',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
              AppSpacing.gapMd,
              ...stats.weakestTopics.map(
                (topic) => TopicWeaknessRow(topic: topic),
              ),
              AppSpacing.gapLg,

              // Fix plan section
              PrimaryButton(
                label: fixPlan.fixPlan != null
                    ? 'Regenerate Fix Plan'
                    : 'Generate Fix Plan',
                isLoading: fixPlan.isLoading,
                icon: Icons.auto_fix_high,
                onPressed: () {
                  ref
                      .read(fixPlanProvider.notifier)
                      .generateFixPlan(activeCourseId);
                },
              ),
              if (fixPlan.errorMessage != null) ...[
                AppSpacing.gapSm,
                Text(
                  fixPlan.errorMessage!,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.error),
                ),
              ],
              AppSpacing.gapMd,
              if (fixPlan.fixPlan != null)
                FixPlanCard(fixPlan: fixPlan.fixPlan!),
              AppSpacing.gapLg,
            ],
          );
        },
      ),
    );
  }
}

class _StatsSummary extends StatelessWidget {
  final StatsModel stats;

  const _StatsSummary({required this.stats});

  @override
  Widget build(BuildContext context) {
    final accuracyPercent = (stats.overallAccuracy * 100).round();
    final accuracyColor = stats.overallAccuracy < 0.4
        ? AppColors.error
        : stats.overallAccuracy < 0.7
            ? AppColors.warning
            : AppColors.success;

    return Card(
      child: Padding(
        padding: AppSpacing.cardPadding,
        child: Row(
          children: [
            // Accuracy ring
            CircularPercentIndicator(
              radius: 40,
              lineWidth: 8,
              percent: stats.overallAccuracy.clamp(0, 1),
              center: Text(
                '$accuracyPercent%',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              progressColor: accuracyColor,
              backgroundColor: AppColors.border,
              circularStrokeCap: CircularStrokeCap.round,
            ),
            AppSpacing.hGapMd,
            // Stats details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Overall Accuracy',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  AppSpacing.gapXs,
                  _StatRow(
                    icon: Icons.quiz_outlined,
                    label: '${stats.totalQuestionsAnswered} questions answered',
                  ),
                  _StatRow(
                    icon: Icons.timer_outlined,
                    label: '${stats.totalStudyMinutes} minutes studied',
                  ),
                  _StatRow(
                    icon: Icons.warning_amber_outlined,
                    label: '${stats.weakestTopics.length} weak topics',
                    color: AppColors.error,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _StatRow({
    required this.icon,
    required this.label,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color ?? AppColors.textSecondary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color ?? AppColors.textSecondary,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
