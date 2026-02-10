import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/question_model.dart';

class ExplanationPanel extends StatelessWidget {
  final QuestionModel question;
  final int selectedIndex;
  final String? tutorResponse;

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
      padding: AppSpacing.cardPaddingLarge,
      decoration: BoxDecoration(
        color: isCorrect ? AppColors.successSurface : AppColors.errorSurface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: (isCorrect ? AppColors.success : AppColors.error)
              .withValues(alpha: 0.2),
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
                  color: (isCorrect ? AppColors.success : AppColors.error)
                      .withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isCorrect ? Icons.check_rounded : Icons.close_rounded,
                  color: isCorrect ? AppColors.success : AppColors.error,
                  size: 16,
                ),
              ),
              AppSpacing.hGapSm,
              Text(
                isCorrect ? 'Correct!' : 'Incorrect',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: isCorrect ? AppColors.success : AppColors.error,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
          AppSpacing.gapMd,
          if (question.explanation.isNotEmpty) ...[
            Text(
              question.explanation,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textPrimary,
                    height: 1.6,
                  ),
            ),
          ],
          if (tutorResponse != null && tutorResponse!.isNotEmpty) ...[
            AppSpacing.gapMd,
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: const Border(
                  left: BorderSide(
                    color: AppColors.secondary,
                    width: 3,
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome_rounded,
                          color: AppColors.secondary, size: 16),
                      AppSpacing.hGapXs,
                      Text(
                        'AI Tutor',
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: AppColors.secondary,
                                  fontWeight: FontWeight.w600,
                                ),
                      ),
                    ],
                  ),
                  AppSpacing.gapSm,
                  Text(
                    tutorResponse!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textPrimary,
                          height: 1.5,
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
