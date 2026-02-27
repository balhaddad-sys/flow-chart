// FILE: lib/src/features/quiz/screens/quiz_screen.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/haptic_service.dart';
import '../../home/providers/home_provider.dart';
import '../../results/screens/results_screen.dart';
import '../providers/quiz_provider.dart';
import '../widgets/explanation_panel.dart';
import '../widgets/flag_question_dialog.dart';
import '../widgets/option_button.dart';
import '../widgets/question_card.dart';

class QuizScreen extends ConsumerStatefulWidget {
  final String? sectionId; // '_all' means all sections
  final String mode; // 'section', 'smart', 'random', 'assessment'
  final String? topicTag;

  const QuizScreen({
    super.key,
    this.sectionId,
    this.mode = 'section',
    this.topicTag,
  });

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  // Per-question stopwatch (resets on nextQuestion)
  final Stopwatch _questionTimer = Stopwatch();
  Timer? _uiTimer;
  int _elapsedSeconds = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQuestions();
    });
  }

  void _loadQuestions() {
    final courseId = ref.read(activeCourseIdProvider);
    if (courseId == null || courseId.isEmpty) return;
    final sectionId = widget.sectionId == '_all' ? null : widget.sectionId;
    ref.read(quizProvider.notifier).loadQuestions(
          courseId: courseId,
          sectionId: sectionId,
          topicTag: widget.topicTag,
          mode: widget.mode,
        );
    _startTimer();
  }

  void _startTimer() {
    _questionTimer
      ..reset()
      ..start();
    _uiTimer?.cancel();
    _uiTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _elapsedSeconds = _questionTimer.elapsed.inSeconds);
      }
    });
  }

  void _resetTimer() {
    _questionTimer
      ..reset()
      ..start();
    setState(() => _elapsedSeconds = 0);
  }

  @override
  void dispose() {
    _uiTimer?.cancel();
    _questionTimer.stop();
    super.dispose();
  }

  void _handleAnswer(int optionIndex) {
    HapticService.medium();
    // QuizNotifier tracks elapsed time internally via its own Stopwatch.
    ref.read(quizProvider.notifier).answerQuestion(optionIndex);
  }

  void _handleNext() {
    final quiz = ref.read(quizProvider);
    if (quiz.isLast) {
      _finishQuiz();
    } else {
      ref.read(quizProvider.notifier).nextQuestion();
      _resetTimer();
    }
  }

  void _finishQuiz() {
    HapticService.success();
    _uiTimer?.cancel();
    final quiz = ref.read(quizProvider);
    // Gather weak topics from incorrectly answered questions
    final weakTopics = <String>{};
    for (final q in quiz.questions) {
      final correct = quiz.results[q.id];
      if (correct == false) {
        weakTopics.addAll(q.topicTags);
      }
    }
    final courseId = ref.read(activeCourseIdProvider) ?? '';
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => ResultsScreen(
          correct: quiz.correctCount,
          total: quiz.totalAnswered,
          weakTopics: weakTopics.toList(),
          courseId: courseId,
        ),
      ),
    );
  }

  void _confirmEndEarly() {
    showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End Quiz?'),
        content: const Text(
          'Your progress will be saved, but unanswered questions will be skipped.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Continue'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('End Now'),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
          ),
        ],
      ),
    ).then((confirmed) {
      if (confirmed == true) {
        ref.read(quizProvider.notifier).finishQuizEarly();
        _finishQuiz();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final quiz = ref.watch(quizProvider);

    // ── Loading ─────────────────────────────────────────────────────────────
    if (quiz.isLoading && quiz.questions.isEmpty) {
      return Scaffold(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        body: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: AppColors.primary),
              SizedBox(height: 16),
              Text(
                'Loading questions...',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    // ── Error ───────────────────────────────────────────────────────────────
    if (quiz.errorMessage != null && quiz.questions.isEmpty) {
      return Scaffold(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline_rounded,
                    size: 48,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary),
                const SizedBox(height: 16),
                Text(
                  quiz.errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _loadQuestions,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retry'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // ── Empty / complete ────────────────────────────────────────────────────
    if (quiz.questions.isEmpty) {
      return Scaffold(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.quiz_outlined,
                    size: 48,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary),
                const SizedBox(height: 16),
                Text(
                  'No questions available.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Generate questions from the Practice screen first.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final question = quiz.currentQuestion;
    if (question == null) return const SizedBox.shrink();

    final isAnswered = quiz.isCurrentAnswered;
    final selectedIndex = quiz.selectedOptionIndex;
    final isCorrect = quiz.isCurrentCorrect;
    final safeCorrectIndex = question.options.isNotEmpty
        ? question.correctIndex.clamp(0, question.options.length - 1)
        : 0;
    final progress =
        quiz.questions.isNotEmpty ? quiz.currentIndex / quiz.questions.length : 0.0;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // ── App bar area ─────────────────────────────────────────────────
            _QuizAppBar(
              currentIndex: quiz.currentIndex,
              total: quiz.questions.length,
              elapsedSeconds: _elapsedSeconds,
              isDark: isDark,
              onClose: _confirmEndEarly,
            ),

            // ── Progress bar ─────────────────────────────────────────────────
            LinearProgressIndicator(
              value: progress,
              backgroundColor: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.primary),
              minHeight: 3,
            ),

            // ── Scrollable body ──────────────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Question card
                    _QuizCard(
                      isDark: isDark,
                      child: QuestionCard(
                        question: question,
                        currentIndex: quiz.currentIndex,
                        totalQuestions: quiz.questions.length,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Options
                    ...List.generate(question.options.length, (i) {
                      OptionState state;
                      if (!isAnswered) {
                        state = OptionState.idle;
                      } else if (i == safeCorrectIndex) {
                        state = OptionState.correct;
                      } else if (i == selectedIndex) {
                        state = OptionState.wrong;
                      } else {
                        state = OptionState.unselected;
                      }

                      return OptionButton(
                        index: i,
                        text: question.options[i],
                        state: state,
                        onTap: state == OptionState.idle
                            ? () => _handleAnswer(i)
                            : null,
                      );
                    }),

                    // Explanation (auto-expands after answering)
                    if (isAnswered) ...[
                      const SizedBox(height: 8),
                      ExplanationPanel(
                        question: question,
                        selectedIndex: selectedIndex ?? safeCorrectIndex,
                        tutorResponse: quiz.tutorResponse,
                        isCorrect: isCorrect ?? false,
                        onTutorHelp: () async {
                          await ref
                              .read(quizProvider.notifier)
                              .requestTutorHelp();
                          if (mounted && quiz.tutorResponse != null) {
                            _showTutorDialog(context, quiz.tutorResponse!,
                                isDark: isDark);
                          }
                        },
                        onFlag: () => FlagQuestionDialog.show(
                          context,
                          questionId: question.id,
                          onSubmit: (qId, reason) => ref
                              .read(cloudFunctionsServiceProvider)
                              .flagQuestion(questionId: qId, reason: reason),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Next / Finish button
                    if (isAnswered)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _handleNext,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusMd),
                            ),
                            textStyle: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w600),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(quiz.isLast
                                  ? 'Finish Quiz'
                                  : 'Next Question'),
                              const SizedBox(width: 6),
                              Icon(
                                quiz.isLast
                                    ? Icons.check_circle_outline_rounded
                                    : Icons.arrow_forward_rounded,
                                size: 18,
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showTutorDialog(
    BuildContext context,
    Map<String, dynamic> tutorResponse, {
    required bool isDark,
  }) {
    final explanation = tutorResponse['explanation'] as String? ?? '';
    final tips = tutorResponse['studyTips'] as List<dynamic>? ?? [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.92,
        minChildSize: 0.35,
        expand: false,
        builder: (ctx, scrollCtrl) => Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          child: ListView(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.secondary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.auto_awesome_rounded,
                        size: 16, color: AppColors.secondary),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AI Tutor',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        'Personalised explanation',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (explanation.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: Text(
                    explanation,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.6,
                      color: isDark
                          ? AppColors.darkTextPrimary
                          : AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
              if (tips.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  'STUDY TIPS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 8),
                ...tips.map((tip) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.tips_and_updates_rounded,
                              size: 14, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              tip.toString(),
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.5,
                                color: isDark
                                    ? AppColors.darkTextPrimary
                                        .withValues(alpha: 0.9)
                                    : AppColors.textPrimary
                                        .withValues(alpha: 0.9),
                              ),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Quiz app bar ──────────────────────────────────────────────────────────────

class _QuizAppBar extends StatelessWidget {
  final int currentIndex;
  final int total;
  final int elapsedSeconds;
  final bool isDark;
  final VoidCallback onClose;

  const _QuizAppBar({
    required this.currentIndex,
    required this.total,
    required this.elapsedSeconds,
    required this.isDark,
    required this.onClose,
  });

  String _fmt(int s) {
    final m = s ~/ 60;
    final sec = s % 60;
    return '${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.border,
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(
              Icons.close_rounded,
              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
            ),
            onPressed: onClose,
            tooltip: 'End quiz',
          ),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Question ${currentIndex + 1} / $total',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          // Timer chip
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.timer_outlined,
                  size: 13,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Text(
                  _fmt(elapsedSeconds),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }
}

// ── Quiz card container ───────────────────────────────────────────────────────

class _QuizCard extends StatelessWidget {
  final bool isDark;
  final Widget child;

  const _QuizCard({required this.isDark, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: AppSpacing.shadowSm,
      ),
      child: child,
    );
  }
}
