import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/primary_button.dart';
import '../../home/providers/home_provider.dart';
import '../providers/quiz_provider.dart';
import '../widgets/question_card.dart';
import '../widgets/explanation_panel.dart';

class QuizScreen extends ConsumerStatefulWidget {
  final String? sectionId;

  const QuizScreen({super.key, this.sectionId});

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
                );
          }
        },
      );
    }

    if (quiz.questions.isEmpty) {
      return _EmptyView(onBack: () => context.pop());
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
          if (quiz.hasSubmitted && quiz.tutorResponse != null)
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

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz Complete')),
      body: Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
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
              const SizedBox(height: 24),
              Row(
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
              const SizedBox(height: 8),
              Text(
                '${quiz.correctCount} out of ${quiz.totalAnswered} correct',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: 220,
                child: PrimaryButton(
                  label: 'Done',
                  onPressed: () => context.pop(),
                ),
              ),
            ],
          ),
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
