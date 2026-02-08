import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

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
        ref.read(quizProvider.notifier).loadQuestions(
              courseId: courseId,
              sectionId: widget.sectionId,
            );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final quiz = ref.watch(quizProvider);

    if (quiz.isLoading && quiz.questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (quiz.isComplete) {
      return _ResultsView(quiz: quiz);
    }

    final question = quiz.currentQuestion;
    if (question == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: const Center(child: Text('No questions available')),
      );
    }

    final progress = quiz.questions.isNotEmpty
        ? (quiz.currentIndex + 1) / quiz.questions.length
        : 0.0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quiz'),
        actions: [
          // Score badge
          Container(
            margin: const EdgeInsets.only(right: AppSpacing.md),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle,
                    color: AppColors.success, size: 16),
                const SizedBox(width: 4),
                Text(
                  '${quiz.correctCount}/${quiz.totalAnswered}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Progress bar
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress),
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOut,
            builder: (context, value, _) => LinearProgressIndicator(
              value: value,
              minHeight: 4,
              color: AppColors.primary,
              backgroundColor: AppColors.surfaceVariant,
            ),
          ),

          // Question counter
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.md, AppSpacing.md, 0,
            ),
            child: Row(
              children: [
                Text(
                  'Question ${quiz.currentIndex + 1} of ${quiz.questions.length}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                ),
              ],
            ),
          ),

          // Question + options
          Expanded(
            child: ListView(
              padding: AppSpacing.screenPadding,
              children: [
                QuestionCard(
                  question: question,
                  selectedIndex: quiz.selectedOptionIndex,
                  hasSubmitted: quiz.hasSubmitted,
                  onOptionSelected: (i) =>
                      ref.read(quizProvider.notifier).selectOption(i),
                ),
                const SizedBox(height: AppSpacing.md),
                if (quiz.hasSubmitted && quiz.tutorResponse != null)
                  ExplanationPanel(
                    question: question,
                    selectedIndex: quiz.selectedOptionIndex!,
                    tutorResponse: quiz.tutorResponse,
                  ),
                const SizedBox(height: AppSpacing.lg),
              ],
            ),
          ),

          // Bottom action
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(
                top: BorderSide(color: AppColors.border),
              ),
            ),
            child: SafeArea(
              top: false,
              child: !quiz.hasSubmitted
                  ? PrimaryButton(
                      label: 'Submit Answer',
                      onPressed: quiz.selectedOptionIndex != null
                          ? () =>
                              ref.read(quizProvider.notifier).submitAnswer()
                          : null,
                      isLoading: quiz.isLoading,
                    )
                  : PrimaryButton(
                      label: quiz.currentIndex < quiz.questions.length - 1
                          ? 'Next Question'
                          : 'See Results',
                      onPressed: () =>
                          ref.read(quizProvider.notifier).nextQuestion(),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Results view
// ---------------------------------------------------------------------------

class _ResultsView extends StatelessWidget {
  final QuizState quiz;

  const _ResultsView({required this.quiz});

  @override
  Widget build(BuildContext context) {
    final percent = quiz.accuracy;
    final percentInt = (percent * 100).round();
    final color = percent >= 0.8
        ? AppColors.success
        : percent >= 0.5
            ? AppColors.warning
            : AppColors.error;

    return Scaffold(
      appBar: AppBar(title: const Text('Results')),
      body: Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated score circle
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: percent),
                duration: const Duration(milliseconds: 1200),
                curve: Curves.easeOutCubic,
                builder: (context, value, _) => CircularPercentIndicator(
                  radius: 80,
                  lineWidth: 10,
                  percent: value.clamp(0.0, 1.0),
                  center: Text(
                    '${(value * 100).round()}%',
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                  ),
                  progressColor: color,
                  backgroundColor: color.withValues(alpha: 0.1),
                  circularStrokeCap: CircularStrokeCap.round,
                  animation: false,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),

              // Message
              Text(
                _resultMessage(percent),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${quiz.correctCount} out of ${quiz.totalAnswered} correct',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
              const SizedBox(height: AppSpacing.xl),

              // Stats row
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _ResultStat(
                      label: 'Correct',
                      value: '${quiz.correctCount}',
                      color: AppColors.success,
                    ),
                    _ResultStat(
                      label: 'Wrong',
                      value: '${quiz.totalAnswered - quiz.correctCount}',
                      color: AppColors.error,
                    ),
                    _ResultStat(
                      label: 'Score',
                      value: '$percentInt%',
                      color: color,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),

              PrimaryButton(
                label: 'Done',
                onPressed: () => context.pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _resultMessage(double accuracy) {
    if (accuracy >= 0.9) return 'Excellent work!';
    if (accuracy >= 0.7) return 'Good job!';
    if (accuracy >= 0.5) return 'Keep practicing';
    return 'Review this material';
  }
}

class _ResultStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ResultStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: color,
              ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}
