import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/course_model.dart';
import '../../../models/stats_model.dart';
import '../../../models/task_model.dart';

final coursesProvider = StreamProvider<List<CourseModel>>((ref) {
  // Keep alive so course list isn't re-fetched on every navigation
  ref.keepAlive();
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchCourses(uid);
});

final activeCourseIdProvider = StateProvider<String?>((ref) => null);

final todayTasksProvider =
    StreamProvider.family<List<TaskModel>, String>((ref, courseId) {
  ref.keepAlive();
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchTodayTasks(uid, courseId);
});

final courseStatsProvider =
    StreamProvider.family<StatsModel?, String>((ref, courseId) {
  ref.keepAlive();
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchStats(uid, courseId);
});
