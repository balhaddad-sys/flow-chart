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
      final result =
          await _ref.read(cloudFunctionsServiceProvider).generateSchedule(
                courseId: courseId,
                availability: {},
                revisionPolicy: 'standard',
              );
      _ref.invalidate(allTasksProvider(courseId));

      // Backend returns feasible: false when schedule doesn't fit
      if (result['feasible'] == false) {
        final deficit = result['deficit'] ?? 0;
        state = AsyncError(
          Exception(
            'Not enough study days to fit all tasks '
            '($deficit minutes over capacity). '
            'Try extending your study period or increasing daily hours.',
          ),
          StackTrace.current,
        );
        return;
      }

      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  /// Deletes old tasks then generates a fresh schedule.
  Future<void> regenSchedule(String courseId) async {
    state = const AsyncLoading();
    try {
      // Step 1: delete old non-completed tasks
      await _ref.read(cloudFunctionsServiceProvider).regenSchedule(
            courseId: courseId,
          );

      // Step 2: generate new schedule
      final result =
          await _ref.read(cloudFunctionsServiceProvider).generateSchedule(
                courseId: courseId,
                availability: {},
                revisionPolicy: 'standard',
              );
      _ref.invalidate(allTasksProvider(courseId));

      if (result['feasible'] == false) {
        final deficit = result['deficit'] ?? 0;
        state = AsyncError(
          Exception(
            'Not enough study days to fit all tasks '
            '($deficit minutes over capacity). '
            'Try extending your study period or increasing daily hours.',
          ),
          StackTrace.current,
        );
        return;
      }

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
