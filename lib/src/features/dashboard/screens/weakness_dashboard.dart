import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/primary_button.dart';
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
              Text(
                'Topics Ranked by Weakness',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              AppSpacing.gapMd,
              ...stats.weakestTopics.map(
                (topic) => TopicWeaknessRow(topic: topic),
              ),
              AppSpacing.gapLg,
              PrimaryButton(
                label: 'Generate Fix Plan',
                isLoading: fixPlan.isLoading,
                icon: Icons.auto_fix_high,
                onPressed: () {
                  ref
                      .read(fixPlanProvider.notifier)
                      .generateFixPlan(activeCourseId);
                },
              ),
              AppSpacing.gapMd,
              if (fixPlan.fixPlan != null)
                FixPlanCard(fixPlan: fixPlan.fixPlan!),
            ],
          );
        },
      ),
    );
  }
}
