import 'package:flutter/material.dart';
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
  final String mode;

  const QuizScreen({super.key, this.sectionId, this.mode = 'section'});

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
              mode: widget.mode,
            );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final quiz = ref.watch(quizProvider);

    if (quiz.isLoading && quiz.questions.isEmpty) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

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
                  mode: widget.mode,
                );
          }
        },
      );
    }

    if (quiz.questions.isEmpty) {
      return _EmptyView(onBack: () {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/practice');
        }
      });
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

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Question ${quiz.currentIndex + 1}/${quiz.questions.length}',
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: isDark
                ? AppColors.darkSurfaceVariant
                : AppColors.surfaceVariant,
            color: AppColors.primary,
            minHeight: 3,
          ),
        ),
        actions: [
          // Source citation button
          IconButton(
            icon: const Icon(Icons.source_outlined, size: 20),
            tooltip: 'View Sources',
            onPressed: () => SourceCitationDrawer.show(
              context,
              question: question,
            ),
          ),
          // Flag question button
          IconButton(
            icon: const Icon(Icons.flag_outlined, size: 20),
            tooltip: 'Flag Question',
            onPressed: () => FlagQuestionDialog.show(
              context,
              questionId: question.id,
              onSubmit: (questionId, reason) => ref
                  .read(cloudFunctionsServiceProvider)
                  .flagQuestion(questionId: questionId, reason: reason),
            ),
          ),
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius:
                  BorderRadius.circular(AppSpacing.radiusFull),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle,
                    color: AppColors.success, size: 14),
                const SizedBox(width: 4),
                Text(
                  '${quiz.correctCount}/${quiz.totalAnswered}',
                  style:
                      Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.success,
                            fontWeight: FontWeight.w600,
                          ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          QuestionCard(
            question: question,
            selectedIndex: quiz.selectedOptionIndex,
            hasSubmitted: quiz.hasSubmitted,
            onOptionSelected: (i) =>
                ref.read(quizProvider.notifier).selectOption(i),
          ),
          AppSpacing.gapMd,
          if (quiz.hasSubmitted)
            ExplanationPanel(
              question: question,
              selectedIndex: quiz.selectedOptionIndex!,
              tutorResponse: quiz.tutorResponse,
            ),
          AppSpacing.gapLg,
          if (!quiz.hasSubmitted)
            PrimaryButton(
              label: 'Submit Answer',
              onPressed: quiz.selectedOptionIndex != null
                  ? () =>
                      ref.read(quizProvider.notifier).submitAnswer()
                  : null,
              isLoading: quiz.isLoading,
            )
          else
            PrimaryButton(
              label: 'Next Question',
              onPressed: () =>
                  ref.read(quizProvider.notifier).nextQuestion(),
            ),
          AppSpacing.gapLg,
        ],
      ),
    );
  }
}

class _ResultsView extends StatelessWidget {
  final QuizState quiz;

  const _ResultsView({required this.quiz});

  @override
  Widget build(BuildContext context) {
    final percent = (quiz.accuracy * 100).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final Color scoreColor;
    final String scoreLabel;
    final IconData scoreIcon;
    if (quiz.accuracy >= 0.8) {
      scoreColor = AppColors.success;
      scoreLabel = 'Excellent!';
      scoreIcon = Icons.emoji_events_rounded;
    } else if (quiz.accuracy >= 0.6) {
      scoreColor = AppColors.warning;
      scoreLabel = 'Good effort';
      scoreIcon = Icons.thumb_up_rounded;
    } else {
      scoreColor = AppColors.error;
      scoreLabel = 'Keep practicing';
      scoreIcon = Icons.trending_up_rounded;
    }

    // Difficulty breakdown

    // Difficulty breakdown
    int easyCount = 0, medCount = 0, hardCount = 0;
    for (final q in quiz.questions) {
      if (q.difficulty <= 2) {
        easyCount++;
      } else if (q.difficulty <= 4) {
        medCount++;
      } else {
        hardCount++;
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz Complete')),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          const SizedBox(height: 24),
          // ── Score circle ──
          Center(
            child: Container(
              width: 128,
              height: 128,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    scoreColor.withValues(alpha: 0.15),
                    scoreColor.withValues(alpha: 0.05),
                  ],
                ),
                border: Border.all(
                  color: scoreColor.withValues(alpha: 0.3),
                  width: 3,
                ),
                boxShadow: [
                  BoxShadow(
                    color: scoreColor.withValues(alpha: 0.15),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  '$percent%',
                  style: Theme.of(context)
                      .textTheme
                      .displayMedium
                      ?.copyWith(
                        color: scoreColor,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(scoreIcon, color: scoreColor, size: 24),
                const SizedBox(width: 8),
                Text(
                  scoreLabel,
                  style: Theme.of(context)
                      .textTheme
                      .headlineMedium
                      ?.copyWith(
                        color: scoreColor,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              '${quiz.correctCount} out of ${quiz.totalAnswered} correct',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
            ),
          ),

          // ── Stats row ──
          const SizedBox(height: 24),
          Row(
            children: [
              _StatCard(
                icon: Icons.quiz_outlined,
                label: 'Questions',
                value: '${quiz.totalAnswered}',
                color: AppColors.primary,
                isDark: isDark,
              ),
              const SizedBox(width: 12),
              _StatCard(
                icon: Icons.check_circle_outline,
                label: 'Correct',
                value: '${quiz.correctCount}',
                color: AppColors.success,
                isDark: isDark,
              ),
              const SizedBox(width: 12),
              _StatCard(
                icon: Icons.cancel_outlined,
                label: 'Incorrect',
                value: '${quiz.totalAnswered - quiz.correctCount}',
                color: AppColors.error,
                isDark: isDark,
              ),
            ],
          ),

          // ── Difficulty breakdown ──
          if (easyCount > 0 || medCount > 0 || hardCount > 0) ...[
            const SizedBox(height: 24),
            Text(
              'Difficulty Breakdown',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _DifficultyChip(label: 'Easy', count: easyCount, color: AppColors.success, isDark: isDark),
                const SizedBox(width: 8),
                _DifficultyChip(label: 'Medium', count: medCount, color: AppColors.warning, isDark: isDark),
                const SizedBox(width: 8),
                _DifficultyChip(label: 'Hard', count: hardCount, color: AppColors.error, isDark: isDark),
              ],
            ),
          ],

          // ── Per-question breakdown ──
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
            final safeCorrect = q.options.isNotEmpty
                ? q.correctIndex.clamp(0, q.options.length - 1)
                : 0;
            // We only know answers for questions up to totalAnswered
            final wasAnswered = i < quiz.totalAnswered;
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: (wasAnswered ? AppColors.primary : AppColors.surfaceVariant)
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Center(
                      child: Text(
                        '${i + 1}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: wasAnswered ? AppColors.primary : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
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
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.accent.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  q.topicTags.first,
                                  style: const TextStyle(fontSize: 10, color: AppColors.accent),
                                ),
                              ),
                            const SizedBox(width: 6),
                            Text(
                              'Difficulty: ${q.difficulty}/5',
                              style: TextStyle(
                                fontSize: 10,
                                color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (q.options.isNotEmpty)
                    Text(
                      q.options[safeCorrect],
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.success,
                      ),
                    ),
                ],
              ),
            );
          }),

          const SizedBox(height: 24),
          PrimaryButton(
            label: 'Done',
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
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool isDark;

  const _StatCard({
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
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: isDark ? 0.08 : 0.06),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DifficultyChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool isDark;

  const _DifficultyChip({
    required this.label,
    required this.count,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: isDark ? 0.08 : 0.06),
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String errorMessage;
  final VoidCallback onRetry;

  const _ErrorView({
    required this.errorMessage,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz Error')),
      body: Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.error.withValues(alpha: 0.1),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.3),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.error_outline_rounded,
                  color: AppColors.error,
                  size: 48,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Unable to Load Quiz',
                style: Theme.of(context)
                    .textTheme
                    .headlineMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                errorMessage,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: 220,
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

class _EmptyView extends StatelessWidget {
  final VoidCallback onBack;

  const _EmptyView({required this.onBack});

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
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.warning.withValues(alpha: 0.1),
                  border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.3),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.quiz_outlined,
                  color: AppColors.warning,
                  size: 48,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'No Questions Yet',
                style: Theme.of(context)
                    .textTheme
                    .headlineMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'Questions are still being generated for this section. Please check back in a few moments.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: 220,
                child: PrimaryButton(
                  label: 'Go Back',
                  onPressed: onBack,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
