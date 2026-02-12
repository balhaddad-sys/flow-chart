import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../models/task_model.dart';

class TaskRow extends ConsumerWidget {
  final TaskModel task;

  const TaskRow({super.key, required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDone = task.status == 'DONE';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Slidable(
      endActionPane: ActionPane(
        motion: const ScrollMotion(),
        children: [
          SlidableAction(
            onPressed: (_) async {
              final picked = await showDatePicker(
                context: context,
                initialDate: task.dueDate.add(const Duration(days: 1)),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) {
                final uid = ref.read(uidProvider);
                if (uid != null) {
                  unawaited(
                    ref.read(firestoreServiceProvider).updateTask(
                      uid,
                      task.id,
                      {'dueDate': picked},
                    ),
                  );
                }
              }
            },
            backgroundColor: AppColors.info,
            foregroundColor: Colors.white,
            icon: Icons.schedule,
            label: 'Reschedule',
          ),
          SlidableAction(
            onPressed: (_) {
              final uid = ref.read(uidProvider);
              if (uid != null) {
                ref.read(firestoreServiceProvider).updateTask(
                  uid,
                  task.id,
                  {'status': 'SKIPPED'},
                );
              }
            },
            backgroundColor: AppColors.warning,
            foregroundColor: Colors.white,
            icon: Icons.skip_next,
            label: 'Skip',
          ),
        ],
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.xs),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isDone
                ? (isDark ? AppColors.darkBorder : AppColors.borderLight)
                : (isDark ? AppColors.darkBorder : AppColors.border),
          ),
        ),
        child: ListTile(
          leading: _typeIcon(task.type, isDark),
          title: Text(
            task.title,
            style: TextStyle(
              decoration: isDone ? TextDecoration.lineThrough : null,
              color: isDone
                  ? (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)
                  : null,
            ),
          ),
          subtitle: Text(
            AppDateUtils.formatDuration(task.estMinutes),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
          ),
          trailing: Checkbox(
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
        ),
      ),
    );
  }

  Widget _typeIcon(String type, bool isDark) {
    final IconData icon;
    final Color color;
    switch (type) {
      case 'STUDY':
        icon = Icons.menu_book;
        color = AppColors.primary;
      case 'QUESTIONS':
        icon = Icons.quiz;
        color = AppColors.secondary;
      case 'REVIEW':
        icon = Icons.refresh;
        color = AppColors.warning;
      case 'MOCK':
        icon = Icons.assignment;
        color = AppColors.error;
      default:
        icon = Icons.task;
        color = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
    }

    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Icon(icon, color: color, size: 18),
    );
  }
}
