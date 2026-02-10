import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../models/task_model.dart';

class TaskRow extends ConsumerWidget {
  final TaskModel task;

  const TaskRow({super.key, required this.task});

  Color get _statusColor {
    switch (task.status) {
      case 'DONE':
        return AppColors.taskDone;
      case 'IN_PROGRESS':
        return AppColors.taskInProgress;
      case 'SKIPPED':
        return AppColors.taskSkipped;
      default:
        return AppColors.taskTodo;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDone = task.status == 'DONE';

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Slidable(
        endActionPane: ActionPane(
          motion: const DrawerMotion(),
          children: [
            SlidableAction(
              onPressed: (_) {
                final uid = ref.read(uidProvider);
                if (uid != null) {
                  ref.read(firestoreServiceProvider).updateTask(
                    uid,
                    task.id,
                    {'status': task.status == 'SKIPPED' ? 'TODO' : 'SKIPPED'},
                  );
                }
              },
              backgroundColor: AppColors.warning,
              foregroundColor: Colors.white,
              icon: Icons.skip_next_rounded,
              label: 'Skip',
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
          ],
        ),
        child: Container(
          decoration: BoxDecoration(
            color: isDone
                ? AppColors.successSurface
                : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: isDone
                  ? AppColors.success.withValues(alpha: 0.2)
                  : AppColors.border,
            ),
            boxShadow: isDone ? null : AppSpacing.shadowSm,
          ),
          child: ListTile(
            onTap: task.status != 'DONE'
                ? () => context.push(
                      '/study/${task.id}/${task.sectionId}',
                    )
                : null,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
            leading: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: _statusColor,
                shape: BoxShape.circle,
              ),
            ),
            title: Text(
              task.title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    decoration: isDone ? TextDecoration.lineThrough : null,
                    color: isDone
                        ? AppColors.textTertiary
                        : AppColors.textPrimary,
                  ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                children: [
                  Icon(Icons.timer_outlined,
                      size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Text(
                    AppDateUtils.formatDuration(task.estMinutes),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(width: 12),
                  Icon(Icons.label_outline_rounded,
                      size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      task.type,
                      style: Theme.of(context).textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            trailing: isDone
                ? const Icon(Icons.check_circle_rounded,
                    color: AppColors.success, size: 20)
                : Icon(Icons.chevron_right_rounded,
                    color: AppColors.textTertiary, size: 20),
          ),
        ),
      ),
    );
  }
}
