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
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
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

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Question ${quiz.currentIndex + 1}/${quiz.questions.length}',
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: const BoxDecoration(
              color: AppColors.successSurface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            ),
            child: Text(
              '${quiz.correctCount}/${quiz.totalAnswered} correct',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.success,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            child: LinearProgressIndicator(
              value: (quiz.currentIndex + 1) / quiz.questions.length,
              backgroundColor: AppColors.primarySurface,
              color: AppColors.primary,
              minHeight: 4,
            ),
          ),
          AppSpacing.gapLg,

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
                  ? () => ref.read(quizProvider.notifier).submitAnswer()
                  : null,
              isLoading: quiz.isLoading,
            )
          else
            PrimaryButton(
              label: 'Next Question',
              onPressed: () => ref.read(quizProvider.notifier).nextQuestion(),
            ),
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
    final color = percent >= 70
        ? AppColors.success
        : percent >= 40
            ? AppColors.warning
            : AppColors.error;

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz Complete')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$percent%',
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          color: color,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ),
              AppSpacing.gapLg,
              Text(
                percent >= 70 ? 'Great work!' : 'Keep practicing!',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              AppSpacing.gapSm,
              Text(
                '${quiz.correctCount} out of ${quiz.totalAnswered} correct',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textTertiary,
                    ),
              ),
              AppSpacing.gapXl,
              SizedBox(
                width: 200,
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
