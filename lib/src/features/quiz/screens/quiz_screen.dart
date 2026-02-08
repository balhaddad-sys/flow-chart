import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Center(
              child: Text(
                '${quiz.correctCount}/${quiz.totalAnswered} correct',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
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

    return Scaffold(
      appBar: AppBar(title: const Text('Quiz Complete')),
      body: Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$percent%',
                style: Theme.of(context).textTheme.displayLarge,
              ),
              AppSpacing.gapSm,
              Text(
                '${quiz.correctCount} out of ${quiz.totalAnswered} correct',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              AppSpacing.gapXl,
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
}
