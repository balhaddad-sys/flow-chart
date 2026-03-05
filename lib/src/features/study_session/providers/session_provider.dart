import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/storage_service.dart';
import '../../../models/section_model.dart';

enum SessionPhase { studying, quiz, completed }

class SessionState {
  final String? taskId;
  final String? sectionId;
  final SessionPhase phase;
  final int elapsedSeconds;
  final bool isPaused;
  final bool isTimerRunning;

  const SessionState({
    this.taskId,
    this.sectionId,
    this.phase = SessionPhase.studying,
    this.elapsedSeconds = 0,
    this.isPaused = false,
    this.isTimerRunning = false,
  });

  SessionState copyWith({
    String? taskId,
    String? sectionId,
    SessionPhase? phase,
    int? elapsedSeconds,
    bool? isPaused,
    bool? isTimerRunning,
  }) {
    return SessionState(
      taskId: taskId ?? this.taskId,
      sectionId: sectionId ?? this.sectionId,
      phase: phase ?? this.phase,
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
      isPaused: isPaused ?? this.isPaused,
      isTimerRunning: isTimerRunning ?? this.isTimerRunning,
    );
  }
}

class SessionNotifier extends StateNotifier<SessionState> {
  final Ref _ref;
  Timer? _timer;
  bool _disposed = false;

  SessionNotifier(this._ref) : super(const SessionState());

  void startSession({required String taskId, required String sectionId}) {
    state = SessionState(
      taskId: taskId,
      sectionId: sectionId,
      phase: SessionPhase.studying,
      isTimerRunning: true,
    );
    _startTimer();
    _preWarmQuestions(sectionId);
  }

  /// Fire-and-forget: if questions haven't been generated yet, trigger it
  /// so they're ready by the time the user finishes studying.
  Future<void> _preWarmQuestions(String sectionId) async {
    try {
      final uid = _ref.read(uidProvider);
      if (uid == null) return;
      final db = _ref.read(firestoreServiceProvider);
      final section = await db.getSection(uid, sectionId);
      if (section == null) return;
      final status = section.questionsStatus;
      if (status == 'PENDING' || status == 'FAILED') {
        await _ref.read(cloudFunctionsServiceProvider).generateQuestions(
              courseId: section.courseId,
              sectionId: sectionId,
            );
      }
    } catch (_) {
      // Best-effort — don't disrupt the study session
    }
  }

  void pauseSession() {
    _timer?.cancel();
    state = state.copyWith(isPaused: true, isTimerRunning: false);
  }

  void resumeSession() {
    state = state.copyWith(isPaused: false, isTimerRunning: true);
    _startTimer();
  }

  void moveToQuiz() {
    state = state.copyWith(phase: SessionPhase.quiz);
  }

  void completeSession() {
    _timer?.cancel();
    state = state.copyWith(
      phase: SessionPhase.completed,
      isTimerRunning: false,
    );
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_disposed) {
        state = state.copyWith(elapsedSeconds: state.elapsedSeconds + 1);
      }
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}

final sessionProvider =
    StateNotifierProvider<SessionNotifier, SessionState>((ref) {
  return SessionNotifier(ref);
});

/// Streams a [SectionModel] by its document ID so blueprint updates arrive in real-time.
final sectionForSessionProvider =
    StreamProvider.family<SectionModel?, String>((ref, sectionId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(null);
  final db = ref.watch(firestoreServiceProvider);
  return db.streamSection(uid, sectionId);
});

/// Resolves a download URL for a file given its Firestore file ID.
/// Looks up the file document to get storagePath, then fetches the URL.
final pdfDownloadUrlProvider =
    FutureProvider.family<String?, String>((ref, fileId) async {
  final uid = ref.watch(uidProvider);
  if (uid == null) return null;
  final db = ref.watch(firestoreServiceProvider);
  final file = await db.getFile(uid, fileId);
  if (file == null) return null;
  final storage = StorageService();
  return storage.getDownloadUrl(file.storagePath);
});
