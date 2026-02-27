import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/proxy_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/course_model.dart';
import '../../../models/stats_model.dart';
import '../../../models/task_model.dart';

// ── Shared helpers for proxy polling ──────────────────────────────────────

/// Returns the best available ID token for proxy calls.
///
/// Prefers Firebase Auth (always fresh), falls back to the stored proxy
/// session token, refreshing it via the proxy if it has expired.
Future<String?> _resolveIdToken(Ref ref) async {
  final firebaseUser = ref.read(currentUserProvider);
  if (firebaseUser != null) {
    try {
      return await firebaseUser.getIdToken();
    } catch (_) {
      // Firebase token fetch failed — fall through to proxy session.
    }
  }
  return ref.read(proxySessionProvider.notifier).getValidIdToken();
}

/// Emits an initial value then repeats every [interval].
Stream<T> _polling<T>(
  Duration interval,
  Future<T> Function() fetch,
) async* {
  yield await fetch();
  await for (final _ in Stream.periodic(interval)) {
    yield await fetch();
  }
}

// ── Providers ──────────────────────────────────────────────────────────────

final coursesProvider = StreamProvider<List<CourseModel>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();

  final mode = ref.watch(networkModeProvider);
  if (mode == NetworkMode.proxy) {
    final proxy = ref.read(proxyServiceProvider);
    return _polling(const Duration(seconds: 30), () async {
      final token = await _resolveIdToken(ref);
      if (token == null) return <CourseModel>[];
      final docs = await proxy.readCollection('courses', token);
      return docs.map(CourseModel.fromJson).toList();
    });
  }

  return ref.watch(firestoreServiceProvider).watchCourses(uid);
});

final activeCourseIdProvider = StateProvider<String?>((ref) => null);

final todayTasksProvider =
    StreamProvider.family<List<TaskModel>, String>((ref, courseId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();

  final mode = ref.watch(networkModeProvider);
  if (mode == NetworkMode.proxy) {
    final proxy = ref.read(proxyServiceProvider);
    return _polling(const Duration(seconds: 30), () async {
      final token = await _resolveIdToken(ref);
      if (token == null) return <TaskModel>[];
      final docs = await proxy.readCollection(
        'tasks',
        token,
        courseId: courseId,
        today: true,
      );
      return docs.map(TaskModel.fromJson).toList();
    });
  }

  return ref.watch(firestoreServiceProvider).watchTodayTasks(uid, courseId);
});

final courseStatsProvider =
    StreamProvider.family<StatsModel?, String>((ref, courseId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();

  final mode = ref.watch(networkModeProvider);
  if (mode == NetworkMode.proxy) {
    final proxy = ref.read(proxyServiceProvider);
    return _polling(const Duration(seconds: 60), () async {
      final token = await _resolveIdToken(ref);
      if (token == null) return null;
      final docs = await proxy.readCollection(
        'stats',
        token,
        courseId: courseId,
      );
      if (docs.isEmpty) return null;
      // stats doc ID = courseId; proxy sets 'id', but model expects 'courseId'
      final raw = <String, dynamic>{...docs.first, 'courseId': docs.first['id'] ?? courseId};
      return StatsModel.fromJson(raw);
    });
  }

  return ref.watch(firestoreServiceProvider).watchStats(uid, courseId);
});
