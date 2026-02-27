// FILE: lib/src/features/ai/providers/ai_provider.dart

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../home/providers/home_provider.dart';

/// Streams the list of chat threads for the active user + active course.
/// Returns an empty list when uid or courseId is absent.
final chatThreadsProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final uid = ref.watch(uidProvider);
  final activeCourseId = ref.watch(activeCourseIdProvider);
  if (uid == null || activeCourseId == null || activeCourseId.trim().isEmpty) {
    return Stream.value(const <Map<String, dynamic>>[]);
  }
  return ref
      .watch(firestoreServiceProvider)
      .watchChatThreads(uid, courseId: activeCourseId);
});

/// Streams the ordered list of messages for a given thread ID.
/// Returns an empty stream when the user is not authenticated.
final chatMessagesProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>(
  (ref, threadId) {
    final uid = ref.watch(uidProvider);
    if (uid == null) return const Stream.empty();
    return ref
        .watch(firestoreServiceProvider)
        .watchChatMessages(uid, threadId);
  },
);
