import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/question_model.dart';

class ExplanationPanel extends StatelessWidget {
  final QuestionModel question;
  final int selectedIndex;
  final Map<String, dynamic>? tutorResponse;

  const ExplanationPanel({
    super.key,
    required this.question,
    required this.selectedIndex,
    this.tutorResponse,
  });

  @override
  Widget build(BuildContext context) {
    final isCorrect = selectedIndex == question.correctIndex;

    return Container(
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: isCorrect
            ? AppColors.success.withValues(alpha: 0.05)
            : AppColors.error.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isCorrect
              ? AppColors.success.withValues(alpha: 0.2)
              : AppColors.error.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isCorrect ? 'Correct!' : 'Incorrect',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: isCorrect ? AppColors.success : AppColors.error,
                ),
          ),
          AppSpacing.gapMd,
          // Why correct
          Text(
            'Why ${question.options[question.correctIndex]} is correct:',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          AppSpacing.gapXs,
          Text(
            question.explanation.correctWhy,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (!isCorrect) ...[
            AppSpacing.gapMd,
            // Why student was wrong
            Text(
              'Why your answer was wrong:',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            AppSpacing.gapXs,
            Text(
              selectedIndex < question.explanation.whyOthersWrong.length
                  ? question.explanation.whyOthersWrong[selectedIndex]
                  : 'This option is incorrect.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          AppSpacing.gapMd,
          // Key takeaway
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Row(
              children: [
                const Icon(Icons.lightbulb_outline,
                    color: AppColors.info, size: 18),
                AppSpacing.hGapSm,
                Expanded(
                  child: Text(
                    question.explanation.keyTakeaway,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.info,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
