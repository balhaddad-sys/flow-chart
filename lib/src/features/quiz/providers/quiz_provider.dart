import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';
import '../../../models/question_model.dart';

class QuizState {
  final List<QuestionModel> questions;
  final int currentIndex;
  final int? selectedOptionIndex;
  final bool hasSubmitted;
  final bool isLoading;
  final String? errorMessage;
  final Map<String, dynamic>? tutorResponse;
  final int correctCount;
  final int totalAnswered;

  const QuizState({
    this.questions = const [],
    this.currentIndex = 0,
    this.selectedOptionIndex,
    this.hasSubmitted = false,
    this.isLoading = false,
    this.errorMessage,
    this.tutorResponse,
    this.correctCount = 0,
    this.totalAnswered = 0,
  });

  QuestionModel? get currentQuestion =>
      currentIndex < questions.length ? questions[currentIndex] : null;

  bool get isComplete =>
      questions.isNotEmpty && currentIndex >= questions.length;

  double get accuracy =>
      totalAnswered > 0 ? correctCount / totalAnswered : 0;

  QuizState copyWith({
    List<QuestionModel>? questions,
    int? currentIndex,
    int? selectedOptionIndex,
    bool? hasSubmitted,
    bool? isLoading,
    String? errorMessage,
    Map<String, dynamic>? tutorResponse,
    int? correctCount,
    int? totalAnswered,
  }) {
    return QuizState(
      questions: questions ?? this.questions,
      currentIndex: currentIndex ?? this.currentIndex,
      selectedOptionIndex: selectedOptionIndex,
      hasSubmitted: hasSubmitted ?? this.hasSubmitted,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      tutorResponse: tutorResponse,
      correctCount: correctCount ?? this.correctCount,
      totalAnswered: totalAnswered ?? this.totalAnswered,
    );
  }
}

class QuizNotifier extends StateNotifier<QuizState> {
  final Ref _ref;
  final Stopwatch _questionStopwatch = Stopwatch();

  QuizNotifier(this._ref) : super(const QuizState());

  Future<void> loadQuestions({
    required String courseId,
    String? sectionId,
    int count = 10,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final uid = _ref.read(uidProvider);
      if (uid == null) throw Exception('Not authenticated');

      final firestoreService = _ref.read(firestoreServiceProvider);
      final questions = await firestoreService.getQuestions(
        uid,
        courseId: courseId,
        sectionId: sectionId,
        limit: count,
      );

      // Filter out questions with invalid data (empty stem or no options)
      final validQuestions = questions
          .where((q) => q.stem.isNotEmpty && q.options.isNotEmpty)
          .toList();

      state = state.copyWith(
        questions: validQuestions,
        currentIndex: 0,
        isLoading: false,
        correctCount: 0,
        totalAnswered: 0,
      );
      _questionStopwatch
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

  void selectOption(int index) {
    if (state.hasSubmitted) return;
    state = state.copyWith(selectedOptionIndex: index);
  }

  Future<void> submitAnswer() async {
    final question = state.currentQuestion;
    if (question == null || state.selectedOptionIndex == null) return;

    _questionStopwatch.stop();
    final timeSpentSec = _questionStopwatch.elapsed.inSeconds;

    state = state.copyWith(hasSubmitted: true, isLoading: true);

    // Guard: ensure correctIndex is within bounds
    final safeCorrectIndex = question.options.isNotEmpty
        ? question.correctIndex.clamp(0, question.options.length - 1)
        : 0;
    final isCorrect = state.selectedOptionIndex == safeCorrectIndex;

    try {
      final functionsService = _ref.read(cloudFunctionsServiceProvider);
      final result = await functionsService.submitAttempt(
        questionId: question.id,
        answerIndex: state.selectedOptionIndex!,
        timeSpentSec: timeSpentSec,
      );

      final tutorData = result['tutorResponse'];
      state = state.copyWith(
        isLoading: false,
        correctCount: state.correctCount + (isCorrect ? 1 : 0),
        totalAnswered: state.totalAnswered + 1,
        tutorResponse: isCorrect ? null : (tutorData is Map ? Map<String, dynamic>.from(tutorData) : null),
      );
    } catch (e) {
      ErrorHandler.logError(e);
      // Still record the answer even if submit fails
      state = state.copyWith(
        isLoading: false,
        correctCount: state.correctCount + (isCorrect ? 1 : 0),
        totalAnswered: state.totalAnswered + 1,
      );
    }
  }

  void nextQuestion() {
    state = state.copyWith(
      currentIndex: state.currentIndex + 1,
      selectedOptionIndex: null,
      hasSubmitted: false,
      tutorResponse: null,
    );
    _questionStopwatch
      ..reset()
      ..start();
  }
}

final quizProvider = StateNotifierProvider<QuizNotifier, QuizState>((ref) {
  return QuizNotifier(ref);
});
