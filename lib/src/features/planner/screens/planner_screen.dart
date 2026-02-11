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
    var activeCourseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Fallback: pick the first course if the provider hasn't been set yet
    if (activeCourseId == null) {
      final courses = ref.watch(coursesProvider).valueOrNull ?? [];
      if (courses.isNotEmpty) {
        activeCourseId = courses.first.id;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(activeCourseIdProvider.notifier).state = activeCourseId;
        });
      }
    }

    if (activeCourseId == null) {
      return const Scaffold(
        body: EmptyState(
          icon: Icons.calendar_today,
          title: 'No course selected',
          subtitle: 'Select a course to view the plan',
        ),
      );
    }

    final String courseId = activeCourseId;
    final tasksAsync = ref.watch(allTasksProvider(courseId));

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Text(
                    'Study Plan',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  Material(
                    color: isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                    child: InkWell(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                      onTap: () async {
                        try {
                          await ref
                              .read(cloudFunctionsServiceProvider)
                              .regenSchedule(courseId: courseId);
                          ref.invalidate(
                              allTasksProvider(courseId));
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content:
                                      Text('Schedule regenerated')),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content: Text(
                                      'Failed to regenerate: $e')),
                            );
                          }
                        }
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        child: Icon(
                          Icons.refresh_rounded,
                          size: 20,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Content ───────────────────────────────────────────────
            Expanded(
              child: tasksAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Error: $e')),
                data: (tasks) {
                  if (tasks.isEmpty) {
                    return EmptyState(
                      icon: Icons.calendar_today,
                      title: 'No plan generated yet',
                      subtitle:
                          'Upload materials and generate a study plan',
                      actionLabel: 'Generate Plan',
                      onAction: () async {
                        try {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('Generating study plan...')),
                          );
                          await ref
                              .read(cloudFunctionsServiceProvider)
                              .generateSchedule(
                                courseId: courseId,
                                availability: {},
                                revisionPolicy: 'standard',
                              );
                          ref.invalidate(allTasksProvider(courseId));
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('Plan generated!')),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content: Text('Failed: $e')),
                            );
                          }
                        }
                      },
                    );
                  }

                  final grouped =
                      ref.watch(groupedTasksProvider(tasks));

                  return ListView.builder(
                    padding: AppSpacing.screenPadding,
                    itemCount: grouped.length,
                    itemBuilder: (context, i) {
                      final date = grouped.keys.elementAt(i);
                      final dayTasks = grouped[date]!;
                      final totalMinutes = dayTasks.fold<int>(
                          0, (sum, t) => sum + t.estMinutes);

                      return Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        children: [
                          DayHeader(
                            label: AppDateUtils.relativeDay(date),
                            totalMinutes: totalMinutes,
                            completedCount: dayTasks
                                .where((t) => t.status == 'DONE')
                                .length,
                            totalCount: dayTasks.length,
                          ),
                          ...dayTasks
                              .map((task) => TaskRow(task: task)),
                          AppSpacing.gapMd,
                        ],
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
