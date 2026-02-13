import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/task_model.dart';

/// Streams all tasks for a course, ordered by dueDate and orderIndex.
final allTasksProvider =
    StreamProvider.family<List<TaskModel>, String>((ref, courseId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchAllTasks(uid, courseId);
});

/// Groups tasks by due date for the planner view.
/// Each day's tasks are sorted by orderIndex for consistent ordering.
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

  for (final dayTasks in grouped.values) {
    dayTasks.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
  }

  return Map.fromEntries(
    grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
  );
});

/// Manages async schedule generation and regeneration actions.
class PlannerActionsNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  PlannerActionsNotifier(this._ref) : super(const AsyncData(null));

  Future<void> generateSchedule(String courseId) async {
    state = const AsyncLoading();
    try {
      await _ref.read(cloudFunctionsServiceProvider).generateSchedule(
            courseId: courseId,
            availability: {},
            revisionPolicy: 'standard',
          );
      _ref.invalidate(allTasksProvider(courseId));
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> regenSchedule(String courseId) async {
    state = const AsyncLoading();
    try {
      await _ref.read(cloudFunctionsServiceProvider).regenSchedule(
            courseId: courseId,
          );
      _ref.invalidate(allTasksProvider(courseId));
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }
}

final plannerActionsProvider =
    StateNotifierProvider<PlannerActionsNotifier, AsyncValue<void>>((ref) {
  return PlannerActionsNotifier(ref);
});
