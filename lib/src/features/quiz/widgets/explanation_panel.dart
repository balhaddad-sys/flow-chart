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
    final safeCorrectIndex = question.options.isNotEmpty
        ? question.correctIndex.clamp(0, question.options.length - 1)
        : 0;
    final isCorrect = selectedIndex == safeCorrectIndex;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: AppSpacing.cardPaddingLg,
      decoration: BoxDecoration(
        color: isCorrect
            ? AppColors.successLight
                .withValues(alpha: isDark ? 0.1 : 0.5)
            : AppColors.errorLight
                .withValues(alpha: isDark ? 0.1 : 0.5),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isCorrect
              ? AppColors.success
                  .withValues(alpha: isDark ? 0.2 : 0.15)
              : AppColors.error
                  .withValues(alpha: isDark ? 0.2 : 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color:
                      (isCorrect ? AppColors.success : AppColors.error)
                          .withValues(alpha: 0.15),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Icon(
                  isCorrect ? Icons.check : Icons.close,
                  color:
                      isCorrect ? AppColors.success : AppColors.error,
                  size: 16,
                ),
              ),
              AppSpacing.hGapSm,
              Text(
                isCorrect ? 'Correct!' : 'Incorrect',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(
                      color: isCorrect
                          ? AppColors.success
                          : AppColors.error,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
          if (question.explanation.correctWhy.isNotEmpty) ...[
            AppSpacing.gapMd,
            Text(
              question.options.isNotEmpty
                  ? 'Why ${question.options[safeCorrectIndex]} is correct:'
                  : 'Why the correct answer is right:',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            AppSpacing.gapXs,
            Text(
              question.explanation.correctWhy,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          if (!isCorrect) ...[
            AppSpacing.gapMd,
            Text(
              'Why your answer was wrong:',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            AppSpacing.gapXs,
            Text(
              selectedIndex <
                      question.explanation.whyOthersWrong.length
                  ? question.explanation.whyOthersWrong[selectedIndex]
                  : 'This option is incorrect.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          if (question.explanation.keyTakeaway.isNotEmpty) ...[
            AppSpacing.gapMd,
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.infoLight
                    .withValues(alpha: isDark ? 0.1 : 0.5),
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Row(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: AppColors.info.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.lightbulb_outline,
                        color: AppColors.info, size: 14),
                  ),
                  AppSpacing.hGapSm,
                  Expanded(
                    child: Text(
                      question.explanation.keyTakeaway,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: AppColors.info),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
