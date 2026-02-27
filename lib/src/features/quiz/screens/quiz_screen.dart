import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/user_provider.dart';
import '../../home/providers/home_provider.dart';
import '../providers/quiz_provider.dart';
import '../widgets/explanation_panel.dart';
import '../widgets/flag_question_dialog.dart';
import '../widgets/option_button.dart';
import '../widgets/question_card.dart';
import '../widgets/source_citation_drawer.dart';

class QuizScreen extends ConsumerStatefulWidget {
  final String? sectionId;
  final String mode;
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final courseId = ref.read(activeCourseIdProvider);
      if (courseId != null) {
        final sectionId =
            widget.sectionId == '_all' ? null : widget.sectionId;
        ref.read(quizProvider.notifier).loadQuestions(
              courseId: courseId,
              sectionId: sectionId,
              topicTag: widget.topicTag,
              mode: widget.mode,
            );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final quiz = ref.watch(quizProvider);

    // Loading state
    if (quiz.isLoading && quiz.questions.isEmpty) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Error state
    if (quiz.errorMessage != null) {
      return _ErrorView(
        errorMessage: quiz.errorMessage!,
        onRetry: () {
          final courseId = ref.read(activeCourseIdProvider);
          if (courseId != null) {
            final sectionId =
                widget.sectionId == '_all' ? null : widget.sectionId;
            ref.read(quizProvider.notifier).loadQuestions(
                  courseId: courseId,
                  sectionId: sectionId,
                  topicTag: widget.topicTag,
                  mode: widget.mode,
                );
          }
        },
      );
    }

    // Empty state
    if (quiz.questions.isEmpty) {
      return _EmptyView(onBack: () => context.pop());
    }

    // Results state
    if (quiz.isComplete) {
      return _ResultsView(quiz: quiz);
    }

    final question = quiz.currentQuestion;
    if (question == null) {
      return const Scaffold(
        body: Center(child: Text('No questions available')),
      );
    }

    final progress =
        (quiz.currentIndex + 1) / quiz.questions.length;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isAnswered = quiz.isCurrentAnswered;
    final isCorrect = quiz.isCurrentCorrect;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar (matches web glass-card header) ──────────────
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurface
                    : AppColors.surface,
                border: Border(
                  bottom: BorderSide(
                    color: isDark
                        ? AppColors.darkBorder
                        : AppColors.border,
                    width: 0.5,
                  ),
                ),
              ),
              child: Column(
                children: [
                  // Breadcrumb row
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => context.pop(),
                        child: Text(
                          'Practice',
                          style: TextStyle(
                            fontSize: 14,
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Text(
                          '/',
                          style: TextStyle(
                            fontSize: 14,
                            color: isDark
                                ? AppColors.darkBorder
                                : AppColors.border,
                          ),
                        ),
                      ),
                      Text(
                        'Quiz',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary,
                        ),
                      ),
                      if (widget.mode != 'section') ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppColors.darkSurfaceVariant
                                : AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _modeLabel(widget.mode),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      // Source citation
                      GestureDetector(
                        onTap: () => SourceCitationDrawer.show(
                          context,
                          question: question,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(
                            Icons.source_outlined,
                            size: 18,
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      // Flag question
                      GestureDetector(
                        onTap: () => FlagQuestionDialog.show(
                          context,
                          questionId: question.id,
                          onSubmit: (questionId, reason) => ref
                              .read(cloudFunctionsServiceProvider)
                              .flagQuestion(
                                  questionId: questionId, reason: reason),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(
                            Icons.flag_outlined,
                            size: 18,
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      // End quiz button (shown after 2+ answers, matches web)
                      if (quiz.totalAnswered >= 2) ...[
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => _showEndDialog(context),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.stop_rounded,
                                  size: 12,
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'End Quiz',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(5),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.surfaceVariant,
                      color: AppColors.primary,
                      minHeight: 6,
                    ),
                  ),
                ],
              ),
            ),

            // ── Scrollable content ─────────────────────────────────
            Expanded(
              child: ListView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                children: [
                  // Question card — inside a Card-like container (matches web)
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkSurface
                          : AppColors.surface,
                      border: Border.all(
                        color: isDark
                            ? AppColors.darkBorder
                            : AppColors.border,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: isDark
                          ? null
                          : [
                              BoxShadow(
                                color:
                                    Colors.black.withValues(alpha: 0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Stem + meta
                        QuestionCard(
                          question: question,
                          currentIndex: quiz.currentIndex,
                          totalQuestions: quiz.questions.length,
                        ),

                        const SizedBox(height: 20),

                        // ── Options (one-tap submit) ─────────────
                        ...question.options.asMap().entries.map((entry) {
                          final i = entry.key;
                          final option = entry.value;
                          final safeCorrectIndex =
                              question.correctIndex.clamp(
                                  0, question.options.length - 1);

                          return OptionButton(
                            index: i,
                            text: option,
                            isSelected:
                                quiz.selectedOptionIndex == i,
                            isCorrectOption: i == safeCorrectIndex,
                            isAnswered: isAnswered,
                            isPending:
                                quiz.pendingOptionIndex == i &&
                                    quiz.isSubmitting,
                            onTap: () => ref
                                .read(quizProvider.notifier)
                                .answerQuestion(i),
                          );
                        }),

                        // ── Post-answer section ──────────────────
                        if (isAnswered) ...[
                          const SizedBox(height: 12),

                          // Result banner (matches web)
                          _ResultBanner(
                            isCorrect: isCorrect == true,
                            correctIndex: question.correctIndex
                                .clamp(0, question.options.length - 1),
                          ),

                          const SizedBox(height: 12),

                          // Explanation toggle
                          ExplanationPanel(
                            question: question,
                            selectedIndex:
                                quiz.selectedOptionIndex ?? 0,
                            tutorResponse: quiz.tutorResponse,
                          ),

                          // AI Tutor button
                          if (quiz.tutorResponse == null) ...[
                            const SizedBox(height: 8),
                            _TutorButton(
                              isLoading: quiz.isLoading,
                              hasAttemptId: quiz.attemptIds
                                  .containsKey(question.id),
                              onTap: () => ref
                                  .read(quizProvider.notifier)
                                  .requestTutorHelp(),
                            ),
                          ],

                          // Tutor response
                          if (quiz.tutorResponse != null) ...[
                            const SizedBox(height: 8),
                            _TutorResponseCard(
                              tutorResponse: quiz.tutorResponse!,
                              correctOptionText:
                                  question.options.isNotEmpty
                                      ? question.options[
                                          question.correctIndex.clamp(
                                              0,
                                              question.options.length -
                                                  1)]
                                      : '',
                              isDark: isDark,
                            ),
                          ],

                          const SizedBox(height: 16),

                          // Next / Finish button (right-aligned, matches web)
                          Align(
                            alignment: Alignment.centerRight,
                            child: SizedBox(
                              height: 40,
                              child: ElevatedButton(
                                onPressed: () {
                                  HapticFeedback.lightImpact();
                                  if (quiz.isLast) {
                                    ref
                                        .read(quizProvider.notifier)
                                        .finishQuiz();
                                  } else {
                                    ref
                                        .read(quizProvider.notifier)
                                        .nextQuestion();
                                  }
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 20),
                                  shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(10),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      quiz.isLast
                                          ? 'Finish Quiz'
                                          : 'Next Question',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                        Icons.chevron_right_rounded,
                                        size: 18),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showEndDialog(BuildContext context) {
    final quiz = ref.read(quizProvider);
    final remaining = quiz.questions.length - quiz.totalAnswered;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End quiz early?'),
        content: Text(
          "You've answered ${quiz.totalAnswered} of ${quiz.questions.length} questions."
          '${remaining > 0 ? ' $remaining question${remaining == 1 ? " remains" : "s remain"} unanswered.' : ''}'
          " You'll see your results and a weak-point breakdown.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Going'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(quizProvider.notifier).finishQuizEarly();
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('End Quiz'),
          ),
        ],
      ),
    );
  }

  String _modeLabel(String mode) {
    switch (mode) {
      case 'section':
        return 'Section Quiz';
      case 'topic':
        return 'Topic Quiz';
      case 'mixed':
        return 'Smart Mix';
      case 'random':
        return 'Random';
      default:
        return mode;
    }
  }
}

// ── Result banner (matches web's result banner) ─────────────────────────────

class _ResultBanner extends StatelessWidget {
  final bool isCorrect;
  final int correctIndex;

  const _ResultBanner({
    required this.isCorrect,
    required this.correctIndex,
  });

  static const _emerald = Color(0xFF10B981);
  static const _amber = Color(0xFFF59E0B);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bgColor = isCorrect
        ? (isDark
            ? _emerald.withValues(alpha: 0.10)
            : const Color(0xFFECFDF5))
        : (isDark
            ? _amber.withValues(alpha: 0.10)
            : const Color(0xFFFFFBEB));
    final textColor = isCorrect
        ? (isDark ? const Color(0xFF6EE7B7) : const Color(0xFF047857))
        : (isDark ? const Color(0xFFFCD34D) : const Color(0xFFB45309));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(
            isCorrect
                ? Icons.check_circle_rounded
                : Icons.lightbulb_outline_rounded,
            size: 16,
            color: textColor,
          ),
          const SizedBox(width: 10),
          Text(
            isCorrect
                ? 'Correct'
                : 'The answer is ${String.fromCharCode(65 + correctIndex)}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tutor button ────────────────────────────────────────────────────────────

class _TutorButton extends StatelessWidget {
  final bool isLoading;
  final bool hasAttemptId;
  final VoidCallback onTap;

  const _TutorButton({
    required this.isLoading,
    required this.hasAttemptId,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return OutlinedButton(
      onPressed: isLoading || !hasAttemptId ? null : onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        minimumSize: Size.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        side: BorderSide(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isLoading) ...[
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'Thinking…',
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ] else ...[
            Icon(
              Icons.lightbulb_outline_rounded,
              size: 16,
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              'Ask AI Tutor',
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppColors.darkTextPrimary
                    : AppColors.textPrimary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Tutor response card ─────────────────────────────────────────────────────

class _TutorResponseCard extends StatelessWidget {
  final Map<String, dynamic> tutorResponse;
  final String correctOptionText;
  final bool isDark;

  const _TutorResponseCard({
    required this.tutorResponse,
    required this.correctOptionText,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final correctAnswer =
        tutorResponse['correctAnswer'] as String? ?? correctOptionText;
    final whyCorrect =
        tutorResponse['whyCorrect'] as String? ?? 'No detail provided.';
    final whyStudentWrong = tutorResponse['whyStudentWrong'] as String?;
    final keyTakeaway = tutorResponse['keyTakeaway'] as String?;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.05),
              border: Border(
                bottom: BorderSide(
                  color: AppColors.primary.withValues(alpha: 0.1),
                ),
              ),
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(12)),
            ),
            child: Row(
              children: [
                Icon(Icons.lightbulb_rounded,
                    size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  'AI Tutor',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Correct answer
                _TutorSection(
                  icon: Icons.check_circle_rounded,
                  iconColor: AppColors.success,
                  label: 'CORRECT ANSWER',
                  content: correctAnswer,
                  isDark: isDark,
                ),
                const SizedBox(height: 16),

                // Explanation
                _TutorSection(
                  icon: Icons.menu_book_rounded,
                  iconColor: AppColors.primary,
                  label: 'EXPLANATION',
                  content: whyCorrect,
                  isDark: isDark,
                ),

                if (whyStudentWrong != null) ...[
                  const SizedBox(height: 16),
                  _TutorSection(
                    icon: Icons.warning_amber_rounded,
                    iconColor: const Color(0xFFF59E0B),
                    label: 'WHY THAT OPTION WAS TEMPTING',
                    content: whyStudentWrong,
                    isDark: isDark,
                  ),
                ],

                if (keyTakeaway != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color:
                          AppColors.primary.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: _TutorSection(
                      icon: Icons.auto_awesome_rounded,
                      iconColor: AppColors.primary,
                      label: 'CLINICAL TAKEAWAY',
                      content: keyTakeaway,
                      isDark: isDark,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TutorSection extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String content;
  final bool isDark;

  const _TutorSection({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.content,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 16, color: iconColor),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                content,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Results View ────────────────────────────────────────────────────────────

class _ResultsView extends StatelessWidget {
  final QuizState quiz;

  const _ResultsView({required this.quiz});

  @override
  Widget build(BuildContext context) {
    final percent = (quiz.accuracy * 100).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final skipped = quiz.questions.length - quiz.totalAnswered;

    final Color ringColor;
    if (percent >= 80) {
      ringColor = const Color(0xFF10B981);
    } else if (percent >= 50) {
      ringColor = const Color(0xFFF59E0B);
    } else {
      ringColor = const Color(0xFFEF4444);
    }

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          children: [
            // Main results card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Text(
                    quiz.endedEarly ? 'Quiz Ended Early' : 'Quiz Complete',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Score ring
                  SizedBox(
                    width: 120,
                    height: 120,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CircularProgressIndicator(
                          value: quiz.accuracy,
                          strokeWidth: 8,
                          backgroundColor: isDark
                              ? AppColors.darkSurfaceVariant
                              : AppColors.surfaceVariant,
                          color: ringColor,
                          strokeCap: StrokeCap.round,
                        ),
                        Center(
                          child: Text(
                            '$percent%',
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              color: ringColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Score text
                  RichText(
                    text: TextSpan(
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                      children: [
                        TextSpan(
                          text: '${quiz.correctCount}',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                        ),
                        const TextSpan(text: ' out of '),
                        TextSpan(
                          text: '${quiz.totalAnswered}',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                        ),
                        const TextSpan(text: ' correct'),
                        if (skipped > 0) ...[
                          TextSpan(
                            text: ' ($skipped skipped)',
                            style: TextStyle(
                              color: isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Question recap
                  ...quiz.questions.asMap().entries.map((entry) {
                    final i = entry.key;
                    final q = entry.value;
                    final wasAnswered = quiz.answers.containsKey(q.id);
                    final wasCorrect = quiz.results[q.id] == true;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.darkSurface.withValues(alpha: 0.65)
                            : AppColors.surface.withValues(alpha: 0.65),
                        border: Border.all(
                          color: isDark
                              ? AppColors.darkBorder.withValues(alpha: 0.6)
                              : AppColors.border.withValues(alpha: 0.6),
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Opacity(
                        opacity: wasAnswered ? 1.0 : 0.5,
                        child: Row(
                          children: [
                            if (wasAnswered)
                              Icon(
                                wasCorrect
                                    ? Icons.check_circle_rounded
                                    : Icons.cancel_rounded,
                                size: 16,
                                color: wasCorrect
                                    ? AppColors.success
                                    : AppColors.error,
                              )
                            else
                              Container(
                                width: 16,
                                height: 16,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: isDark
                                        ? AppColors.darkBorder
                                        : AppColors.border,
                                    width: 2,
                                  ),
                                ),
                              ),
                            const SizedBox(width: 8),
                            Text(
                              'Q${i + 1}:',
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.textSecondary,
                                fontFeatures: const [
                                  FontFeature.tabularFigures()
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                q.stem,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isDark
                                      ? AppColors.darkTextPrimary
                                      : AppColors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),

                  const SizedBox(height: 20),

                  // Action buttons (matches web)
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => context.pop(),
                          icon: const Icon(Icons.home_rounded, size: 16),
                          label: const Text('Back'),
                          style: OutlinedButton.styleFrom(
                            padding:
                                const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            // Pop and let user restart
                            context.pop();
                          },
                          icon: const Icon(Icons.refresh_rounded, size: 16),
                          label: const Text('Retry'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding:
                                const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Error / Empty views ─────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  final String errorMessage;
  final VoidCallback onRetry;

  const _ErrorView({required this.errorMessage, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppColors.darkSurface
                  : AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppColors.darkBorder
                    : AppColors.border,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  errorMessage,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.error,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  final VoidCallback onBack;

  const _EmptyView({required this.onBack});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.quiz_outlined,
                size: 48,
                color: isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary,
              ),
              const SizedBox(height: 16),
              Text(
                'No section selected',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Pick a section from the Practice page to start quizzing.',
                style: TextStyle(
                  fontSize: 14,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: onBack,
                style: OutlinedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Go to Practice'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
