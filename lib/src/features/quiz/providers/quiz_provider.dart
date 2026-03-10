import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';
import '../../../models/question_model.dart';

// ── Per-question answer record ──────────────────────────────────────────────

class QuizAnswerRecord {
  final int questionIndex;
  final int selectedIndex;
  final bool isCorrect;
  final int timeSpentSec;
  final int? confidence; // 1=Low, 2=Medium, 3=High

  const QuizAnswerRecord({
    required this.questionIndex,
    required this.selectedIndex,
    required this.isCorrect,
    required this.timeSpentSec,
    this.confidence,
  });
}

// ── Sentinel for copyWith nullable fields ───────────────────────────────────

class _Absent {
  const _Absent();
}

const _absent = _Absent();

// ── Quiz state ──────────────────────────────────────────────────────────────

class QuizState {
  final List<QuestionModel> questions;
  final int currentIndex;
  final int? selectedOptionIndex;
  final bool hasSubmitted;
  final bool isLoading;
  final bool isGenerating;
  final String? errorMessage;
  final Map<String, dynamic>? tutorResponse;
  final int correctCount;
  final int totalAnswered;
  final List<QuizAnswerRecord> answerRecords;
  final bool isReviewMode;
  final int generationProgress;

  const QuizState({
    this.questions = const [],
    this.currentIndex = 0,
    this.selectedOptionIndex,
    this.hasSubmitted = false,
    this.isLoading = false,
    this.isGenerating = false,
    this.errorMessage,
    this.tutorResponse,
    this.correctCount = 0,
    this.totalAnswered = 0,
    this.answerRecords = const [],
    this.isReviewMode = false,
    this.generationProgress = 0,
  });

  QuestionModel? get currentQuestion =>
      currentIndex < questions.length ? questions[currentIndex] : null;

  bool get isComplete =>
      questions.isNotEmpty && currentIndex >= questions.length;

  double get accuracy =>
      totalAnswered > 0 ? correctCount / totalAnswered : 0;

  List<QuestionModel> get wrongQuestions {
    final wrong = <QuestionModel>[];
    for (final record in answerRecords) {
      if (!record.isCorrect && record.questionIndex < questions.length) {
        wrong.add(questions[record.questionIndex]);
      }
    }
    return wrong;
  }

  bool get hasWrongAnswers => answerRecords.any((r) => !r.isCorrect);

  QuizState copyWith({
    List<QuestionModel>? questions,
    int? currentIndex,
    Object? selectedOptionIndex = _absent,
    bool? hasSubmitted,
    bool? isLoading,
    bool? isGenerating,
    Object? errorMessage = _absent,
    Object? tutorResponse = _absent,
    int? correctCount,
    int? totalAnswered,
    List<QuizAnswerRecord>? answerRecords,
    bool? isReviewMode,
    int? generationProgress,
  }) {
    return QuizState(
      questions: questions ?? this.questions,
      currentIndex: currentIndex ?? this.currentIndex,
      selectedOptionIndex: selectedOptionIndex is _Absent
          ? this.selectedOptionIndex
          : selectedOptionIndex as int?,
      hasSubmitted: hasSubmitted ?? this.hasSubmitted,
      isLoading: isLoading ?? this.isLoading,
      isGenerating: isGenerating ?? this.isGenerating,
      errorMessage: errorMessage is _Absent
          ? this.errorMessage
          : errorMessage as String?,
      tutorResponse: tutorResponse is _Absent
          ? this.tutorResponse
          : tutorResponse as Map<String, dynamic>?,
      correctCount: correctCount ?? this.correctCount,
      totalAnswered: totalAnswered ?? this.totalAnswered,
      answerRecords: answerRecords ?? this.answerRecords,
      isReviewMode: isReviewMode ?? this.isReviewMode,
      generationProgress: generationProgress ?? this.generationProgress,
    );
  }
}

// ── Quiz notifier ───────────────────────────────────────────────────────────

class QuizNotifier extends StateNotifier<QuizState> {
  final Ref _ref;
  final Stopwatch _questionStopwatch = Stopwatch();

  QuizNotifier(this._ref) : super(const QuizState());

  /// Set an error message without loading questions.
  void setError(String message) {
    state = const QuizState().copyWith(errorMessage: message);
  }

  /// Load questions for a quiz session.
  ///
  /// Flow:
  /// 1. Try getQuiz — if questions exist, show them immediately.
  /// 2. If empty and sectionId provided — call generateQuestions.
  /// 3. If generateQuestions returns inline questions — show them instantly.
  /// 4. If background queued — enter generating state for polling.
  Future<void> loadQuestions({
    required String courseId,
    String? sectionId,
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
        mode: mode,
        count: count,
      );

      final rawQuestions = result['questions'] as List<dynamic>? ?? [];
      final questions = _parseQuestions(rawQuestions);

      if (questions.isNotEmpty) {
        _startQuiz(questions);
        return;
      }

      // No questions exist — trigger generation if we have a section
      if (sectionId != null) {
        await _triggerGeneration(
          courseId: courseId,
          sectionId: sectionId,
          count: count,
        );
        return;
      }

      // sectionId is null (all-sections quiz) — find first analyzed section
      // and auto-generate questions from it
      final firestoreService = _ref.read(firestoreServiceProvider);
      final sections = await firestoreService
          .watchSectionsByCourse(uid, courseId)
          .first;
      final analyzedSection = sections
          .where((s) => s.aiStatus == 'ANALYZED')
          .toList();

      if (analyzedSection.isNotEmpty) {
        await _triggerGeneration(
          courseId: courseId,
          sectionId: analyzedSection.first.id,
          count: count,
        );
        return;
      }

      state = state.copyWith(
        isLoading: false,
        errorMessage: sections.isEmpty
            ? 'No sections processed yet. Upload files and wait for processing to complete.'
            : 'Sections are still being analyzed. Please try again shortly.',
      );
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        isLoading: false,
        errorMessage: ErrorHandler.userMessage(e),
      );
    }
  }

  /// Trigger question generation and handle inline vs async responses.
  Future<void> _triggerGeneration({
    required String courseId,
    required String sectionId,
    int count = 10,
  }) async {
    state = state.copyWith(isLoading: false, isGenerating: true, errorMessage: null);

    try {
      final functionsService = _ref.read(cloudFunctionsServiceProvider);
      final result = await functionsService.generateQuestions(
        courseId: courseId,
        sectionId: sectionId,
        count: count,
      );

      // Check if questions were generated inline — the v2 fast path
      final inlineQuestions = result['questions'] as List<dynamic>? ?? [];
      if (inlineQuestions.isNotEmpty) {
        final questions = _parseQuestions(inlineQuestions);
        if (questions.isNotEmpty) {
          _startQuiz(questions);
          return;
        }
      }

      // If background job was queued, wait a few seconds then fetch
      final backgroundQueued = result['backgroundQueued'] as bool? ?? false;
      if (backgroundQueued) {
        // Poll up to 3 times with increasing delay for background generation
        for (var attempt = 0; attempt < 3; attempt++) {
          await Future.delayed(Duration(seconds: 5 + attempt * 5));
          final pollResult = await functionsService.getQuiz(
            courseId: courseId,
            sectionId: sectionId,
            mode: 'section',
            count: count,
          );
          final polled = _parseQuestions(
              pollResult['questions'] as List<dynamic>? ?? []);
          if (polled.isNotEmpty) {
            _startQuiz(polled);
            return;
          }
        }
      }

      // Always try to fetch questions — they may exist from cache or
      // from a previous generation that the inline response didn't include
      state = state.copyWith(isGenerating: false, isLoading: true);
      final fetchResult = await functionsService.getQuiz(
        courseId: courseId,
        sectionId: sectionId,
        mode: 'section',
        count: count,
      );
      final fetched =
          _parseQuestions(fetchResult['questions'] as List<dynamic>? ?? []);
      if (fetched.isNotEmpty) {
        _startQuiz(fetched);
        return;
      }

      // Also try mixed mode (all sections) as fallback
      final mixedResult = await functionsService.getQuiz(
        courseId: courseId,
        mode: 'mixed',
        count: count,
      );
      final mixed =
          _parseQuestions(mixedResult['questions'] as List<dynamic>? ?? []);
      if (mixed.isNotEmpty) {
        _startQuiz(mixed);
        return;
      }

      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Questions are still being generated. Please try again in a moment.',
      );
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        isGenerating: false,
        isLoading: false,
        errorMessage: ErrorHandler.userMessage(e),
      );
    }
  }

  List<QuestionModel> _parseQuestions(List<dynamic> raw) {
    return raw
        .whereType<Map>()
        .map((q) {
          try {
            return QuestionModel.fromJson(_deepCastMap(q));
          } catch (_) {
            return null;
          }
        })
        .whereType<QuestionModel>()
        .where((q) => q.stem.isNotEmpty && q.options.isNotEmpty)
        .toList();
  }

  /// Recursively cast all nested Maps to Map<String, dynamic>.
  /// Firebase callable responses return Maps as Map<Object?, Object?>
  /// which causes `as Map<String, dynamic>` casts to throw in generated code.
  static Map<String, dynamic> _deepCastMap(Map map) {
    return map.map<String, dynamic>((key, value) {
      return MapEntry(key.toString(), _deepCastValue(value));
    });
  }

  static dynamic _deepCastValue(dynamic value) {
    if (value is Map) return _deepCastMap(value);
    if (value is List) return value.map(_deepCastValue).toList();
    return value;
  }

  void _startQuiz(List<QuestionModel> questions) {
    final shuffled = List<QuestionModel>.from(questions)..shuffle();
    state = QuizState(
      questions: shuffled,
      currentIndex: 0,
      isLoading: false,
      isGenerating: false,
    );
    _questionStopwatch
      ..reset()
      ..start();
  }

  void selectOption(int index) {
    if (state.hasSubmitted) return;
    state = state.copyWith(selectedOptionIndex: index);
  }

  Future<void> submitAnswer({int? confidence}) async {
    final question = state.currentQuestion;
    final selectedIndex = state.selectedOptionIndex;
    if (question == null || selectedIndex == null) return;

    _questionStopwatch.stop();
    final timeSpentSec = _questionStopwatch.elapsed.inSeconds;

    state = state.copyWith(hasSubmitted: true, isLoading: true, selectedOptionIndex: selectedIndex);

    final safeCorrectIndex = question.options.isNotEmpty
        ? question.correctIndex.clamp(0, question.options.length - 1)
        : 0;
    final isCorrect = selectedIndex == safeCorrectIndex;

    final record = QuizAnswerRecord(
      questionIndex: state.currentIndex,
      selectedIndex: selectedIndex,
      isCorrect: isCorrect,
      timeSpentSec: timeSpentSec,
      confidence: confidence,
    );

    try {
      final functionsService = _ref.read(cloudFunctionsServiceProvider);
      final result = await functionsService.submitAttempt(
        questionId: question.id,
        answerIndex: selectedIndex,
        timeSpentSec: timeSpentSec,
        confidence: confidence,
      );

      final tutorData = result['tutorResponse'];
      state = state.copyWith(
        isLoading: false,
        correctCount: state.correctCount + (isCorrect ? 1 : 0),
        totalAnswered: state.totalAnswered + 1,
        answerRecords: [...state.answerRecords, record],
        tutorResponse: isCorrect
            ? null
            : (tutorData is Map
                ? Map<String, dynamic>.from(tutorData)
                : null),
      );
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        isLoading: false,
        correctCount: state.correctCount + (isCorrect ? 1 : 0),
        totalAnswered: state.totalAnswered + 1,
        answerRecords: [...state.answerRecords, record],
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

  /// Enter review mode: re-quiz only the questions the user got wrong.
  void reviewMistakes() {
    final wrong = state.wrongQuestions;
    if (wrong.isEmpty) return;

    final shuffled = List<QuestionModel>.from(wrong)..shuffle();
    state = QuizState(
      questions: shuffled,
      isReviewMode: true,
    );
    _questionStopwatch
      ..reset()
      ..start();
  }
}

final quizProvider =
    StateNotifierProvider.autoDispose<QuizNotifier, QuizState>((ref) {
  return QuizNotifier(ref);
});
