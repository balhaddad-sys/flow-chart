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
                  ref.read(firestoreServiceProvider).updateTask(
                    uid,
                    task.id,
                    {'dueDate': picked},
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
      child: Card(
        margin: const EdgeInsets.only(bottom: AppSpacing.xs),
        child: ListTile(
          leading: _typeIcon(task.type),
          title: Text(
            task.title,
            style: TextStyle(
              decoration: isDone ? TextDecoration.lineThrough : null,
              color: isDone ? AppColors.textTertiary : null,
            ),
          ),
          subtitle: Text(
            AppDateUtils.formatDuration(task.estMinutes),
            style: Theme.of(context).textTheme.bodySmall,
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

  Widget _typeIcon(String type) {
    switch (type) {
      case 'STUDY':
        return const Icon(Icons.menu_book, color: AppColors.primary);
      case 'QUESTIONS':
        return const Icon(Icons.quiz, color: AppColors.secondary);
      case 'REVIEW':
        return const Icon(Icons.refresh, color: AppColors.warning);
      case 'MOCK':
        return const Icon(Icons.assignment, color: AppColors.error);
      default:
        return const Icon(Icons.task);
    }
  }
}
