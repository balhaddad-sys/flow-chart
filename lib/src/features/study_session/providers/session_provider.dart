import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  Timer? _timer;

  SessionNotifier() : super(const SessionState());

  void startSession({required String taskId, required String sectionId}) {
    state = SessionState(
      taskId: taskId,
      sectionId: sectionId,
      phase: SessionPhase.studying,
      isTimerRunning: true,
    );
    _startTimer();
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
      if (mounted) {
        state = state.copyWith(elapsedSeconds: state.elapsedSeconds + 1);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final sessionProvider =
    StateNotifierProvider<SessionNotifier, SessionState>((ref) {
  return SessionNotifier();
});
