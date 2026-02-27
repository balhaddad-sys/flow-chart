import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';
import '../../../models/question_model.dart';

class QuizState {
  final List<QuestionModel> questions;
  final int currentIndex;
  final bool isLoading;
  final String? errorMessage;

  /// Per-question answer tracking (matches web's answers Map).
  final Map<String, int> answers;

  /// Per-question correctness (matches web's results Map).
  final Map<String, bool> results;

  /// Per-question attempt IDs from backend.
  final Map<String, String> attemptIds;

  /// Tutor response for current question.
  final Map<String, dynamic>? tutorResponse;

  /// Whether the quiz was ended early.
  final bool endedEarly;

  /// Index currently being submitted (for pending spinner).
  final int? pendingOptionIndex;

  /// Whether a submit is in flight.
  final bool isSubmitting;

  const QuizState({
    this.questions = const [],
    this.currentIndex = 0,
    this.isLoading = false,
    this.errorMessage,
    this.answers = const {},
    this.results = const {},
    this.attemptIds = const {},
    this.tutorResponse,
    this.endedEarly = false,
    this.pendingOptionIndex,
    this.isSubmitting = false,
  });

  QuestionModel? get currentQuestion =>
      currentIndex < questions.length ? questions[currentIndex] : null;

  bool get isComplete =>
      questions.isNotEmpty && currentIndex >= questions.length;

  bool get isCurrentAnswered =>
      currentQuestion != null && answers.containsKey(currentQuestion!.id);

  int? get selectedOptionIndex =>
      currentQuestion != null ? answers[currentQuestion!.id] : null;

  bool? get isCurrentCorrect =>
      currentQuestion != null ? results[currentQuestion!.id] : null;

  int get correctCount => results.values.where((v) => v).length;
  int get totalAnswered => answers.length;
  double get accuracy =>
      totalAnswered > 0 ? correctCount / totalAnswered : 0;

  bool get isLast => currentIndex >= questions.length - 1;

  QuizState copyWith({
    List<QuestionModel>? questions,
    int? currentIndex,
    bool? isLoading,
    String? errorMessage,
    Map<String, int>? answers,
    Map<String, bool>? results,
    Map<String, String>? attemptIds,
    Map<String, dynamic>? tutorResponse,
    bool clearTutor = false,
    bool? endedEarly,
    int? pendingOptionIndex,
    bool clearPending = false,
    bool? isSubmitting,
  }) {
    return QuizState(
      questions: questions ?? this.questions,
      currentIndex: currentIndex ?? this.currentIndex,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      answers: answers ?? this.answers,
      results: results ?? this.results,
      attemptIds: attemptIds ?? this.attemptIds,
      tutorResponse: clearTutor ? null : (tutorResponse ?? this.tutorResponse),
      endedEarly: endedEarly ?? this.endedEarly,
      pendingOptionIndex:
          clearPending ? null : (pendingOptionIndex ?? this.pendingOptionIndex),
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }
}

class QuizNotifier extends StateNotifier<QuizState> {
  final Ref _ref;
  final Stopwatch _quizStopwatch = Stopwatch();

  QuizNotifier(this._ref) : super(const QuizState());

  Future<void> loadQuestions({
    required String courseId,
    String? sectionId,
    String? topicTag,
    String mode = 'section',
    int count = 10,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final uid = _ref.read(uidProvider);
      if (uid == null) throw Exception('Not authenticated');

      final result = await _ref.read(cloudFunctionsServiceProvider).getQuiz(
            courseId: courseId,
            sectionId: sectionId,
            topicTag: topicTag,
            mode: mode,
            count: count,
          );

      final rawQuestions = result['questions'] as List<dynamic>? ?? [];
      final questions = rawQuestions
          .whereType<Map>()
          .map((q) => QuestionModel.fromJson(Map<String, dynamic>.from(q)))
          .toList();

      final validQuestions = questions
          .where((q) => q.stem.isNotEmpty && q.options.isNotEmpty)
          .toList();

      state = state.copyWith(
        questions: validQuestions,
        currentIndex: 0,
        isLoading: false,
        answers: {},
        results: {},
        attemptIds: {},
        endedEarly: false,
      );
      _quizStopwatch
        ..reset()
        ..start();
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        isLoading: false,
        errorMessage: ErrorHandler.userMessage(e),
      );
    }
  }

  /// One-tap answer — matches web behaviour exactly.
  /// Immediately records optimistic result, then syncs with backend.
  Future<void> answerQuestion(int optionIndex) async {
    final question = state.currentQuestion;
    if (question == null || state.isCurrentAnswered || state.isSubmitting) {
      return;
    }

    final safeCorrectIndex = question.options.isNotEmpty
        ? question.correctIndex.clamp(0, question.options.length - 1)
        : 0;
    final optimisticCorrect = optionIndex == safeCorrectIndex;

    // Optimistic update — show result instantly
    final newAnswers = Map<String, int>.from(state.answers);
    newAnswers[question.id] = optionIndex;
    final newResults = Map<String, bool>.from(state.results);
    newResults[question.id] = optimisticCorrect;

    state = state.copyWith(
      answers: newAnswers,
      results: newResults,
      pendingOptionIndex: optionIndex,
      isSubmitting: true,
      clearTutor: true,
    );

    // Fire-and-forget backend sync
    try {
      final elapsed = _quizStopwatch.elapsed.inSeconds;
      final result =
          await _ref.read(cloudFunctionsServiceProvider).submitAttempt(
                questionId: question.id,
                answerIndex: optionIndex,
                timeSpentSec: elapsed.clamp(0, 3600),
              );

      // Reconcile if backend disagrees
      final backendCorrect = result['correct'] as bool?;
      if (backendCorrect != null && backendCorrect != optimisticCorrect) {
        final reconciled = Map<String, bool>.from(state.results);
        reconciled[question.id] = backendCorrect;
        state = state.copyWith(results: reconciled);
      }

      // Store attempt ID
      final attemptId = result['attemptId'] as String?;
      if (attemptId != null) {
        final newIds = Map<String, String>.from(state.attemptIds);
        newIds[question.id] = attemptId;
        state = state.copyWith(attemptIds: newIds);
      }

      // Store tutor response if returned
      final tutorData = result['tutorResponse'];
      if (tutorData is Map) {
        state = state.copyWith(
          tutorResponse: Map<String, dynamic>.from(tutorData),
        );
      }
    } catch (e) {
      ErrorHandler.logError(e);
    } finally {
      state = state.copyWith(clearPending: true, isSubmitting: false);
    }
  }

  void nextQuestion() {
    state = state.copyWith(
      currentIndex: state.currentIndex + 1,
      clearTutor: true,
      clearPending: true,
      isSubmitting: false,
    );
    _quizStopwatch
      ..reset()
      ..start();
  }

  void finishQuiz() {
    _quizStopwatch.stop();
    state = state.copyWith(
      currentIndex: state.questions.length,
    );
  }

  void finishQuizEarly() {
    _quizStopwatch.stop();
    state = state.copyWith(
      currentIndex: state.questions.length,
      endedEarly: true,
    );
  }

  Future<void> requestTutorHelp() async {
    final question = state.currentQuestion;
    if (question == null || state.tutorResponse != null) return;

    final attemptId = state.attemptIds[question.id];
    if (attemptId == null) return;

    state = state.copyWith(isLoading: true);
    try {
      final result =
          await _ref.read(cloudFunctionsServiceProvider).getTutorHelp(
                questionId: question.id,
                attemptId: attemptId,
              );
      final tutorData = result['tutorResponse'];
      if (tutorData is Map) {
        state = state.copyWith(
          isLoading: false,
          tutorResponse: Map<String, dynamic>.from(tutorData),
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(isLoading: false);
    }
  }

  // Legacy compat
  void selectOption(int index) => answerQuestion(index);
  Future<void> submitAnswer() async {}
}

final quizProvider =
    StateNotifierProvider.autoDispose<QuizNotifier, QuizState>((ref) {
  return QuizNotifier(ref);
});
