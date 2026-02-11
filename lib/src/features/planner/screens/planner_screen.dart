import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../core/widgets/empty_state.dart';
import '../../home/providers/home_provider.dart';
import '../providers/planner_provider.dart';
import '../widgets/day_header.dart';
import '../widgets/task_row.dart';

class PlannerScreen extends ConsumerWidget {
  const PlannerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeCourseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (activeCourseId == null) {
      return const Scaffold(
        body: EmptyState(
          icon: Icons.calendar_today,
          title: 'No course selected',
          subtitle: 'Select a course to view the plan',
        ),
      );
    }

    final tasksAsync = ref.watch(allTasksProvider(activeCourseId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Study Plan'),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              tooltip: 'Regenerate schedule',
              onPressed: () async {
                try {
                  await ref
                      .read(cloudFunctionsServiceProvider)
                      .regenSchedule(courseId: activeCourseId);
                  ref.invalidate(allTasksProvider(activeCourseId));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Schedule regenerated')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to regenerate: $e')),
                    );
                  }
                }
              },
            ),
          ),
        ],
      ),
      body: tasksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (tasks) {
          if (tasks.isEmpty) {
            return const EmptyState(
              icon: Icons.calendar_today,
              title: 'No plan generated yet',
              subtitle: 'Upload materials and generate a study plan',
              actionLabel: 'Generate Plan',
            );
          }

          final grouped = ref.watch(groupedTasksProvider(tasks));

          return ListView.builder(
            padding: AppSpacing.screenPadding,
            itemCount: grouped.length,
            itemBuilder: (context, i) {
              final date = grouped.keys.elementAt(i);
              final dayTasks = grouped[date]!;
              final totalMinutes =
                  dayTasks.fold<int>(0, (sum, t) => sum + t.estMinutes);

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DayHeader(
                    label: AppDateUtils.relativeDay(date),
                    totalMinutes: totalMinutes,
                    completedCount: dayTasks
                        .where((t) => t.status == 'DONE')
                        .length,
                    totalCount: dayTasks.length,
                  ),
                  ...dayTasks.map((task) => TaskRow(task: task)),
                  AppSpacing.gapMd,
                ],
              );
            },
          );
        },
      ),
    );
  }
}
