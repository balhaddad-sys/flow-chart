import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/primary_button.dart';
import '../../home/providers/home_provider.dart';
import '../providers/quiz_provider.dart';
import '../widgets/explanation_panel.dart';
import '../widgets/flag_question_dialog.dart';
import '../widgets/question_card.dart';
import '../widgets/source_citation_drawer.dart';

class QuizScreen extends ConsumerStatefulWidget {
  final String? sectionId;
  final String? courseId;
  final String mode;
  final int count;

  const QuizScreen(
      {super.key, this.sectionId, this.courseId, this.mode = 'section', this.count = 10});

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  String? get _courseId => widget.courseId ?? ref.read(activeCourseIdProvider);

  // Per-question timer
  final Stopwatch _stopwatch = Stopwatch();
  Timer? _tickTimer;
  int _elapsedSeconds = 0;

  // Confidence rating: 1=Low, 2=Medium, 3=High
  int? _confidence;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQuiz();
    });
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    _stopwatch.stop();
    super.dispose();
  }

  void _startTimer() {
    _stopwatch
      ..reset()
      ..start();
    _elapsedSeconds = 0;
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsedSeconds = _stopwatch.elapsed.inSeconds);
    });
  }

  void _stopTimer() {
    _stopwatch.stop();
    _tickTimer?.cancel();
  }

  void _loadQuiz() {
    final courseId = _courseId;
    if (courseId == null) {
      ref.read(quizProvider.notifier).state = const QuizState(
        errorMessage: 'Course not found. Please go back and try again.',
      );
      return;
    }
    final sectionId = widget.sectionId == '_all' ? null : widget.sectionId;
    // When sectionId is _all (null), backend requires mode != 'section'
    final mode = (sectionId == null && widget.mode == 'section') ? 'mixed' : widget.mode;
    ref.read(quizProvider.notifier).loadQuestions(
          courseId: courseId,
          sectionId: sectionId,
          mode: mode,
          count: widget.count,
        );
    _startTimer();
  }

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (m > 0) return '$m:${s.toString().padLeft(2, '0')}';
    return '${s}s';
  }

  @override
  Widget build(BuildContext context) {
    final quiz = ref.watch(quizProvider);

    // Start timer when questions first load or question changes
    ref.listen(quizProvider, (prev, next) {
      if (prev?.currentIndex != next.currentIndex && !next.isComplete) {
        _startTimer();
      }
      if (next.hasSubmitted && !(prev?.hasSubmitted ?? false)) {
        _stopTimer();
      }
    });

    if (quiz.isLoading && quiz.questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (quiz.errorMessage != null && quiz.questions.isEmpty) {
      return _ErrorView(
        errorMessage: quiz.errorMessage!,
        onRetry: _loadQuiz,
      );
    }

    if (quiz.questions.isEmpty) {
      if (quiz.isGenerating) {
        return _GeneratingView(onRetry: _loadQuiz);
      }
      return _EmptyView(
        courseId: _courseId,
        sectionId: widget.sectionId,
        onBack: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/practice');
          }
        },
      );
    }

    if (quiz.isComplete) {
      return _ResultsView(quiz: quiz);
    }

    final question = quiz.currentQuestion;
    if (question == null) {
      return const Scaffold(
        body: Center(child: Text('No questions available')),
      );
    }

    final progress = (quiz.currentIndex + 1) / quiz.questions.length;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PopScope(
      canPop: quiz.isComplete || quiz.questions.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Quit Quiz?'),
              content: const Text('Your progress will be lost.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Continue'),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    context.pop();
                  },
                  child: const Text('Quit'),
                ),
              ],
            ),
          );
        }
      },
      child: Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Text(
          quiz.isReviewMode
              ? 'Review ${quiz.currentIndex + 1}/${quiz.questions.length}'
              : 'Question ${quiz.currentIndex + 1} of ${quiz.questions.length}',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor:
                isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
            color: AppColors.primary,
            minHeight: 3,
          ),
        ),
        actions: [
          // Timer chip
          Container(
            margin: const EdgeInsets.only(right: 2),
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: (_elapsedSeconds > 120
                      ? AppColors.error
                      : _elapsedSeconds > 60
                          ? AppColors.warning
                          : AppColors.primary)
                  .withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.timer_outlined,
                  size: 12,
                  color: _elapsedSeconds > 120
                      ? AppColors.error
                      : _elapsedSeconds > 60
                          ? AppColors.warning
                          : AppColors.primary,
                ),
                const SizedBox(width: 3),
                Text(
                  _formatTime(_elapsedSeconds),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _elapsedSeconds > 120
                        ? AppColors.error
                        : _elapsedSeconds > 60
                            ? AppColors.warning
                            : AppColors.primary,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          // Score pill
          Container(
            margin: const EdgeInsets.only(right: 2),
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle,
                    color: AppColors.success, size: 12),
                const SizedBox(width: 3),
                Text(
                  '${quiz.correctCount}/${quiz.totalAnswered}',
                  style: const TextStyle(
                    color: AppColors.success,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          // More menu (sources + flag)
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, size: 20),
            onSelected: (value) {
              if (value == 'sources') {
                SourceCitationDrawer.show(context, question: question);
              } else if (value == 'flag') {
                FlagQuestionDialog.show(
                  context,
                  questionId: question.id,
                  onSubmit: (questionId, reason) => ref
                      .read(cloudFunctionsServiceProvider)
                      .flagQuestion(questionId: questionId, reason: reason),
                );
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'sources',
                child: Row(
                  children: [
                    Icon(Icons.menu_book_rounded, size: 18),
                    SizedBox(width: 10),
                    Text('View Sources'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'flag',
                child: Row(
                  children: [
                    Icon(Icons.flag_outlined, size: 18),
                    SizedBox(width: 10),
                    Text('Flag Question'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                QuestionCard(
                  question: question,
                  selectedIndex: quiz.selectedOptionIndex,
                  hasSubmitted: quiz.hasSubmitted,
                  onOptionSelected: (i) =>
                      ref.read(quizProvider.notifier).selectOption(i),
                  questionNumber: quiz.currentIndex + 1,
                  totalQuestions: quiz.questions.length,
                ),
                if (quiz.hasSubmitted)
                  ExplanationPanel(
                    question: question,
                    selectedIndex: quiz.selectedOptionIndex!,
                    tutorResponse: quiz.tutorResponse,
                  ),
                const SizedBox(height: 12),
              ],
            ),
          ),
          // ── Bottom action bar ──
          Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurface : AppColors.surface,
              border: Border(
                top: BorderSide(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                  width: 0.5,
                ),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ── Confidence selector ──
                  if (quiz.selectedOptionIndex != null && !quiz.hasSubmitted) ...[
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Confidence:', style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
                            fontSize: 11,
                          )),
                          const SizedBox(width: 8),
                          _ConfidenceChip(label: 'Low', value: 1, selected: _confidence == 1, onTap: () => setState(() => _confidence = 1)),
                          const SizedBox(width: 6),
                          _ConfidenceChip(label: 'Med', value: 2, selected: _confidence == 2, onTap: () => setState(() => _confidence = 2)),
                          const SizedBox(width: 6),
                          _ConfidenceChip(label: 'High', value: 3, selected: _confidence == 3, onTap: () => setState(() => _confidence = 3)),
                        ],
                      ),
                    ),
                  ],
                  SizedBox(
                    width: double.infinity,
                    child: !quiz.hasSubmitted
                        ? PrimaryButton(
                            label: 'Submit Answer',
                            onPressed: quiz.selectedOptionIndex != null
                                ? () => ref.read(quizProvider.notifier).submitAnswer(confidence: _confidence)
                                : null,
                            isLoading: quiz.isLoading,
                          )
                        : PrimaryButton(
                            label: quiz.currentIndex < quiz.questions.length - 1
                                ? 'Next Question'
                                : 'View Results',
                            onPressed: () {
                                setState(() => _confidence = null);
                                ref.read(quizProvider.notifier).nextQuestion();
                              },
                            icon: quiz.currentIndex < quiz.questions.length - 1
                                ? Icons.arrow_forward_rounded
                                : Icons.bar_chart_rounded,
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ), // end child: Scaffold
    ); // end PopScope
  }
}

// ── Results ─────────────────────────────────────────────────────────────────

class _ResultsView extends StatelessWidget {
  final QuizState quiz;

  const _ResultsView({required this.quiz});

  @override
  Widget build(BuildContext context) {
    final percent = (quiz.accuracy * 100).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final (grade, gradeColor, scoreLabel, scoreIcon) = _gradeInfo(percent);

    // Difficulty breakdown
    int easyCorrect = 0, easyTotal = 0;
    int medCorrect = 0, medTotal = 0;
    int hardCorrect = 0, hardTotal = 0;

    for (int i = 0; i < quiz.questions.length && i < quiz.answerRecords.length; i++) {
      final q = quiz.questions[i];
      final r = quiz.answerRecords[i];
      if (q.difficulty <= 2) {
        easyTotal++;
        if (r.isCorrect) easyCorrect++;
      } else if (q.difficulty <= 3) {
        medTotal++;
        if (r.isCorrect) medCorrect++;
      } else {
        hardTotal++;
        if (r.isCorrect) hardCorrect++;
      }
    }

    // Average time per question
    final totalTime = quiz.answerRecords.fold<int>(
        0, (sum, r) => sum + r.timeSpentSec);
    final avgTime =
        quiz.answerRecords.isNotEmpty ? totalTime ~/ quiz.answerRecords.length : 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Results'),
        automaticallyImplyLeading: false,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          const SizedBox(height: 16),

          // ── Score hero ──────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  gradeColor.withValues(alpha: isDark ? 0.15 : 0.08),
                  gradeColor.withValues(alpha: isDark ? 0.05 : 0.02),
                ],
              ),
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(
                color: gradeColor.withValues(alpha: 0.2),
              ),
            ),
            child: Column(
              children: [
                // Grade circle
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: gradeColor.withValues(alpha: 0.12),
                    border: Border.all(
                      color: gradeColor.withValues(alpha: 0.3),
                      width: 3,
                    ),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          grade,
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                            color: gradeColor,
                            height: 1,
                          ),
                        ),
                        Text(
                          '$percent%',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: gradeColor.withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(scoreIcon, color: gradeColor, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      scoreLabel,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: gradeColor,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${quiz.correctCount} of ${quiz.totalAnswered} correct',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Stat chips row ──────────────────────────────────────────
          Row(
            children: [
              _MiniStat(
                icon: Icons.timer_outlined,
                label: 'Avg Time',
                value: '${avgTime}s',
                color: AppColors.primary,
                isDark: isDark,
              ),
              const SizedBox(width: 8),
              _MiniStat(
                icon: Icons.check_circle_outline,
                label: 'Correct',
                value: '${quiz.correctCount}',
                color: AppColors.success,
                isDark: isDark,
              ),
              const SizedBox(width: 8),
              _MiniStat(
                icon: Icons.cancel_outlined,
                label: 'Wrong',
                value: '${quiz.totalAnswered - quiz.correctCount}',
                color: AppColors.error,
                isDark: isDark,
              ),
              const SizedBox(width: 8),
              _MiniStat(
                icon: Icons.schedule_rounded,
                label: 'Total',
                value: _formatDuration(totalTime),
                color: AppColors.secondary,
                isDark: isDark,
              ),
            ],
          ),

          // ── Difficulty performance ──────────────────────────────────
          if (easyTotal > 0 || medTotal > 0 || hardTotal > 0) ...[
            const SizedBox(height: 24),
            Text(
              'Performance by Difficulty',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 12),
            if (easyTotal > 0)
              _DifficultyBar(
                label: 'Easy',
                correct: easyCorrect,
                total: easyTotal,
                color: AppColors.difficultyEasy,
                isDark: isDark,
              ),
            if (medTotal > 0)
              _DifficultyBar(
                label: 'Medium',
                correct: medCorrect,
                total: medTotal,
                color: AppColors.difficultyMedium,
                isDark: isDark,
              ),
            if (hardTotal > 0)
              _DifficultyBar(
                label: 'Hard',
                correct: hardCorrect,
                total: hardTotal,
                color: AppColors.difficultyHard,
                isDark: isDark,
              ),
          ],

          // ── Confidence calibration insight ──────────────────────────
          if (_hasConfidenceData(quiz)) ...[
            const SizedBox(height: 24),
            _ConfidenceCalibration(quiz: quiz, isDark: isDark),
          ],

          // ── Per-question breakdown ──────────────────────────────────
          const SizedBox(height: 24),
          Text(
            'Question Breakdown',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 12),
          ...quiz.questions.asMap().entries.map((entry) {
            final i = entry.key;
            final q = entry.value;
            final record =
                i < quiz.answerRecords.length ? quiz.answerRecords[i] : null;
            final isCorrect = record?.isCorrect ?? false;
            final wasAnswered = record != null;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: wasAnswered
                      ? (isCorrect ? AppColors.success : AppColors.error)
                          .withValues(alpha: 0.2)
                      : (isDark ? AppColors.darkBorder : AppColors.border),
                ),
              ),
              child: Row(
                children: [
                  // Result icon
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: wasAnswered
                          ? (isCorrect ? AppColors.success : AppColors.error)
                              .withValues(alpha: 0.12)
                          : (isDark
                              ? AppColors.darkSurfaceVariant
                              : AppColors.surfaceVariant),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: wasAnswered
                          ? Icon(
                              isCorrect
                                  ? Icons.check_rounded
                                  : Icons.close_rounded,
                              color: isCorrect
                                  ? AppColors.success
                                  : AppColors.error,
                              size: 16,
                            )
                          : Text(
                              '${i + 1}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? AppColors.darkTextTertiary
                                    : AppColors.textTertiary,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Stem preview
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          q.stem,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w500,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (q.topicTags.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color:
                                      AppColors.accent.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  q.topicTags.first,
                                  style: const TextStyle(
                                      fontSize: 10, color: AppColors.accent),
                                ),
                              ),
                            if (q.topicTags.isNotEmpty)
                              const SizedBox(width: 6),
                            Icon(
                              Icons.signal_cellular_alt_rounded,
                              size: 10,
                              color: q.difficulty <= 2
                                  ? AppColors.difficultyEasy
                                  : q.difficulty <= 3
                                      ? AppColors.difficultyMedium
                                      : AppColors.difficultyHard,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              q.difficulty <= 2
                                  ? 'Easy'
                                  : q.difficulty <= 3
                                      ? 'Med'
                                      : 'Hard',
                              style: TextStyle(
                                fontSize: 10,
                                color: isDark
                                    ? AppColors.darkTextTertiary
                                    : AppColors.textTertiary,
                              ),
                            ),
                            if (record != null) ...[
                              const SizedBox(width: 6),
                              Icon(Icons.timer_outlined,
                                  size: 10,
                                  color: isDark
                                      ? AppColors.darkTextTertiary
                                      : AppColors.textTertiary),
                              const SizedBox(width: 2),
                              Text(
                                '${record.timeSpentSec}s',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures()
                                  ],
                                  color: isDark
                                      ? AppColors.darkTextTertiary
                                      : AppColors.textTertiary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),

          const SizedBox(height: 24),

          // Review Mistakes button
          if (quiz.hasWrongAnswers && !quiz.isReviewMode)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Consumer(
                builder: (context, ref, _) => SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      HapticFeedback.mediumImpact();
                      ref.read(quizProvider.notifier).reviewMistakes();
                    },
                    icon: const Icon(Icons.replay_rounded, size: 18),
                    label: Text(
                      'Review ${quiz.wrongQuestions.length} Mistake${quiz.wrongQuestions.length == 1 ? '' : 's'}',
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: BorderSide(
                          color: AppColors.error.withValues(alpha: 0.3)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusMd),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          PrimaryButton(
            label: quiz.isReviewMode ? 'Finish Review' : 'Done',
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/practice');
              }
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  static (String grade, Color color, String label, IconData icon) _gradeInfo(
      int percent) {
    if (percent >= 90) {
      return (
        'A+',
        AppColors.success,
        'Outstanding!',
        Icons.workspace_premium_rounded
      );
    }
    if (percent >= 80) {
      return ('A', AppColors.success, 'Excellent!', Icons.emoji_events_rounded);
    }
    if (percent >= 70) {
      return ('B', const Color(0xFF0D9488), 'Well Done', Icons.thumb_up_rounded);
    }
    if (percent >= 60) {
      return ('C', AppColors.warning, 'Good Effort', Icons.trending_up_rounded);
    }
    if (percent >= 50) {
      return ('D', AppColors.warning, 'Needs Work', Icons.auto_fix_high_rounded);
    }
    return ('F', AppColors.error, 'Keep Studying', Icons.school_rounded);
  }

  static bool _hasConfidenceData(QuizState quiz) {
    return quiz.answerRecords.any((r) => r.confidence != null);
  }

  static String _formatDuration(int seconds) {
    if (seconds < 60) return '${seconds}s';
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m}m ${s}s';
  }
}

// ── Confidence calibration insight ──────────────────────────────────────────

class _ConfidenceCalibration extends StatelessWidget {
  final QuizState quiz;
  final bool isDark;

  const _ConfidenceCalibration({required this.quiz, required this.isDark});

  @override
  Widget build(BuildContext context) {
    // Compute calibration stats
    int overconfident = 0; // high confidence but wrong
    int underconfident = 0; // low confidence but correct
    int wellCalibrated = 0; // confidence matched outcome

    for (final record in quiz.answerRecords) {
      if (record.confidence == null) continue;
      if (record.confidence! >= 3 && !record.isCorrect) {
        overconfident++;
      } else if (record.confidence! <= 1 && record.isCorrect) {
        underconfident++;
      } else {
        wellCalibrated++;
      }
    }

    final insights = <Widget>[];

    if (overconfident > 0) {
      insights.add(_CalibrationRow(
        icon: Icons.trending_down_rounded,
        color: AppColors.error,
        text: 'Confident but wrong on $overconfident question${overconfident == 1 ? '' : 's'}',
        isDark: isDark,
      ));
    }

    if (underconfident > 0) {
      insights.add(_CalibrationRow(
        icon: Icons.trending_up_rounded,
        color: AppColors.warning,
        text: 'Unsure but correct on $underconfident question${underconfident == 1 ? '' : 's'}',
        isDark: isDark,
      ));
    }

    if (wellCalibrated > 0 && overconfident == 0 && underconfident == 0) {
      insights.add(_CalibrationRow(
        icon: Icons.check_circle_outline_rounded,
        color: AppColors.success,
        text: 'Your confidence matched your performance — well calibrated!',
        isDark: isDark,
      ));
    }

    if (insights.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Confidence Calibration',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: insights,
          ),
        ),
      ],
    );
  }
}

class _CalibrationRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  final bool isDark;

  const _CalibrationRow({
    required this.icon,
    required this.color,
    required this.text,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w500,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Mini stat card ──────────────────────────────────────────────────────────

class _MiniStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool isDark;

  const _MiniStat({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: isDark ? 0.08 : 0.06),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: color.withValues(alpha: 0.12)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w800,
                fontSize: 16,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Difficulty performance bar ──────────────────────────────────────────────

class _DifficultyBar extends StatelessWidget {
  final String label;
  final int correct;
  final int total;
  final Color color;
  final bool isDark;

  const _DifficultyBar({
    required this.label,
    required this.correct,
    required this.total,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? correct / total : 0.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 8,
                backgroundColor: color.withValues(alpha: isDark ? 0.1 : 0.08),
                color: color,
              ),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 42,
            child: Text(
              '$correct/$total',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Generating view ─────────────────────────────────────────────────────────

class _GeneratingView extends StatefulWidget {
  final VoidCallback onRetry;

  const _GeneratingView({required this.onRetry});

  @override
  State<_GeneratingView> createState() => _GeneratingViewState();
}

class _GeneratingViewState extends State<_GeneratingView>
    with SingleTickerProviderStateMixin {
  static const _intervals = [5, 10, 15, 20, 25, 30];
  int _retryIndex = 0;
  int _secondsLeft = 5;
  Timer? _timer;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _startCountdown();
  }

  int get _currentInterval =>
      _intervals[_retryIndex.clamp(0, _intervals.length - 1)];

  void _startCountdown() {
    _timer?.cancel();
    _secondsLeft = _currentInterval;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) {
        widget.onRetry();
        _retryIndex++;
        _startCountdown();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final checkNumber = _retryIndex + 1;
    final totalChecks = _intervals.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz')),
      body: Center(
        child: SingleChildScrollView(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FadeTransition(
                opacity: Tween<double>(begin: 0.5, end: 1.0)
                    .animate(_pulseController),
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.secondary.withValues(alpha: 0.15),
                        AppColors.primary.withValues(alpha: 0.1),
                      ],
                    ),
                    border: Border.all(
                      color: AppColors.secondary.withValues(alpha: 0.3),
                      width: 2,
                    ),
                  ),
                  child: const Icon(
                    Icons.psychology_rounded,
                    color: AppColors.secondary,
                    size: 40,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Generating Questions',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'AI is preparing your questions.\nThis typically takes 30\u201360 seconds.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                'Generation continues even if you leave this screen.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                      fontSize: 12,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: 180,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    backgroundColor:
                        AppColors.secondary.withValues(alpha: 0.1),
                    color: AppColors.secondary,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Check $checkNumber of $totalChecks \u00b7 Retrying in ${_secondsLeft}s...',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                    ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: 200,
                child: PrimaryButton(
                  label: 'Check Now',
                  onPressed: () {
                    widget.onRetry();
                    _retryIndex++;
                    _startCountdown();
                  },
                  icon: Icons.refresh_rounded,
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: 200,
                child: PrimaryButton(
                  label: 'Go Back',
                  isOutlined: true,
                  onPressed: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/practice');
                    }
                  },
                  icon: Icons.arrow_back_rounded,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Error view ──────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  final String errorMessage;
  final VoidCallback onRetry;

  const _ErrorView({required this.errorMessage, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz')),
      body: Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.error.withValues(alpha: 0.1),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.3),
                    width: 2,
                  ),
                ),
                child: const Icon(Icons.error_outline_rounded,
                    color: AppColors.error, size: 40),
              ),
              const SizedBox(height: 24),
              Text(
                'Unable to Load Quiz',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                errorMessage,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: 200,
                child: PrimaryButton(
                  label: 'Retry',
                  onPressed: onRetry,
                  icon: Icons.refresh_rounded,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Empty view ──────────────────────────────────────────────────────────────

class _EmptyView extends ConsumerStatefulWidget {
  final String? courseId;
  final String? sectionId;
  final VoidCallback onBack;

  const _EmptyView({
    required this.courseId,
    required this.sectionId,
    required this.onBack,
  });

  @override
  ConsumerState<_EmptyView> createState() => _EmptyViewState();
}

class _EmptyViewState extends ConsumerState<_EmptyView> {
  bool _isGenerating = false;

  Future<void> _generateQuestions() async {
    final courseId = widget.courseId;
    final sectionId = widget.sectionId;
    if (courseId == null || sectionId == null || sectionId == '_all') return;

    setState(() => _isGenerating = true);

    try {
      await ref.read(cloudFunctionsServiceProvider).generateQuestions(
            courseId: courseId,
            sectionId: sectionId,
          );
      if (!mounted) return;
      // Reload the quiz to pick up newly generated questions
      ref.read(quizProvider.notifier).loadQuestions(
            courseId: courseId,
            sectionId: sectionId,
          );
    } catch (_) {
      if (!mounted) return;
      setState(() => _isGenerating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to generate questions. Please try again.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canGenerate = widget.courseId != null &&
        widget.sectionId != null &&
        widget.sectionId != '_all';

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz')),
      body: Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.warning.withValues(alpha: 0.1),
                  border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.3),
                    width: 2,
                  ),
                ),
                child: const Icon(Icons.quiz_outlined,
                    color: AppColors.warning, size: 40),
              ),
              const SizedBox(height: 24),
              Text(
                'No Questions Available Yet',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Generate new questions or come back later.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              if (canGenerate)
                SizedBox(
                  width: 240,
                  child: PrimaryButton(
                    label: 'Generate Questions',
                    onPressed: _isGenerating ? null : _generateQuestions,
                    isLoading: _isGenerating,
                    icon: Icons.auto_awesome_rounded,
                  ),
                ),
              if (canGenerate) const SizedBox(height: 12),
              SizedBox(
                width: 240,
                child: PrimaryButton(
                  label: 'Go Back',
                  isOutlined: true,
                  onPressed: widget.onBack,
                  icon: Icons.arrow_back_rounded,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Confidence chip ─────────────────────────────────────────────────────────

class _ConfidenceChip extends StatelessWidget {
  final String label;
  final int value;
  final bool selected;
  final VoidCallback onTap;

  const _ConfidenceChip({required this.label, required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.15) : (isDark ? AppColors.darkSurface : AppColors.surface),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppColors.primary : (isDark ? AppColors.darkBorder : AppColors.border),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            color: selected ? AppColors.primary : (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
          ),
        ),
      ),
    );
  }
}
