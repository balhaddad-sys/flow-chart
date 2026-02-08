import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/task_model.dart';
import '../providers/home_provider.dart';

class TodayChecklist extends ConsumerWidget {
  final String courseId;

  const TodayChecklist({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(todayTasksProvider(courseId));

    return tasksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Text('Error loading tasks: $e'),
      data: (tasks) {
        if (tasks.isEmpty) {
          return const EmptyState(
            icon: Icons.check_circle_outline,
            title: 'No tasks for today',
            subtitle: 'Generate a plan to get started',
          );
        }

        return Column(
          children: tasks.map((task) => _TaskRow(task: task)).toList(),
        );
      },
    );
  }
}

class _TaskRow extends ConsumerWidget {
  final TaskModel task;

  const _TaskRow({required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDone = task.status == 'DONE';

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ListTile(
        leading: Checkbox(
          value: isDone,
          onChanged: (checked) {
            if (checked == true) {
              final uid = ref.read(uidProvider);
              if (uid != null) {
                ref.read(firestoreServiceProvider).completeTask(uid, task.id);
              }
            }
          },
        ),
        title: Text(
          task.title,
          style: TextStyle(
            decoration: isDone ? TextDecoration.lineThrough : null,
            color: isDone ? AppColors.textTertiary : null,
          ),
        ),
        subtitle: Text(
          '${AppDateUtils.formatDuration(task.estMinutes)} | ${task.type}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        trailing: _difficultyBadge(task.difficulty),
      ),
    );
  }

  Widget _difficultyBadge(int difficulty) {
    final color = difficulty <= 2
        ? AppColors.difficultyEasy
        : difficulty <= 3
            ? AppColors.difficultyMedium
            : AppColors.difficultyHard;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Text(
        'D$difficulty',
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
