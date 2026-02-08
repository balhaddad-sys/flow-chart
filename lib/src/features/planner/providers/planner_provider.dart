import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/task_model.dart';

final allTasksProvider =
    StreamProvider.family<List<TaskModel>, String>((ref, courseId) {
  ref.keepAlive();
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchAllTasks(uid, courseId);
});

/// Groups tasks by date for the planner view.
final groupedTasksProvider =
    Provider.family<Map<DateTime, List<TaskModel>>, List<TaskModel>>(
        (ref, tasks) {
  final grouped = <DateTime, List<TaskModel>>{};
  for (final task in tasks) {
    final dateKey = DateTime(
      task.dueDate.year,
      task.dueDate.month,
      task.dueDate.day,
    );
    grouped.putIfAbsent(dateKey, () => []).add(task);
  }
  return Map.fromEntries(
    grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
  );
});
